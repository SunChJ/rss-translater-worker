import { Hono } from 'hono';
import { Database } from '../models/database.js';

export const adminRoutes = new Hono();

// Simple admin dashboard
adminRoutes.get('/', async (c) => {
  try {
    // Check if database binding exists
    if (!c.env.DB) {
      return c.html(`
        <h1>Configuration Required</h1>
        <p>D1 Database binding is not configured. Please:</p>
        <ol>
          <li>Create a D1 database in Cloudflare Dashboard</li>
          <li>Add D1 binding with variable name "DB"</li>
          <li>Refresh this page</li>
        </ol>
        <p><a href="/admin/db-status">Check Database Status</a></p>
      `, 500);
    }

    const db = new Database(c.env.DB);
    
    // Get basic statistics
    const feedCount = await db.db.prepare('SELECT COUNT(*) as count FROM feeds').first();
    const agentCount = await db.db.prepare('SELECT COUNT(*) as count FROM agents').first();
    const entryCount = await db.db.prepare('SELECT COUNT(*) as count FROM entries').first();
    
    const recentFeeds = await db.getFeeds(10, 0);
    const agents = await db.getAgents();
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RSS Translator Admin</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5; 
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header { 
            border-bottom: 1px solid #eee; 
            padding-bottom: 20px; 
            margin-bottom: 20px; 
        }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .stat-card { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 8px; 
            text-align: center; 
        }
        .stat-number { 
            font-size: 2em; 
            font-weight: bold; 
            color: #007bff; 
        }
        .stat-label { 
            color: #666; 
            margin-top: 5px; 
        }
        .section { 
            margin-bottom: 30px; 
        }
        .section h2 { 
            border-bottom: 2px solid #007bff; 
            padding-bottom: 10px; 
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
        }
        th, td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid #ddd; 
        }
        th { 
            background: #f8f9fa; 
            font-weight: 600; 
        }
        .status-active { 
            color: #28a745; 
            font-weight: bold; 
        }
        .status-inactive { 
            color: #dc3545; 
            font-weight: bold; 
        }
        .nav { 
            margin-bottom: 20px; 
        }
        .nav a { 
            margin-right: 20px; 
            color: #007bff; 
            text-decoration: none; 
            padding: 8px 16px; 
            border: 1px solid #007bff; 
            border-radius: 4px; 
        }
        .nav a:hover { 
            background: #007bff; 
            color: white; 
        }
        .truncate { 
            max-width: 300px; 
            white-space: nowrap; 
            overflow: hidden; 
            text-overflow: ellipsis; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>RSS Translator Admin Dashboard</h1>
            <div class="nav">
                <a href="/admin/">Dashboard</a>
                <a href="/api/feeds">API: Feeds</a>
                <a href="/api/agents">API: Agents</a>
                <a href="/api/stats">API: Stats</a>
                <a href="/api/health">Health Check</a>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${feedCount.count}</div>
                <div class="stat-label">Feeds</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${agentCount.count}</div>
                <div class="stat-label">Agents</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${entryCount.count}</div>
                <div class="stat-label">Entries</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${agents.results?.filter(a => a.valid).length || 0}</div>
                <div class="stat-label">Active Agents</div>
            </div>
        </div>
        
        <div class="section">
            <h2>Recent Feeds</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>URL</th>
                        <th>Language</th>
                        <th>Status</th>
                        <th>Last Fetch</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentFeeds.results?.map(feed => `
                        <tr>
                            <td class="truncate">${feed.name || 'Unnamed'}</td>
                            <td class="truncate">${feed.feed_url}</td>
                            <td>${feed.target_language}</td>
                            <td class="${feed.fetch_status ? 'status-active' : 'status-inactive'}">
                                ${feed.fetch_status ? 'Active' : 'Error'}
                            </td>
                            <td>${feed.last_fetch ? new Date(feed.last_fetch).toLocaleString() : 'Never'}</td>
                            <td>
                                <a href="/feeds/${feed.slug}.rss">RSS</a> |
                                <a href="/feeds/${feed.slug}/info">Info</a>
                            </td>
                        </tr>
                    `).join('') || '<tr><td colspan="6">No feeds found</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>Translation Agents</h2>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>AI Capable</th>
                        <th>Status</th>
                        <th>Last Updated</th>
                    </tr>
                </thead>
                <tbody>
                    ${agents.results?.map(agent => `
                        <tr>
                            <td>${agent.name}</td>
                            <td>${agent.type}</td>
                            <td>${agent.is_ai ? 'Yes' : 'No'}</td>
                            <td class="${agent.valid ? 'status-active' : 'status-inactive'}">
                                ${agent.valid ? 'Valid' : 'Invalid'}
                            </td>
                            <td>${agent.updated_at ? new Date(agent.updated_at).toLocaleString() : 'Unknown'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="5">No agents found</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h2>Quick Actions</h2>
            <p>Use the API endpoints to manage feeds and agents:</p>
            <ul>
                <li><strong>Create Feed:</strong> POST /api/feeds</li>
                <li><strong>Update Feed:</strong> PUT /api/feeds/:id</li>
                <li><strong>Manual Update:</strong> POST /api/feeds/:id/update</li>
                <li><strong>Create Agent:</strong> POST /api/agents</li>
                <li><strong>Test Agent:</strong> POST /api/agents/:id/test</li>
                <li><strong>Validate Agent:</strong> POST /api/agents/:id/validate</li>
            </ul>
        </div>
    </div>
</body>
</html>`;

    return c.html(html);
  } catch (error) {
    console.error('Admin dashboard failed:', error);
    return c.html(`
      <h1>Error</h1>
      <p>Failed to load admin dashboard: ${error.message}</p>
    `, 500);
  }
});

// Initialize database endpoint
adminRoutes.post('/init', async (c) => {
  try {
    const db = new Database(c.env.DB);
    await db.init();
    
    return c.json({ 
      message: 'Database initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database initialization failed:', error);
    return c.json({ 
      error: 'Database initialization failed',
      details: error.message 
    }, 500);
  }
});

// Database status endpoint
adminRoutes.get('/db-status', async (c) => {
  try {
    // Check bindings
    const status = {
      database_binding: !!c.env.DB,
      cache_binding: !!c.env.CACHE,
      bindings_status: 'incomplete'
    };

    if (!c.env.DB) {
      return c.json({
        ...status,
        error: 'D1 Database binding "DB" is missing',
        instructions: {
          step1: 'Create D1 database in Cloudflare Dashboard',
          step2: 'Go to Worker Settings > Variables',
          step3: 'Add D1 database binding: Variable name = "DB"',
          step4: 'Add KV namespace binding: Variable name = "CACHE"'
        }
      }, 500);
    }

    const db = new Database(c.env.DB);
    
    // Check if tables exist
    const tables = await db.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    const tableNames = tables.results?.map(t => t.name) || [];
    
    return c.json({
      database_connected: true,
      tables: tableNames,
      tables_count: tableNames.length,
      expected_tables: ['feeds', 'agents', 'entries', 'tags', 'feed_tags', 'filters', 'feed_filters'],
      status: tableNames.length >= 7 ? 'initialized' : 'needs_initialization'
    });
  } catch (error) {
    console.error('Database status check failed:', error);
    return c.json({
      database_connected: false,
      error: error.message,
      status: 'error'
    }, 500);
  }
});