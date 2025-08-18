import { Hono } from 'hono';
import { Database } from '../models/database.js';
import { AgentManager } from '../services/agents.js';
import { FeedProcessor } from '../services/feedProcessor.js';
import { TranslationQueue } from '../services/translationQueue.js';

const api = new Hono();

// 获取翻译进度
api.get('/translation/progress', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const translationQueue = new TranslationQueue(3);
    
    // 获取当前翻译状态
    const status = translationQueue.getStatus();
    
    // 获取正在处理的Feed信息
    const activeFeeds = await db.db.prepare(`
      SELECT id, name, feed_url, last_fetch, fetch_status 
      FROM feeds 
      WHERE fetch_status = true 
      ORDER BY last_fetch DESC 
      LIMIT 10
    `).all();
    
    return c.json({
      success: true,
      queue: status,
      activeFeeds: activeFeeds.results || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get translation progress:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// 获取特定Feed的翻译进度
api.get('/translation/progress/:feedId', async (c) => {
  try {
    const feedId = c.req.param('feedId');
    const db = new Database(c.env.DB);
    
    // 获取Feed信息
    const feed = await db.getFeedById(feedId);
    if (!feed) {
      return c.json({ 
        success: false, 
        error: 'Feed not found' 
      }, 404);
    }
    
    // 获取Feed的条目统计
    const entryStats = await db.db.prepare(`
      SELECT 
        COUNT(*) as total_entries,
        COUNT(CASE WHEN translated_title != '' OR translated_content != '' THEN 1 END) as translated_entries,
        SUM(tokens_used) as total_tokens,
        SUM(characters_used) as total_characters
      FROM entries 
      WHERE feed_id = ?
    `).bind(feedId).first();
    
    // 获取最近的条目
    const recentEntries = await db.db.prepare(`
      SELECT 
        title, 
        translated_title, 
        translated_content,
        tokens_used,
        characters_used,
        created_at
      FROM entries 
      WHERE feed_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `).bind(feedId).all();
    
    return c.json({
      success: true,
      feed: {
        id: feed.id,
        name: feed.name,
        feed_url: feed.feed_url,
        last_fetch: feed.last_fetch,
        fetch_status: feed.fetch_status
      },
      statistics: entryStats,
      recentEntries: recentEntries.results || [],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get feed translation progress:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// 手动触发Feed翻译
api.post('/translation/translate/:feedId', async (c) => {
  try {
    const feedId = c.req.param('feedId');
    const { updateSingleFeed } = await import('../services/feedUpdater.js');
    
    const result = await updateSingleFeed(feedId, c.env);
    
    return c.json({
      success: true,
      message: 'Translation started successfully',
      result
    });
  } catch (error) {
    console.error('Failed to start translation:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// 获取翻译队列状态
api.get('/translation/queue/status', async (c) => {
  try {
    const translationQueue = new TranslationQueue(3);
    const status = translationQueue.getStatus();
    
    return c.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to get queue status:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// 测试翻译代理
api.post('/translation/test-agent', async (c) => {
  try {
    const body = await c.req.json();
    const { agentType, config, testText, targetLanguage } = body;
    
    if (!agentType || !config || !testText || !targetLanguage) {
      return c.json({ 
        success: false, 
        error: 'Missing required parameters' 
      }, 400);
    }
    
    const agentManager = new AgentManager(c.env);
    const agent = agentManager.createAgent(agentType, config);
    
    // 测试翻译
    const result = await agent.translate(testText, targetLanguage, {
      textType: 'content'
    });
    
    return c.json({
      success: true,
      result,
      agent: {
        type: agentType,
        name: agent.name,
        valid: agent.valid
      }
    });
  } catch (error) {
    console.error('Agent test failed:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// Feed management endpoints
api.get('/feeds', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;
    
    const feeds = await db.getFeeds(limit, offset);
    
    return c.json({
      feeds: feeds.results || [],
      pagination: {
        page,
        limit,
        total: feeds.results?.length || 0
      }
    });
  } catch (error) {
    console.error('API feeds listing failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.post('/feeds', async (c) => {
  try {
    const data = await c.req.json();
    const db = new Database(c.env.DB);
    
    // Validate required fields
    if (!data.feed_url) {
      return c.json({ error: 'feed_url is required' }, 400);
    }
    
    // Check if feed already exists
    const existingFeed = await db.db.prepare(
      'SELECT id FROM feeds WHERE feed_url = ? AND target_language = ?'
    ).bind(data.feed_url, data.target_language || 'Chinese Simplified').first();
    
    if (existingFeed) {
      return c.json({ error: 'Feed already exists for this language' }, 409);
    }
    
    const result = await db.createFeed(data);
    
    if (result.success) {
      const newFeed = await db.getFeedById(result.meta.last_row_id);
      return c.json({ feed: newFeed }, 201);
    } else {
      return c.json({ error: 'Failed to create feed' }, 500);
    }
  } catch (error) {
    console.error('API feed creation failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.get('/feeds/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const db = new Database(c.env.DB);
    
    const feed = await db.getFeedById(parseInt(id));
    if (!feed) {
      return c.json({ error: 'Feed not found' }, 404);
    }
    
    return c.json({ feed });
  } catch (error) {
    console.error('API feed retrieval failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.put('/feeds/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const data = await c.req.json();
    const db = new Database(c.env.DB);
    
    const result = await db.updateFeed(parseInt(id), data);
    
    if (result.changes > 0) {
      const updatedFeed = await db.getFeedById(parseInt(id));
      return c.json({ feed: updatedFeed });
    } else {
      return c.json({ error: 'Feed not found or no changes made' }, 404);
    }
  } catch (error) {
    console.error('API feed update failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.delete('/feeds/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const db = new Database(c.env.DB);
    
    const result = await db.deleteFeed(parseInt(id));
    
    if (result.changes > 0) {
      return c.json({ message: 'Feed deleted successfully' });
    } else {
      return c.json({ error: 'Feed not found' }, 404);
    }
  } catch (error) {
    console.error('API feed deletion failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Agent management endpoints
api.get('/agents', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const agents = await db.getAgents();
    
    return c.json({ agents: agents.results || [] });
  } catch (error) {
    console.error('API agents listing failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.post('/agents', async (c) => {
  try {
    const data = await c.req.json();
    const db = new Database(c.env.DB);
    
    // Validate required fields
    if (!data.name || !data.type) {
      return c.json({ error: 'name and type are required' }, 400);
    }
    
    const result = await db.createAgent(data);
    
    if (result.success) {
      const newAgent = await db.getAgentById(result.meta.last_row_id);
      return c.json({ agent: newAgent }, 201);
    } else {
      return c.json({ error: 'Failed to create agent' }, 500);
    }
  } catch (error) {
    console.error('API agent creation failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.get('/agents/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const db = new Database(c.env.DB);
    
    const agent = await db.getAgentById(parseInt(id));
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }
    
    return c.json({ agent });
  } catch (error) {
    console.error('API agent retrieval failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.put('/agents/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const data = await c.req.json();
    const db = new Database(c.env.DB);
    
    const result = await db.updateAgent(parseInt(id), data);
    
    if (result.changes > 0) {
      const updatedAgent = await db.getAgentById(parseInt(id));
      return c.json({ agent: updatedAgent });
    } else {
      return c.json({ error: 'Agent not found or no changes made' }, 404);
    }
  } catch (error) {
    console.error('API agent update failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.delete('/agents/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const db = new Database(c.env.DB);
    
    const result = await db.deleteAgent(parseInt(id));
    
    if (result.changes > 0) {
      return c.json({ message: 'Agent deleted successfully' });
    } else {
      return c.json({ error: 'Agent not found' }, 404);
    }
  } catch (error) {
    console.error('API agent deletion failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Test agent endpoint
api.post('/agents/:id/test', async (c) => {
  try {
    const { id } = c.req.param();
    const db = new Database(c.env.DB);
    
    const agent = await db.getAgentById(parseInt(id));
    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404);
    }
    
    // Test the agent with a simple translation
    const agentManager = new AgentManager(c.env);
    const agentInstance = agentManager.createAgent(agent.type, {
      ...JSON.parse(agent.config || '{}'),
      name: agent.name,
      valid: agent.valid
    });
    
    const testResult = await agentInstance.translate('Hello world', 'Chinese Simplified');
    
    return c.json({
      success: true,
      agent: agent.name,
      test_text: 'Hello world',
      translated_text: testResult.text,
      tokens_used: testResult.tokens || 0,
      characters_used: testResult.characters || 0
    });
  } catch (error) {
    console.error('API agent test failed:', error);
    return c.json({ 
      success: false,
      error: error.message 
    }, 500);
  }
});

// Entry management endpoints
api.get('/entries', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;
    const feedId = c.req.query('feed_id');
    
    let query = `
      SELECT e.*, f.name as feed_name, f.slug as feed_slug, f.target_language
      FROM entries e
      LEFT JOIN feeds f ON e.feed_id = f.id
    `;
    let params = [];
    
    if (feedId) {
      query += ' WHERE e.feed_id = ?';
      params.push(parseInt(feedId));
    }
    
    query += ' ORDER BY e.published DESC, e.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const entriesResult = await db.db.prepare(query).bind(...params).all();
    
    return c.json({
      entries: entriesResult.results || [],
      pagination: {
        page,
        limit,
        total: entriesResult.results?.length || 0
      }
    });
  } catch (error) {
    console.error('API entries listing failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

api.get('/entries/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const db = new Database(c.env.DB);
    
    const entry = await db.db.prepare(`
      SELECT e.*, f.name as feed_name, f.slug as feed_slug, f.target_language
      FROM entries e
      LEFT JOIN feeds f ON e.feed_id = f.id
      WHERE e.id = ?
    `).bind(parseInt(id)).first();
    
    if (!entry) {
      return c.json({ error: 'Entry not found' }, 404);
    }
    
    return c.json({ entry });
  } catch (error) {
    console.error('API entry retrieval failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// System endpoints
api.get('/health', async (c) => {
  try {
    const db = new Database(c.env.DB);
    
    // Test database connection
    await db.db.prepare('SELECT 1').first();
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message
    }, 500);
  }
});

api.get('/stats', async (c) => {
  try {
    const db = new Database(c.env.DB);
    
    const feedCount = await db.db.prepare('SELECT COUNT(*) as count FROM feeds').first();
    const agentCount = await db.db.prepare('SELECT COUNT(*) as count FROM agents').first();
    const entryCount = await db.db.prepare('SELECT COUNT(*) as count FROM entries').first();
    
    const totalTokens = await db.db.prepare('SELECT SUM(tokens_used) as total FROM entries').first();
    const totalCharacters = await db.db.prepare('SELECT SUM(characters_used) as total FROM entries').first();
    
    return c.json({
      feeds: feedCount.count || 0,
      agents: agentCount.count || 0,
      entries: entryCount.count || 0,
      total_tokens: totalTokens.total || 0,
      total_characters: totalCharacters.total || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('API stats failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export { api as apiRoutes };
