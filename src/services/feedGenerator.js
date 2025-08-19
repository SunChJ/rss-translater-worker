export class FeedGenerator {
  generateRSS(feed, entries) {
    try {
      const now = new Date().toUTCString();
      const feedTitle = this.escapeXml(feed.name || 'Unnamed Feed');
      const feedDescription = this.escapeXml(feed.subtitle || 'RSS Translator Generated Feed');
      const feedLink = this.escapeXml(feed.link || 'https://rsstranslator.com');
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${feedTitle}</title>
    <description>${feedDescription}</description>
    <link>${feedLink}</link>
    <language>${this.getLanguageCode(feed.target_language)}</language>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>RSS Translator Worker</generator>
    <atom:link href="https://rsstranslator.com/feeds/${feed.slug}.rss" rel="self" type="application/rss+xml"/>
`;

    if (!entries || !Array.isArray(entries)) {
      console.warn('Entries is not an array:', entries);
      entries = [];
    }

    for (const entry of entries) {
      try {
        if (!entry) {
          console.warn('Skipping null/undefined entry');
          continue;
        }
        
        const title = this.formatTitle(entry, feed.translation_display);
        const content = this.formatContent(entry, feed.translation_display);
        const link = this.escapeXml(entry.link || entry.guid || '');
        const pubDate = entry.published ? new Date(entry.published).toUTCString() : now;
        const guid = this.escapeXml(entry.guid || entry.link || '');
        
        // 添加调试信息
        console.log('Processing entry for RSS:', {
          id: entry.id,
          title: title.substring(0, 50),
          link: entry.link || 'NO_LINK',
          escaped_link: link,
          guid: entry.guid || 'NO_GUID'
        });
        
        xml += `    <item>
      <title>${this.escapeXml(title)}</title>
      <link>${link}</link>
      <description>${this.escapeXml(this.stripHtml(content))}</description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${guid}</guid>`;
        
        if (entry.author) {
          xml += `
      <author>${this.escapeXml(entry.author)}</author>`;
        }
        
        xml += `
    </item>
`;
      } catch (entryError) {
        console.error('Error processing entry:', entryError, entry);
        // Continue with next entry rather than failing completely
      }
    }

    xml += `  </channel>
</rss>`;

    return xml;
    } catch (error) {
      console.error('RSS generation error:', error);
      console.error('Feed data:', feed);
      console.error('Entries count:', entries?.length || 0);
      throw new Error(`RSS generation failed: ${error.message}`);
    }
  }

  generateAtom(feed, entries) {
    const now = new Date().toISOString();
    const feedId = `https://rsstranslator.com/feeds/${feed.slug}`;
    const feedTitle = this.escapeXml(feed.name || 'Unnamed Feed');
    const feedSubtitle = this.escapeXml(feed.subtitle || 'RSS Translator Generated Feed');
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${feedTitle}</title>
  <subtitle>${feedSubtitle}</subtitle>
  <id>${feedId}</id>
  <link rel="self" href="https://rsstranslator.com/feeds/${feed.slug}.atom"/>`;
  
    if (feed.link) {
      xml += `
  <link rel="alternate" href="${this.escapeXml(feed.link)}"/>`;
    }
    
    xml += `
  <updated>${now}</updated>
  <generator>RSS Translator Worker</generator>
`;

    for (const entry of entries) {
      const title = this.formatTitle(entry, feed.translation_display);
      const content = this.formatContent(entry, feed.translation_display);
      const link = this.escapeXml(entry.link || entry.guid || '');
      const updated = entry.published ? new Date(entry.published).toISOString() : now;
      const entryId = this.escapeXml(entry.guid || entry.link || `${feedId}/${entry.id}`);
      
      // 添加调试信息
      console.log('Processing entry for Atom:', {
        id: entry.id,
        title: title.substring(0, 50),
        link: entry.link || 'NO_LINK',
        escaped_link: link,
        guid: entry.guid || 'NO_GUID'
      });
      
      xml += `  <entry>
    <title>${this.escapeXml(title)}</title>
    <id>${entryId}</id>
    <link href="${link}"/>
    <updated>${updated}</updated>`;
    
      if (entry.author) {
        xml += `
    <author>
      <name>${this.escapeXml(entry.author)}</name>
    </author>`;
      }
      
      xml += `
    <content type="html"><![CDATA[${content}]]></content>
  </entry>
`;
    }

    xml += `</feed>`;
    
    return xml;
  }

  generateJSON(feed, entries) {
    const feedUrl = `https://rsstranslator.com/feeds/${feed.slug}`;
    
    const jsonFeed = {
      version: "https://jsonfeed.org/version/1.1",
      title: feed.name || 'Unnamed Feed',
      description: feed.subtitle || 'RSS Translator Generated Feed',
      home_page_url: feed.link || 'https://rsstranslator.com',
      feed_url: `${feedUrl}.json`,
      language: this.getLanguageCode(feed.target_language),
      generator: 'RSS Translator Worker',
      items: []
    };

    for (const entry of entries) {
      const title = this.formatTitle(entry, feed.translation_display);
      const content = this.formatContent(entry, feed.translation_display);
      
      const item = {
        id: entry.guid || entry.link || String(entry.id),
        title: title,
        content_html: content,
        url: entry.link || entry.guid || '',
        date_published: entry.published || new Date().toISOString()
      };
      
      if (entry.author) {
        item.authors = [{ name: entry.author }];
      }
      
      if (entry.summary) {
        item.summary = entry.summary;
      }
      
      jsonFeed.items.push(item);
    }

    return jsonFeed;
  }

  formatTitle(entry, displayMode) {
    try {
      const original = (entry?.title || '').trim();
      const translated = (entry?.translated_title || '').trim();
      
      // If translation is empty or equals original, treat as no translation
      const hasValidTranslation = translated && translated !== original;
      
      switch (displayMode) {
        case 0: // Only translation
          return hasValidTranslation ? translated : (original || 'Untitled');
        case 1: // Translation | Original
          return hasValidTranslation 
            ? `${translated} | ${original}` 
            : (original || 'Untitled');
        case 2: // Original | Translation
          return hasValidTranslation 
            ? `${original} | ${translated}` 
            : (original || 'Untitled');
        default:
          return hasValidTranslation ? translated : (original || 'Untitled');
      }
    } catch (error) {
      console.error('Error in formatTitle:', error, entry);
      return 'Untitled';
    }
  }

  formatContent(entry, displayMode) {
    try {
      const original = (entry?.content || '').trim();
      const translated = (entry?.translated_content || '').trim();
      const summary = entry?.summary || '';
      
      // If translation is empty or equals original, treat as no translation
      const hasValidTranslation = translated && translated !== original;
      
      let content = '';
      
      switch (displayMode) {
        case 0: // Only translation
          content = hasValidTranslation ? translated : original;
          break;
        case 1: // Translation | Original
          if (hasValidTranslation) {
            content = `<div class="translated-content">${translated}</div>`;
            content += `<hr><div class="original-content">${original}</div>`;
          } else {
            content = original;
          }
          break;
        case 2: // Original | Translation
          if (hasValidTranslation) {
            content = `<div class="original-content">${original}</div>`;
            content += `<hr><div class="translated-content">${translated}</div>`;
          } else {
            content = original;
          }
          break;
        default:
          content = hasValidTranslation ? translated : original;
      }
      
      // Add summary if available
      if (summary) {
        content = `<div class="summary"><strong>Summary:</strong> ${summary}</div><hr>${content}`;
      }
      
      return content || 'Content unavailable';
    } catch (error) {
      console.error('Error in formatContent:', error, entry);
      return 'Content unavailable';
    }
  }

  escapeXml(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  getLanguageCode(language) {
    const languageMap = {
      'English': 'en',
      'Chinese Simplified': 'zh-CN',
      'Chinese Traditional': 'zh-TW',
      'Russian': 'ru',
      'Japanese': 'ja',
      'Korean': 'ko',
      'Czech': 'cs',
      'Danish': 'da',
      'German': 'de',
      'Spanish': 'es',
      'French': 'fr',
      'Indonesian': 'id',
      'Italian': 'it',
      'Hungarian': 'hu',
      'Norwegian Bokmål': 'nb',
      'Dutch': 'nl',
      'Polish': 'pl',
      'Portuguese': 'pt',
      'Swedish': 'sv',
      'Turkish': 'tr'
    };
    
    return languageMap[language] || 'en';
  }
}