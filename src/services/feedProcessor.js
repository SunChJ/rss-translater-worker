import { XMLParser } from 'fast-xml-parser';
import { TranslationTask } from './translationQueue.js';

export class FeedProcessor {
  constructor(env) {
    this.env = env;
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
      allowBooleanAttributes: true,
      ignorePiTags: true,
      ignoreDeclaration: true
    });
  }

  async fetchFeed(feedUrl, etag = null) {
    try {
      const headers = {
        'User-Agent': 'RSS-Translator-Worker/1.0 (+https://rsstranslator.com)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml',
        'Accept-Encoding': 'gzip, deflate'
      };

      if (etag) {
        headers['If-None-Match'] = etag;
      }

      const response = await fetch(feedUrl, { headers });

      if (response.status === 304) {
        return { notModified: true };
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!this.isValidFeedType(contentType)) {
        console.warn(`Unexpected content type: ${contentType} for ${feedUrl}`);
      }

      const content = await response.text();
      const newEtag = response.headers.get('etag');

      return {
        content,
        etag: newEtag,
        lastModified: response.headers.get('last-modified'),
        contentType
      };
    } catch (error) {
      console.error(`Failed to fetch feed ${feedUrl}:`, error);
      throw error;
    }
  }

  isValidFeedType(contentType) {
    const validTypes = [
      'application/rss+xml',
      'application/atom+xml',
      'application/xml',
      'text/xml',
      'text/html' // Some feeds incorrectly report as HTML
    ];
    
    return validTypes.some(type => contentType.includes(type));
  }

  parseFeed(content) {
    try {
      const parsed = this.parser.parse(content);
      
      // Detect feed type and extract data
      if (parsed.rss && parsed.rss.channel) {
        return this.parseRSSFeed(parsed.rss.channel);
      } else if (parsed.feed) {
        return this.parseAtomFeed(parsed.feed);
      } else if (parsed.channel) {
        return this.parseRSSFeed(parsed.channel);
      } else {
        throw new Error('Unrecognized feed format');
      }
    } catch (error) {
      console.error('Failed to parse feed:', error);
      throw new Error(`Feed parsing failed: ${error.message}`);
    }
  }

  parseRSSFeed(channel) {
    const feed = {
      type: 'rss',
      title: this.extractText(channel.title),
      description: this.extractText(channel.description),
      link: this.extractText(channel.link),
      language: this.extractText(channel.language),
      pubDate: this.parseDate(channel.pubDate || channel.lastBuildDate),
      entries: []
    };

    // Parse items
    const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
    
    feed.entries = items.map(item => {
      // 添加原始数据调试信息
      console.log('Raw RSS item link data:', {
        item_link: item.link,
        item_link_type: typeof item.link,
        item_link_keys: item.link && typeof item.link === 'object' ? Object.keys(item.link) : 'N/A'
      });
      
      const parsedEntry = {
        title: this.extractText(item.title),
        link: this.extractText(item.link) || this.extractText(item.guid) || '',
        description: this.extractText(item.description),
        content: this.extractContent(item),
        author: this.extractText(item.author || item['dc:creator']),
        pubDate: this.parseDate(item.pubDate),
        guid: this.extractText(item.guid) || this.extractText(item.link),
        categories: this.extractCategories(item.category)
      };
      
      // 添加调试信息
      console.log('Parsed RSS entry:', {
        title: parsedEntry.title?.substring(0, 50),
        link: parsedEntry.link || 'NO_LINK',
        guid: parsedEntry.guid || 'NO_GUID'
      });
      
      return parsedEntry;
    });

    return feed;
  }

  parseAtomFeed(feed) {
    const feedData = {
      type: 'atom',
      title: this.extractText(feed.title),
      description: this.extractText(feed.subtitle || feed.summary),
      link: this.extractAtomLink(feed.link),
      language: feed['@_xml:lang'] || 'en',
      pubDate: this.parseDate(feed.updated),
      entries: []
    };

    // Parse entries
    const entries = Array.isArray(feed.entry) ? feed.entry : (feed.entry ? [feed.entry] : []);
    
    feedData.entries = entries.map(entry => {
      // 添加原始数据调试信息
      console.log('Raw Atom entry link data:', {
        entry_link: entry.link,
        entry_link_type: typeof entry.link,
        entry_link_keys: entry.link && typeof entry.link === 'object' ? Object.keys(entry.link) : 'N/A'
      });
      
      const parsedEntry = {
        title: this.extractText(entry.title),
        link: this.extractAtomLink(entry.link) || this.extractText(entry.id) || '',
        description: this.extractText(entry.summary),
        content: this.extractAtomContent(entry),
        author: this.extractAtomAuthor(entry.author),
        pubDate: this.parseDate(entry.updated || entry.published),
        guid: this.extractText(entry.id) || this.extractAtomLink(entry.link),
        categories: this.extractAtomCategories(entry.category)
      };
      
      // 添加调试信息
      console.log('Parsed Atom entry:', {
        title: parsedEntry.title?.substring(0, 50),
        link: parsedEntry.link || 'NO_LINK',
        guid: parsedEntry.guid || 'NO_GUID'
      });
      
      return parsedEntry;
    });

    return feedData;
  }

  extractText(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object' && value['#text']) return value['#text'].trim();
    if (typeof value === 'object' && value._) return value._.trim();
    return String(value).trim();
  }

  extractContent(item) {
    // Try various content fields in order of preference
    const contentFields = [
      'content:encoded',
      'content',
      'description',
      'summary'
    ];

    for (const field of contentFields) {
      const content = item[field];
      if (content) {
        return this.extractText(content);
      }
    }

    return '';
  }

  extractAtomContent(entry) {
    if (entry.content) {
      if (typeof entry.content === 'string') return entry.content;
      if (entry.content['#text']) return entry.content['#text'];
      if (entry.content._) return entry.content._;
    }
    
    return this.extractText(entry.summary) || '';
  }

  extractAtomLink(links) {
    if (!links) return '';
    
    // 添加调试信息
    console.log('extractAtomLink input:', {
      links: links,
      links_type: typeof links,
      is_array: Array.isArray(links),
      links_keys: links && typeof links === 'object' ? Object.keys(links) : 'N/A'
    });
    
    if (Array.isArray(links)) {
      // Find alternate link or use the first one
      const altLink = links.find(link => link['@_rel'] === 'alternate');
      const result = altLink ? altLink['@_href'] : (links[0] ? links[0]['@_href'] : '');
      console.log('extractAtomLink array result:', { result, altLink, firstLink: links[0] });
      return result;
    }
    
    if (typeof links === 'object' && links['@_href']) {
      const result = links['@_href'];
      console.log('extractAtomLink object result:', { result, href: links['@_href'] });
      return result;
    }
    
    const result = String(links);
    console.log('extractAtomLink string result:', { result, original: links });
    return result;
  }

  extractAtomAuthor(author) {
    if (!author) return '';
    if (typeof author === 'string') return author;
    if (Array.isArray(author)) author = author[0];
    if (author.name) return this.extractText(author.name);
    if (author.email) return this.extractText(author.email);
    return '';
  }

  extractCategories(categories) {
    if (!categories) return [];
    if (!Array.isArray(categories)) categories = [categories];
    
    return categories.map(cat => {
      if (typeof cat === 'string') return cat;
      if (cat['@_term']) return cat['@_term'];
      if (cat['#text']) return cat['#text'];
      return String(cat);
    }).filter(Boolean);
  }

  extractAtomCategories(categories) {
    if (!categories) return [];
    if (!Array.isArray(categories)) categories = [categories];
    
    return categories.map(cat => cat['@_term'] || cat['@_label'] || '').filter(Boolean);
  }

  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
      return null;
    }
  }

  async extractFullArticle(url) {
    if (!url) return '';
    
    try {
      // Simple full-text extraction - in production, you might want to use
      // a more sophisticated service like Readability or Mercury
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'RSS-Translator-Worker/1.0 (+https://rsstranslator.com)'
        }
      });

      if (!response.ok) {
        console.warn(`Failed to fetch article: ${response.status}`);
        return '';
      }

      const html = await response.text();
      
      // Basic content extraction - remove scripts, styles, nav, etc.
      const cleanHtml = html
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<nav[^>]*>.*?<\/nav>/gis, '')
        .replace(/<header[^>]*>.*?<\/header>/gis, '')
        .replace(/<footer[^>]*>.*?<\/footer>/gis, '')
        .replace(/<aside[^>]*>.*?<\/aside>/gis, '');

      // Extract main content area
      const contentMatch = cleanHtml.match(/<(article|main|div[^>]*class[^>]*content)[^>]*>(.*?)<\/(article|main|div)>/is);
      
      if (contentMatch) {
        return contentMatch[2];
      }

      // Fallback: extract body content
      const bodyMatch = cleanHtml.match(/<body[^>]*>(.*?)<\/body>/is);
      return bodyMatch ? bodyMatch[1] : '';
      
    } catch (error) {
      console.error(`Failed to extract article from ${url}:`, error);
      return '';
    }
  }

  stripHTML(html) {
    if (!html) return '';
    
    return html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  async processFeed(feedConfig, agentManager) {
    try {
      console.log(`Processing feed: ${feedConfig.feed_url}`);
      
      // Fetch feed
      const fetchResult = await this.fetchFeed(feedConfig.feed_url, feedConfig.etag);
      
      if (fetchResult.notModified) {
        console.log(`Feed not modified: ${feedConfig.feed_url}`);
        return { success: true, notModified: true };
      }

      // Parse feed
      const parsedFeed = this.parseFeed(fetchResult.content);
      
      // Update feed metadata
      const feedUpdates = {
        name: parsedFeed.title || feedConfig.name,
        link: parsedFeed.link || feedConfig.link,
        language: parsedFeed.language || feedConfig.language,
        etag: fetchResult.etag,
        last_fetch: new Date().toISOString(),
        fetch_status: true,
        log: ''
      };

      // Process entries
      const processedEntries = [];
      const maxPosts = feedConfig.max_posts || 20;
      const entriesToProcess = parsedFeed.entries.slice(0, maxPosts);

      for (const entry of entriesToProcess) {
        try {
          const processedEntry = await this.processEntry(entry, feedConfig, agentManager);
          if (processedEntry) {
            processedEntries.push(processedEntry);
          }
        } catch (error) {
          console.error(`Failed to process entry ${entry.title}:`, error);
        }
      }

      return {
        success: true,
        feedUpdates,
        entries: processedEntries,
        etag: fetchResult.etag
      };
      
    } catch (error) {
      console.error(`Failed to process feed ${feedConfig.feed_url}:`, error);
      
      return {
        success: false,
        error: error.message,
        feedUpdates: {
          fetch_status: false,
          log: `${new Date().toISOString()}: ${error.message}`,
          last_fetch: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 使用并发翻译处理Feed
   * @param {Object} feedConfig - Feed配置
   * @param {Object} agentManager - 代理管理器
   * @param {Object} translationQueue - 翻译队列
   * @returns {Promise<Object>} 处理结果
   */
  async processFeedWithConcurrentTranslation(feedConfig, agentManager, translationQueue) {
    try {
      console.log(`Processing feed with concurrent translation: ${feedConfig.feed_url}`);
      
      // 获取Feed内容
      const fetchResult = await this.fetchFeed(feedConfig.feed_url, feedConfig.etag);
      
      if (fetchResult.notModified) {
        console.log(`Feed not modified: ${feedConfig.feed_url}`);
        return { success: true, notModified: true };
      }

      // 解析Feed
      const parsedFeed = this.parseFeed(fetchResult.content);
      
      // 更新Feed元数据
      const feedUpdates = {
        name: parsedFeed.title || feedConfig.name,
        link: parsedFeed.link || feedConfig.link,
        language: parsedFeed.language || feedConfig.language,
        etag: fetchResult.etag,
        last_fetch: new Date().toISOString(),
        fetch_status: true,
        log: ''
      };

      // 处理条目
      const processedEntries = [];
      const maxPosts = feedConfig.max_posts || 20;
      const entriesToProcess = parsedFeed.entries.slice(0, maxPosts);

      if (feedConfig.translator_id && (feedConfig.translate_title || feedConfig.translate_content)) {
        // 使用并发翻译队列
        const translationResults = await this.processEntriesWithConcurrentTranslation(
          entriesToProcess,
          feedConfig,
          agentManager,
          translationQueue
        );
        
        processedEntries.push(...translationResults);
      } else {
        // 不需要翻译，直接处理
        for (const entry of entriesToProcess) {
          try {
            const processedEntry = await this.processEntry(entry, feedConfig, agentManager);
            if (processedEntry) {
              processedEntries.push(processedEntry);
            }
          } catch (error) {
            console.error(`Failed to process entry ${entry.title}:`, error);
          }
        }
      }

      return {
        success: true,
        feedUpdates,
        entries: processedEntries,
        etag: fetchResult.etag
      };
      
    } catch (error) {
      console.error(`Failed to process feed ${feedConfig.feed_url}:`, error);
      
      return {
        success: false,
        error: error.message,
        feedUpdates: {
          fetch_status: false,
          log: `${new Date().toISOString()}: ${error.message}`,
          last_fetch: new Date().toISOString()
        }
      };
    }
  }

  /**
   * 使用并发翻译处理条目
   * @param {Array} entries - 条目数组
   * @param {Object} feedConfig - Feed配置
   * @param {Object} agentManager - 代理管理器
   * @param {Object} translationQueue - 翻译队列
   * @returns {Promise<Array>} 处理后的条目
   */
  async processEntriesWithConcurrentTranslation(entries, feedConfig, agentManager, translationQueue) {
    console.log(`Processing ${entries.length} entries with concurrent translation`);
    
    // 重置翻译队列进度
    translationQueue.resetProgress();
    
    // 创建翻译任务
    const translationTasks = entries.map(entry => {
      const task = new TranslationTask(entry, feedConfig, agentManager);
      return {
        task: () => task.execute(),
        metadata: {
          title: entry.title,
          guid: entry.guid,
          description: task.getDescription()
        }
      };
    });

    // 批量添加翻译任务到队列
    const results = await translationQueue.addBatchTasks(translationTasks);
    
    // 等待所有任务完成
    await translationQueue.waitForCompletion();
    
    // 获取最终进度
    const finalProgress = translationQueue.getProgress();
    console.log(`Translation completed: ${finalProgress.summary}`);
    
    // 处理翻译结果
    const processedEntries = [];
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const result = results[i];
      
      try {
        if (result.status === 'fulfilled' && result.value.success) {
          // 翻译成功
          const processedEntry = {
            title: entry.title || '',
            link: entry.link || '',
            author: entry.author || '',
            content: entry.content || entry.description || '',
            published: entry.pubDate || new Date().toISOString(),
            guid: entry.guid || entry.link || '',
            translated_title: result.value.translatedTitle || '',
            translated_content: result.value.translatedContent || '',
            summary: '',
            tokens_used: result.value.tokensUsed || 0,
            characters_used: result.value.charactersUsed || 0
          };

          // 应用摘要（如果配置了）
          if (feedConfig.summarizer_id && feedConfig.summary) {
            const summary = await this.summarizeEntry(processedEntry, feedConfig, agentManager);
            if (summary.success) {
              processedEntry.summary = summary.text;
              processedEntry.tokens_used += summary.tokens || 0;
            }
          }

          processedEntries.push(processedEntry);
          
        } else {
          // 翻译失败，使用原始内容
          console.warn(`Translation failed for entry ${entry.title}:`, result.reason || 'Unknown error');
          
          const processedEntry = {
            title: entry.title || '',
            link: entry.link || '',
            author: entry.author || '',
            content: entry.content || entry.description || '',
            published: entry.pubDate || new Date().toISOString(),
            guid: entry.guid || entry.link || '',
            translated_title: '',
            translated_content: '',
            summary: '',
            tokens_used: 0,
            characters_used: 0
          };

          processedEntries.push(processedEntry);
        }
      } catch (error) {
        console.error(`Failed to process entry ${entry.title}:`, error);
        
        // 添加原始条目作为后备
        const processedEntry = {
          title: entry.title || '',
          link: entry.link || '',
          author: entry.author || '',
          content: entry.content || entry.description || '',
          published: entry.pubDate || new Date().toISOString(),
          guid: entry.guid || entry.link || '',
          translated_title: '',
          translated_content: '',
          summary: '',
          tokens_used: 0,
          characters_used: 0
        };

        processedEntries.push(processedEntry);
      }
    }

    return processedEntries;
  }

  async processEntry(entry, feedConfig, agentManager) {
    try {
      let content = entry.content || entry.description || '';
      
      // Fetch full article if enabled
      if (feedConfig.fetch_article && entry.link) {
        const fullContent = await this.extractFullArticle(entry.link);
        if (fullContent) {
          content = fullContent;
        }
      }

      const processedEntry = {
        title: entry.title || '',
        link: entry.link || entry.guid || '',
        author: entry.author || '',
        content: content,
        published: entry.pubDate || new Date().toISOString(),
        guid: entry.guid || entry.link || '',
        translated_title: '',
        translated_content: '',
        summary: '',
        tokens_used: 0,
        characters_used: 0
      };

      // Apply translations if configured
      if (feedConfig.translator_id && (feedConfig.translate_title || feedConfig.translate_content)) {
        const result = await this.translateEntry(processedEntry, feedConfig, agentManager);
        Object.assign(processedEntry, result);
      }

      // Apply summarization if configured
      if (feedConfig.summarizer_id && feedConfig.summary) {
        const summary = await this.summarizeEntry(processedEntry, feedConfig, agentManager);
        if (summary.success) {
          processedEntry.summary = summary.text;
          processedEntry.tokens_used += summary.tokens || 0;
        }
      }

      return processedEntry;
      
    } catch (error) {
      console.error('Failed to process entry:', error);
      return null;
    }
  }

  async translateEntry(entry, feedConfig, agentManager) {
    const result = {
      translated_title: entry.title,
      translated_content: entry.content,
      tokens_used: 0,
      characters_used: 0
    };

    try {
      const agent = await agentManager.getAgentById(feedConfig.translator_id);
      if (!agent || !agent.valid) {
        throw new Error('Invalid or missing translator agent');
      }

      // Translate title
      if (feedConfig.translate_title && entry.title) {
        const titleResult = await agent.translate(
          entry.title, 
          feedConfig.target_language,
          { textType: 'title', userPrompt: feedConfig.additional_prompt }
        );
        
        if (titleResult.success) {
          // Check if translation is different from original
          const originalTitle = entry.title.trim();
          const translatedTitle = titleResult.text.trim();
          
          if (originalTitle !== translatedTitle) {
            result.translated_title = translatedTitle;
            result.tokens_used += titleResult.tokens || 0;
            result.characters_used += titleResult.characters || 0;
          } else {
            console.log('Title translation equals original, skipping:', originalTitle);
            result.translated_title = ''; // Clear translation if it matches original
          }
        }
      }

      // Translate content
      if (feedConfig.translate_content && entry.content) {
        const contentResult = await agent.translate(
          entry.content,
          feedConfig.target_language,
          { textType: 'content', userPrompt: feedConfig.additional_prompt }
        );
        
        if (contentResult.success) {
          // Check if translation is different from original
          const originalContent = entry.content.trim();
          const translatedContent = contentResult.text.trim();
          
          if (originalContent !== translatedContent) {
            result.translated_content = translatedContent;
            result.tokens_used += contentResult.tokens || 0;
            result.characters_used += contentResult.characters || 0;
          } else {
            console.log('Content translation equals original, skipping:', originalContent.substring(0, 100) + '...');
            result.translated_content = ''; // Clear translation if it matches original
          }
        }
      }

      return result;
      
    } catch (error) {
      console.error('Translation failed:', error);
      return result; // Return original content if translation fails
    }
  }

  async summarizeEntry(entry, feedConfig, agentManager) {
    try {
      const agent = await agentManager.getAgentById(feedConfig.summarizer_id);
      if (!agent || !agent.valid || !agent.isAI) {
        throw new Error('Invalid or missing summarizer agent');
      }

      const contentToSummarize = entry.translated_content || entry.content;
      if (!contentToSummarize) {
        return { success: false, text: '', tokens: 0 };
      }

      return await agent.summarize(contentToSummarize, feedConfig.target_language);
      
    } catch (error) {
      console.error('Summarization failed:', error);
      return { success: false, text: '', tokens: 0 };
    }
  }
}