export class FeedGenerator {
  generateRSS(feed, entries) {
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

    for (const entry of entries) {
      const title = this.formatTitle(entry, feed.translation_display);
      const content = this.formatContent(entry, feed.translation_display);
      const link = this.escapeXml(entry.link || '');
      const pubDate = entry.published ? new Date(entry.published).toUTCString() : now;
      const guid = this.escapeXml(entry.guid || entry.link || '');
      
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
    }

    xml += `  </channel>
</rss>`;

    return xml;
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
      const link = this.escapeXml(entry.link || '');
      const updated = entry.published ? new Date(entry.published).toISOString() : now;
      const entryId = this.escapeXml(entry.guid || entry.link || `${feedId}/${entry.id}`);
      
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
        url: entry.link || '',
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
    const original = entry.title || '';
    const translated = entry.translated_title || '';
    
    switch (displayMode) {
      case 0: // Only translation
        return translated || original;
      case 1: // Translation | Original
        return translated && original && translated !== original 
          ? `${translated} | ${original}` 
          : (translated || original);
      case 2: // Original | Translation
        return translated && original && translated !== original 
          ? `${original} | ${translated}` 
          : (original || translated);
      default:
        return translated || original;
    }
  }

  formatContent(entry, displayMode) {
    const original = entry.content || '';
    const translated = entry.translated_content || '';
    const summary = entry.summary || '';
    
    let content = '';
    
    switch (displayMode) {
      case 0: // Only translation
        content = translated || original;
        break;
      case 1: // Translation | Original
        if (translated && original && translated !== original) {
          content = `<div class="translated-content">${translated}</div>`;
          content += `<hr><div class="original-content">${original}</div>`;
        } else {
          content = translated || original;
        }
        break;
      case 2: // Original | Translation
        if (translated && original && translated !== original) {
          content = `<div class="original-content">${original}</div>`;
          content += `<hr><div class="translated-content">${translated}</div>`;
        } else {
          content = original || translated;
        }
        break;
      default:
        content = translated || original;
    }
    
    // Add summary if available
    if (summary) {
      content = `<div class="summary"><strong>Summary:</strong> ${summary}</div><hr>${content}`;
    }
    
    return content;
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