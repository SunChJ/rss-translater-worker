import { Hono } from 'hono';
import { Database } from '../models/database.js';

export const adminRoutes = new Hono();

// Common CSS styles for all pages
const commonStyles = `
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    .header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
    .nav { margin: 20px 0; }
    .nav a { margin-right: 20px; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
    .nav a:hover { background: #0056b3; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-number { font-size: 2em; font-weight: bold; color: #007bff; }
    .stat-label { color: #666; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; }
    .btn { padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; display: inline-block; border: none; cursor: pointer; }
    .btn:hover { background: #0056b3; }
    .btn-success { background: #28a745; }
    .btn-success:hover { background: #1e7e34; }
    .btn-secondary { background: #6c757d; }
    .btn-secondary:hover { background: #545b62; }
    .btn-sm { padding: 4px 8px; font-size: 12px; margin-right: 5px; }
    .alert { padding: 15px; margin: 20px 0; border-radius: 4px; background: #d4edda; color: #155724; }
    .form-group { margin-bottom: 15px; }
    .form-label { display: block; margin-bottom: 5px; font-weight: bold; }
    .form-control { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    .config-section { display: none; margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px; }
`;

// Generate navigation
function getNavigation() {
    return `
        <div class="nav">
            <a href="/admin/">Dashboard</a>
            <a href="/admin/feeds">RSS Feeds</a>
            <a href="/admin/agents">Translation Agents</a>
        </div>
    `;
}

// Simple admin dashboard
adminRoutes.get('/', async (c) => {
  try {
    if (!c.env.DB) {
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head><title>Configuration Required</title><meta charset="UTF-8"><style>${commonStyles}</style></head>
        <body>
            <div class="container">
                <h1>Configuration Required</h1>
                <p>D1 Database binding is not configured.</p>
                <a href="/admin/db-status" class="btn">Check Database Status</a>
            </div>
        </body>
        </html>
      `, 500);
    }

    const db = new Database(c.env.DB);
    const autoInitialized = c.req.header('X-Auto-Initialized') === 'true';
    
    // Get statistics
    const feedCount = await db.db.prepare('SELECT COUNT(*) as count FROM feeds').first();
    const agentCount = await db.db.prepare('SELECT COUNT(*) as count FROM agents').first();
    const entryCount = await db.db.prepare('SELECT COUNT(*) as count FROM entries').first();
    
    const recentFeeds = await db.getFeeds(5, 0);
    const agents = await db.getAgents();
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>RSS Translator Admin</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${commonStyles}</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>RSS Translator Admin</h1>
            ${autoInitialized ? '<div class="alert">✅ Database automatically initialized</div>' : ''}
            ${getNavigation()}
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${feedCount.count}</div>
                <div class="stat-label">RSS Feeds</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${agentCount.count}</div>
                <div class="stat-label">Translation Agents</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${entryCount.count}</div>
                <div class="stat-label">Translated Entries</div>
            </div>
        </div>
        
        <h3>Recent RSS Feeds</h3>
        ${recentFeeds.results?.length > 0 ? `
            <table>
                <thead>
                    <tr><th>Name</th><th>URL</th><th>Language</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${recentFeeds.results.map(feed => `
                        <tr>
                            <td>${feed.name || 'Unnamed'}</td>
                            <td>${feed.feed_url}</td>
                            <td>${feed.target_language}</td>
                            <td>${feed.fetch_status ? '✓ Active' : '✗ Error'}</td>
                            <td>
                                <a href="/feeds/${feed.slug}.rss" class="btn btn-sm" target="_blank">RSS</a>
                                <a href="/admin/feeds" class="btn btn-sm">Manage</a>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p>No RSS feeds found. <a href="/admin/feeds">Add your first feed</a></p>'}
        
        <h3>Translation Agents</h3>
        ${agents.results?.length > 0 ? `
            <table>
                <thead>
                    <tr><th>Name</th><th>Type</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${agents.results.map(agent => `
                        <tr>
                            <td>${agent.name}</td>
                            <td>${agent.type}</td>
                            <td>${agent.valid ? '✓ Valid' : '✗ Invalid'}</td>
                            <td><a href="/admin/agents" class="btn btn-sm">Manage</a></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p>No translation agents found. <a href="/admin/agents">Add your first agent</a></p>'}
    </div>
</body>
</html>`;

    return c.html(html);
  } catch (error) {
    console.error('Admin dashboard failed:', error);
    return c.html(`<h1>Error</h1><p>Failed to load dashboard: ${error.message}</p>`, 500);
  }
});

// RSS Feeds page
adminRoutes.get('/feeds', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const feeds = await db.getFeeds(20, 0);
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>RSS Feeds - RSS Translator Admin</title>
    <meta charset="UTF-8">
    <style>${commonStyles}</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>RSS Feeds Management</h1>
            ${getNavigation()}
            <a href="/admin/feeds/add" class="btn btn-success">Add New Feed</a>
        </div>
        
        ${feeds.results?.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Feed URL</th>
                        <th>Target Language</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${feeds.results.map(feed => `
                        <tr>
                            <td>${feed.name || 'Unnamed'}</td>
                            <td><a href="${feed.feed_url}" target="_blank">${feed.feed_url}</a></td>
                            <td>${feed.target_language}</td>
                            <td>${feed.fetch_status ? '✓ Active' : '✗ Error'}</td>
                            <td>
                                <a href="/feeds/${feed.slug}.rss" class="btn btn-sm" target="_blank">RSS</a>
                                <a href="/admin/feeds/${feed.id}/edit" class="btn btn-sm">Edit</a>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p>No RSS feeds found.</p>'}
    </div>
</body>
</html>`;

    return c.html(html);
  } catch (error) {
    console.error('Feeds page failed:', error);
    return c.html(`<h1>Error</h1><p>Failed to load feeds: ${error.message}</p>`, 500);
  }
});

// Add Feed Form
adminRoutes.get('/feeds/add', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const agents = await db.getAgents();
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Add RSS Feed - RSS Translator Admin</title>
    <meta charset="UTF-8">
    <style>${commonStyles}</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Add New RSS Feed</h1>
            ${getNavigation()}
        </div>
        
        <form method="POST" action="/admin/feeds/add">
            <div class="form-group">
                <label class="form-label">Feed URL *</label>
                <input type="url" name="feed_url" class="form-control" required placeholder="https://example.com/feed.rss">
            </div>
            
            <div class="form-group">
                <label class="form-label">Name (Optional)</label>
                <input type="text" name="name" class="form-control" placeholder="Leave empty to use RSS title">
            </div>
            
            <div class="form-group">
                <label class="form-label">Target Language</label>
                <select name="target_language" class="form-control">
                    <option value="Chinese Simplified" selected>Chinese Simplified</option>
                    <option value="Chinese Traditional">Chinese Traditional</option>
                    <option value="English">English</option>
                    <option value="Japanese">Japanese</option>
                    <option value="Korean">Korean</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Max Posts</label>
                <input type="number" name="max_posts" class="form-control" value="20" min="1" max="100">
            </div>
            
            <div class="form-group">
                <label class="form-label">Translator</label>
                <select name="translator_id" class="form-control">
                    <option value="">Select a translator</option>
                    ${agents.results?.filter(a => a.valid).map(agent => 
                        `<option value="${agent.id}">${agent.name} (${agent.type})</option>`
                    ).join('') || '<option disabled>No valid agents available</option>'}
                </select>
            </div>
            
            <div class="form-group">
                <label><input type="checkbox" name="translate_title"> Translate titles</label><br>
                <label><input type="checkbox" name="translate_content" checked> Translate content</label><br>
                <label><input type="checkbox" name="summary"> Generate AI summary</label>
            </div>
            
            <div style="margin-top: 20px;">
                <button type="submit" class="btn btn-success">Create Feed</button>
                <a href="/admin/feeds" class="btn btn-secondary">Cancel</a>
            </div>
        </form>
    </div>
</body>
</html>`;

    return c.html(html);
  } catch (error) {
    console.error('Add feed form failed:', error);
    return c.html(`<h1>Error</h1><p>Failed to load form: ${error.message}</p>`, 500);
  }
});

// Handle Add Feed Form Submission
adminRoutes.post('/feeds/add', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const body = await c.req.parseBody();
    
    const feedData = {
      name: body.name || '',
      feed_url: body.feed_url,
      target_language: body.target_language || 'Chinese Simplified',
      max_posts: parseInt(body.max_posts) || 20,
      translate_title: body.translate_title === 'on',
      translate_content: body.translate_content === 'on',
      summary: body.summary === 'on',
      translator_id: body.translator_id ? parseInt(body.translator_id) : null,
    };
    
    await db.createFeed(feedData);
    
    return c.redirect('/admin/feeds');
  } catch (error) {
    console.error('Failed to create feed:', error);
    return c.html(`<h1>Error</h1><p>Failed to create feed: ${error.message}</p>`, 500);
  }
});

// Translation Agents page
adminRoutes.get('/agents', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const agents = await db.getAgents();
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Translation Agents - RSS Translator Admin</title>
    <meta charset="UTF-8">
    <style>${commonStyles}</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Translation Agents</h1>
            ${getNavigation()}
            <a href="/admin/agents/add" class="btn btn-success">Add New Agent</a>
        </div>
        
        ${agents.results?.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>AI Capable</th>
                    </tr>
                </thead>
                <tbody>
                    ${agents.results.map(agent => `
                        <tr>
                            <td>${agent.name}</td>
                            <td>${agent.type.toUpperCase()}</td>
                            <td>${agent.valid ? '✓ Valid' : '✗ Invalid'}</td>
                            <td>${agent.is_ai ? '🤖 Yes' : '🔤 No'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p>No translation agents found. <a href="/admin/agents/add">Add your first agent</a></p>'}
    </div>
</body>
</html>`;

    return c.html(html);
  } catch (error) {
    console.error('Agents page failed:', error);
    return c.html(`<h1>Error</h1><p>Failed to load agents: ${error.message}</p>`, 500);
  }
});

// Add Agent Form
adminRoutes.get('/agents/add', async (c) => {
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Add Translation Agent - RSS Translator Admin</title>
    <meta charset="UTF-8">
    <style>
        ${commonStyles}
    </style>
    <script>
        function showConfig(type) {
            document.querySelectorAll('.config-section').forEach(el => el.style.display = 'none');
            if (type) {
                const config = document.getElementById(type + '-config');
                if (config) config.style.display = 'block';
            }
        }
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Add Translation Agent</h1>
            ${getNavigation()}
        </div>
        
        <form method="POST" action="/admin/agents/add">
            <div class="form-group">
                <label class="form-label">Agent Type</label>
                <select name="type" class="form-control" onchange="showConfig(this.value)" required>
                    <option value="">Select agent type</option>
                    <option value="openai">OpenAI (GPT)</option>
                    <option value="deepl">DeepL</option>
                    <option value="test">Test Agent</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Agent Name</label>
                <input type="text" name="name" class="form-control" required placeholder="My OpenAI Agent">
            </div>
            
            <div id="openai-config" class="config-section">
                <h3>OpenAI Configuration</h3>
                <div class="form-group">
                    <label class="form-label">API Key *</label>
                    <input type="password" name="openai_api_key" class="form-control" placeholder="sk-...">
                </div>
                <div class="form-group">
                    <label class="form-label">Model</label>
                    <input type="text" name="openai_model" class="form-control" value="gpt-3.5-turbo">
                </div>
            </div>
            
            <div id="deepl-config" class="config-section">
                <h3>DeepL Configuration</h3>
                <div class="form-group">
                    <label class="form-label">API Key *</label>
                    <input type="password" name="deepl_api_key" class="form-control">
                </div>
            </div>
            
            <div id="test-config" class="config-section">
                <h3>Test Agent</h3>
                <p>This agent will simulate translation for development purposes.</p>
            </div>
            
            <div style="margin-top: 20px;">
                <button type="submit" class="btn btn-success">Create Agent</button>
                <a href="/admin/agents" class="btn btn-secondary">Cancel</a>
            </div>
        </form>
    </div>
</body>
</html>`;
  
  return c.html(html);
});

// Handle Add Agent Form Submission
adminRoutes.post('/agents/add', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const body = await c.req.parseBody();
    
    let config = {};
    let isAI = false;
    
    switch (body.type) {
      case 'openai':
        config = {
          api_key: body.openai_api_key,
          model: body.openai_model || 'gpt-3.5-turbo'
        };
        isAI = true;
        break;
      case 'deepl':
        config = {
          api_key: body.deepl_api_key
        };
        break;
      case 'test':
        config = { mode: 'development' };
        break;
    }
    
    const agentData = {
      name: body.name,
      type: body.type,
      config: config,
      valid: body.type === 'test' || Boolean(config.api_key),
      is_ai: isAI
    };
    
    await db.createAgent(agentData);
    
    return c.redirect('/admin/agents');
  } catch (error) {
    console.error('Failed to create agent:', error);
    return c.html(`<h1>Error</h1><p>Failed to create agent: ${error.message}</p>`, 500);
  }
});

// Database status endpoint
adminRoutes.get('/db-status', async (c) => {
  try {
    const status = {
      database_binding: !!c.env.DB,
      cache_binding: !!c.env.CACHE,
    };

    if (!c.env.DB) {
      return c.json({
        ...status,
        error: 'D1 Database binding "DB" is missing'
      }, 500);
    }

    const db = new Database(c.env.DB);
    
    const tables = await db.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    return c.json({
      database_connected: true,
      tables: tables.results?.map(t => t.name) || [],
      status: 'ok'
    });
  } catch (error) {
    return c.json({
      database_connected: false,
      error: error.message,
      status: 'error'
    }, 500);
  }
});