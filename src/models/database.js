// Database initialization and schema management
export class Database {
  constructor(d1) {
    this.db = d1;
  }

  async init() {
    await this.createTables();
  }

  async isInitialized() {
    try {
      // Check if the main tables exist by querying them
      await this.db.prepare('SELECT 1 FROM feeds LIMIT 1').first();
      await this.db.prepare('SELECT 1 FROM agents LIMIT 1').first();
      await this.db.prepare('SELECT 1 FROM entries LIMIT 1').first();
      return true;
    } catch (error) {
      // If any table doesn't exist, consider database not initialized
      return false;
    }
  }

  async ensureInitialized() {
    const isInit = await this.isInitialized();
    if (!isInit) {
      console.log('Database not initialized, creating tables...');
      await this.init();
      console.log('Database tables created successfully');
    }
    return !isInit; // Return true if we just initialized
  }

  async createTables() {
    // Feeds table
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        subtitle TEXT,
        slug TEXT UNIQUE NOT NULL,
        link TEXT,
        author TEXT,
        language TEXT,
        feed_url TEXT NOT NULL,
        fetch_status BOOLEAN,
        update_frequency INTEGER DEFAULT 30,
        max_posts INTEGER DEFAULT 20,
        fetch_article BOOLEAN DEFAULT 0,
        translation_display INTEGER DEFAULT 0,
        target_language TEXT DEFAULT 'Chinese Simplified',
        translate_title BOOLEAN DEFAULT 0,
        translate_content BOOLEAN DEFAULT 0,
        summary BOOLEAN DEFAULT 0,
        translation_status BOOLEAN,
        translator_id INTEGER,
        summarizer_id INTEGER,
        summary_detail REAL DEFAULT 0.0,
        additional_prompt TEXT,
        total_tokens INTEGER DEFAULT 0,
        total_characters INTEGER DEFAULT 0,
        last_translate DATETIME,
        last_fetch DATETIME,
        etag TEXT,
        log TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(feed_url, target_language)
      )
    `).run();

    // Agents table (translation engines)
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL, -- 'openai', 'deepl', 'libretranslate', 'test'
        valid BOOLEAN,
        is_ai BOOLEAN DEFAULT 0,
        config TEXT, -- JSON configuration for the agent
        log TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Entries table
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feed_id INTEGER NOT NULL,
        title TEXT,
        translated_title TEXT,
        link TEXT,
        author TEXT,
        summary TEXT,
        content TEXT,
        translated_content TEXT,
        published DATETIME,
        guid TEXT UNIQUE,
        tokens_used INTEGER DEFAULT 0,
        characters_used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (feed_id) REFERENCES feeds (id) ON DELETE CASCADE
      )
    `).run();

    // Tags table
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Feed tags relationship
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS feed_tags (
        feed_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (feed_id, tag_id),
        FOREIGN KEY (feed_id) REFERENCES feeds (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
      )
    `).run();

    // Filters table
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS filters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        filter_type TEXT NOT NULL, -- 'keyword', 'ai'
        keywords TEXT, -- JSON array for keyword filters
        agent_id INTEGER, -- For AI filters
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (agent_id) REFERENCES agents (id)
      )
    `).run();

    // Feed filters relationship
    await this.db.prepare(`
      CREATE TABLE IF NOT EXISTS feed_filters (
        feed_id INTEGER NOT NULL,
        filter_id INTEGER NOT NULL,
        PRIMARY KEY (feed_id, filter_id),
        FOREIGN KEY (feed_id) REFERENCES feeds (id) ON DELETE CASCADE,
        FOREIGN KEY (filter_id) REFERENCES filters (id) ON DELETE CASCADE
      )
    `).run();

    console.log('Database tables created successfully');
  }

  // Helper methods for common operations
  async getFeeds(limit = 50, offset = 0) {
    return await this.db.prepare(`
      SELECT * FROM feeds 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();
  }

  async getFeedById(id) {
    return await this.db.prepare('SELECT * FROM feeds WHERE id = ?').bind(id).first();
  }

  async getFeedBySlug(slug) {
    return await this.db.prepare('SELECT * FROM feeds WHERE slug = ?').bind(slug).first();
  }

  async createFeed(data) {
    const slug = this.generateSlug(data.feed_url, data.target_language);
    
    return await this.db.prepare(`
      INSERT INTO feeds (
        name, feed_url, target_language, slug, update_frequency, 
        max_posts, translate_title, translate_content, summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.name || '',
      data.feed_url,
      data.target_language || 'Chinese Simplified',
      slug,
      data.update_frequency || 30,
      data.max_posts || 20,
      data.translate_title ? 1 : 0,
      data.translate_content ? 1 : 0,
      data.summary ? 1 : 0
    ).run();
  }

  async updateFeed(id, data) {
    const updates = [];
    const values = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    if (updates.length === 0) return { success: false };
    
    values.push(new Date().toISOString());
    updates.push('updated_at = ?');
    values.push(id);
    
    return await this.db.prepare(`
      UPDATE feeds SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
  }

  async deleteFeed(id) {
    return await this.db.prepare('DELETE FROM feeds WHERE id = ?').bind(id).run();
  }

  generateSlug(feedUrl, targetLanguage, secretKey = 'default-secret') {
    // Simple slug generation - in production, use crypto.subtle for UUID5
    const text = `${feedUrl}:${targetLanguage}:${secretKey}`;
    return text.replace(/[^a-zA-Z0-9]/g, '').substring(0, 32).toLowerCase();
  }

  // Agent methods
  async getAgents() {
    return await this.db.prepare('SELECT * FROM agents ORDER BY name').all();
  }

  async getAgentById(id) {
    return await this.db.prepare('SELECT * FROM agents WHERE id = ?').bind(id).first();
  }

  async createAgent(data) {
    return await this.db.prepare(`
      INSERT INTO agents (name, type, config, valid, is_ai)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      data.name,
      data.type,
      JSON.stringify(data.config || {}),
      data.valid ? 1 : 0,
      data.is_ai ? 1 : 0
    ).run();
  }

  // Entry methods
  async getEntriesByFeedId(feedId, limit = 50) {
    return await this.db.prepare(`
      SELECT * FROM entries 
      WHERE feed_id = ? 
      ORDER BY published DESC 
      LIMIT ?
    `).bind(feedId, limit).all();
  }

  async createEntry(data) {
    return await this.db.prepare(`
      INSERT INTO entries (
        feed_id, title, translated_title, link, author, 
        summary, content, translated_content, published, guid
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      data.feed_id,
      data.title || '',
      data.translated_title || '',
      data.link || '',
      data.author || '',
      data.summary || '',
      data.content || '',
      data.translated_content || '',
      data.published || new Date().toISOString(),
      data.guid || ''
    ).run();
  }

  async updateEntry(id, data) {
    const updates = [];
    const values = [];
    
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    if (updates.length === 0) return { success: false };
    
    values.push(new Date().toISOString());
    updates.push('updated_at = ?');
    values.push(id);
    
    return await this.db.prepare(`
      UPDATE entries SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();
  }
}