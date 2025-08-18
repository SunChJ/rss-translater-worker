import { Hono } from 'hono';
import { Database } from '../models/database.js';
import { AgentManager } from '../services/agents.js';
import { FeedProcessor } from '../services/feedProcessor.js';

export const apiRoutes = new Hono();

// Feed management endpoints
apiRoutes.get('/feeds', async (c) => {
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

apiRoutes.post('/feeds', async (c) => {
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

apiRoutes.get('/feeds/:id', async (c) => {
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

apiRoutes.put('/feeds/:id', async (c) => {
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

apiRoutes.delete('/feeds/:id', async (c) => {
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

// Manually trigger feed update
apiRoutes.post('/feeds/:id/update', async (c) => {
  try {
    const { id } = c.req.param();
    const db = new Database(c.env.DB);
    
    const feed = await db.getFeedById(parseInt(id));
    if (!feed) {
      return c.json({ error: 'Feed not found' }, 404);
    }
    
    const agentManager = new AgentManager(c.env);
    const processor = new FeedProcessor(c.env);
    
    const result = await processor.processFeed(feed, agentManager);
    
    if (result.success) {
      // Update feed metadata
      await db.updateFeed(feed.id, result.feedUpdates);
      
      // Save entries
      for (const entry of result.entries || []) {
        await db.createEntry({
          ...entry,
          feed_id: feed.id
        });
      }
      
      return c.json({ 
        message: 'Feed updated successfully',
        entries_processed: result.entries?.length || 0
      });
    } else {
      return c.json({ 
        error: 'Feed update failed',
        details: result.error 
      }, 500);
    }
  } catch (error) {
    console.error('Manual feed update failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Agent management endpoints
apiRoutes.get('/agents', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const agents = await db.getAgents();
    
    // Remove sensitive config data from response
    const safeAgents = agents.results?.map(agent => ({
      ...agent,
      config: agent.config ? JSON.parse(agent.config) : {},
      // Remove sensitive fields
      api_key: undefined
    })) || [];
    
    return c.json({ agents: safeAgents });
  } catch (error) {
    console.error('API agents listing failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

apiRoutes.post('/agents', async (c) => {
  try {
    const data = await c.req.json();
    const db = new Database(c.env.DB);
    
    // Validate required fields
    if (!data.name || !data.type) {
      return c.json({ error: 'name and type are required' }, 400);
    }
    
    // Create and validate agent
    const agentManager = new AgentManager(c.env);
    const agent = agentManager.createAgent(data.type, data.config || {});
    
    const isValid = await agent.validate();
    
    const result = await db.createAgent({
      ...data,
      valid: isValid,
      is_ai: agent.isAI
    });
    
    if (result.success) {
      const newAgent = await db.getAgentById(result.meta.last_row_id);
      return c.json({ 
        agent: newAgent,
        validation_result: isValid
      }, 201);
    } else {
      return c.json({ error: 'Failed to create agent' }, 500);
    }
  } catch (error) {
    console.error('API agent creation failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Test agent endpoint
apiRoutes.post('/agents/:id/test', async (c) => {
  try {
    const { id } = c.req.param();
    const { text = 'Hello, world!', target_language = 'Chinese Simplified' } = await c.req.json();
    
    const db = new Database(c.env.DB);
    const agentData = await db.getAgentById(parseInt(id));
    
    if (!agentData) {
      return c.json({ error: 'Agent not found' }, 404);
    }
    
    const agentManager = new AgentManager(c.env);
    const agent = agentManager.createAgent(agentData.type, {
      ...JSON.parse(agentData.config || '{}'),
      name: agentData.name
    });
    
    const result = await agent.translate(text, target_language);
    
    return c.json({
      test_result: result,
      agent_name: agentData.name,
      agent_type: agentData.type
    });
  } catch (error) {
    console.error('Agent test failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Validate agent
apiRoutes.post('/agents/:id/validate', async (c) => {
  try {
    const { id } = c.req.param();
    const db = new Database(c.env.DB);
    
    const agentData = await db.getAgentById(parseInt(id));
    if (!agentData) {
      return c.json({ error: 'Agent not found' }, 404);
    }
    
    const agentManager = new AgentManager(c.env);
    const agent = agentManager.createAgent(agentData.type, {
      ...JSON.parse(agentData.config || '{}'),
      name: agentData.name
    });
    
    const isValid = await agent.validate();
    
    // Update agent validation status
    await db.db.prepare('UPDATE agents SET valid = ?, updated_at = ? WHERE id = ?')
      .bind(isValid ? 1 : 0, new Date().toISOString(), parseInt(id))
      .run();
    
    return c.json({ 
      valid: isValid,
      agent_name: agentData.name,
      agent_type: agentData.type
    });
  } catch (error) {
    console.error('Agent validation failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Statistics endpoint
apiRoutes.get('/stats', async (c) => {
  try {
    const db = new Database(c.env.DB);
    
    const feedCount = await db.db.prepare('SELECT COUNT(*) as count FROM feeds').first();
    const agentCount = await db.db.prepare('SELECT COUNT(*) as count FROM agents').first();
    const entryCount = await db.db.prepare('SELECT COUNT(*) as count FROM entries').first();
    
    const totalTokens = await db.db.prepare('SELECT SUM(total_tokens) as total FROM feeds').first();
    const totalCharacters = await db.db.prepare('SELECT SUM(total_characters) as total FROM feeds').first();
    
    const recentFeeds = await db.db.prepare(`
      SELECT COUNT(*) as count FROM feeds 
      WHERE last_fetch > datetime('now', '-24 hours')
    `).first();
    
    return c.json({
      feeds: {
        total: feedCount.count,
        updated_24h: recentFeeds.count
      },
      agents: {
        total: agentCount.count
      },
      entries: {
        total: entryCount.count
      },
      usage: {
        total_tokens: totalTokens.total || 0,
        total_characters: totalCharacters.total || 0
      }
    });
  } catch (error) {
    console.error('Stats retrieval failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Health check endpoint
apiRoutes.get('/health', async (c) => {
  try {
    // Test database connection
    const db = new Database(c.env.DB);
    await db.db.prepare('SELECT 1').first();
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'ok',
        cache: c.env.CACHE ? 'ok' : 'not configured'
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }, 503);
  }
});