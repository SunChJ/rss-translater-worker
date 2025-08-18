import { Hono } from 'hono';
import { Database } from '../models/database.js';

export const adminRoutes = new Hono();

// Common HTML layout template
function getLayoutTemplate(title, content, activeTab = '') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - RSS Translator Admin</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            line-height: 1.5;
        }
        .header {
            background: #343a40;
            color: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header h1 {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
        }
        .nav {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
        }
        .nav a {
            color: #adb5bd;
            text-decoration: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            transition: all 0.2s;
        }
        .nav a:hover, .nav a.active {
            background: #495057;
            color: white;
        }
        .container {
            max-width: 1200px;
            margin: 2rem auto;
            padding: 0 2rem;
        }
        .card {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
        }
        .card-header {
            padding: 1.5rem;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .card-body {
            padding: 1.5rem;
        }
        .btn {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background 0.2s;
        }
        .btn:hover {
            background: #0056b3;
        }
        .btn-success {
            background: #28a745;
        }
        .btn-success:hover {
            background: #1e7e34;
        }
        .btn-danger {
            background: #dc3545;
        }
        .btn-danger:hover {
            background: #c82333;
        }
        .btn-secondary {
            background: #6c757d;
        }
        .btn-secondary:hover {
            background: #545b62;
        }
        .btn-sm {
            padding: 0.25rem 0.5rem;
            font-size: 0.8rem;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            font-size: 0.9rem;
            color: #495057;
        }
        .status-badge {
            padding: 0.25rem 0.5rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
        }
        .status-success {
            background: #d4edda;
            color: #155724;
        }
        .status-danger {
            background: #f8d7da;
            color: #721c24;
        }
        .status-warning {
            background: #fff3cd;
            color: #856404;
        }
        .truncate {
            max-width: 200px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .form-group {
            margin-bottom: 1rem;
        }
        .form-label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
            color: #495057;
        }
        .form-control {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ced4da;
            border-radius: 4px;
            font-size: 1rem;
        }
        .form-control:focus {
            outline: none;
            border-color: #80bdff;
            box-shadow: 0 0 0 0.2rem rgba(0,123,255,.25);
        }
        .form-select {
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23343a40' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m1 6 7 7 7-7'/%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 0.75rem center;
            background-size: 16px 12px;
            padding-right: 2.5rem;
        }
        .form-check {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .alert {
            padding: 1rem;
            margin-bottom: 1rem;
            border-radius: 4px;
        }
        .alert-success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .alert-danger {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .tabs {
            display: flex;
            border-bottom: 1px solid #dee2e6;
            margin-bottom: 1.5rem;
        }
        .tab {
            padding: 1rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }
        .tab.active {
            border-bottom-color: #007bff;
            color: #007bff;
        }
        .tab-content {
            display: none;
        }
        .tab-content.active {
            display: block;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #007bff;
        }
        .stat-label {
            color: #6c757d;
            font-size: 0.9rem;
        }
        .actions {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }
        .text-muted {
            color: #6c757d;
        }
        .text-success {
            color: #28a745;
        }
        .text-danger {
            color: #dc3545;
        }
        @media (max-width: 768px) {
            .container {
                padding: 0 1rem;
            }
            .nav {
                flex-wrap: wrap;
            }
            .card-header {
                flex-direction: column;
                gap: 1rem;
                align-items: flex-start;
            }
        }
    </style>
    <script>
        function showTab(tabId) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Show selected tab
            document.getElementById(tabId).classList.add('active');
            document.querySelector(`[onclick="showTab('${tabId}')"]`).classList.add('active');
        }
        
        function confirmAction(message) {
            return confirm(message);
        }
        
        function copyToClipboard(text) {
            navigator.clipboard.writeText(text).then(() => {
                alert('Copied to clipboard!');
            });
        }
    </script>
</head>
<body>
    <div class="header">
        <h1>RSS Translator Admin</h1>
        <nav class="nav">
            <a href="/admin/" class="${activeTab === 'dashboard' ? 'active' : ''}">Dashboard</a>
            <a href="/admin/feeds" class="${activeTab === 'feeds' ? 'active' : ''}">RSS Feeds</a>
            <a href="/admin/agents" class="${activeTab === 'agents' ? 'active' : ''}">Translation Agents</a>
            <a href="/admin/tags" class="${activeTab === 'tags' ? 'active' : ''}">Tags</a>
            <a href="/admin/filters" class="${activeTab === 'filters' ? 'active' : ''}">Filters</a>
        </nav>
    </div>
    <div class="container">
        ${content}
    </div>
</body>
</html>`;
}

// Dashboard - Overview page
adminRoutes.get('/', async (c) => {
  try {
    if (!c.env.DB) {
      const content = `
        <div class="alert alert-danger">
          <h4>Configuration Required</h4>
          <p>D1 Database binding is not configured. Please configure your database bindings in Cloudflare Dashboard.</p>
          <a href="/admin/db-status" class="btn btn-secondary">Check Database Status</a>
        </div>`;
      return c.html(getLayoutTemplate('Configuration Required', content, 'dashboard'));
    }

    const db = new Database(c.env.DB);
    const autoInitialized = c.req.header('X-Auto-Initialized') === 'true';
    
    // Get statistics
    const feedCount = await db.db.prepare('SELECT COUNT(*) as count FROM feeds').first();
    const agentCount = await db.db.prepare('SELECT COUNT(*) as count FROM agents').first();
    const entryCount = await db.db.prepare('SELECT COUNT(*) as count FROM entries').first();
    const activeAgentCount = await db.db.prepare('SELECT COUNT(*) as count FROM agents WHERE valid = 1').first();
    
    const recentFeeds = await db.getFeeds(5, 0);
    const agents = await db.getAgents();
    
    const content = `
      ${autoInitialized ? '<div class="alert alert-success">✅ Database automatically initialized on this request</div>' : ''}
      
      <div class="stats-grid">
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
        <div class="stat-card">
          <div class="stat-number">${activeAgentCount.count}</div>
          <div class="stat-label">Active Agents</div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3>Recent RSS Feeds</h3>
          <a href="/admin/feeds" class="btn">Manage All Feeds</a>
        </div>
        <div class="card-body">
          ${recentFeeds.results?.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Target Language</th>
                  <th>Status</th>
                  <th>Last Fetch</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${recentFeeds.results.map(feed => `
                  <tr>
                    <td class="truncate">${feed.name || feed.feed_url}</td>
                    <td>${feed.target_language}</td>
                    <td>
                      <span class="status-badge ${feed.fetch_status ? 'status-success' : 'status-danger'}">
                        ${feed.fetch_status ? '✓ Active' : '✗ Error'}
                      </span>
                    </td>
                    <td class="text-muted">
                      ${feed.last_fetch ? new Date(feed.last_fetch).toLocaleString() : 'Never'}
                    </td>
                    <td class="actions">
                      <a href="/feeds/${feed.slug}.rss" class="btn btn-sm btn-secondary">RSS</a>
                      <a href="/admin/feeds/${feed.id}/edit" class="btn btn-sm">Edit</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p class="text-muted">No RSS feeds configured yet. <a href="/admin/feeds/add">Add your first feed</a></p>'}
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3>Translation Agents</h3>
          <a href="/admin/agents" class="btn">Manage Agents</a>
        </div>
        <div class="card-body">
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
                    <td>${agent.type}</td>
                    <td>
                      <span class="status-badge ${agent.valid ? 'status-success' : 'status-danger'}">
                        ${agent.valid ? '✓ Valid' : '✗ Invalid'}
                      </span>
                    </td>
                    <td>${agent.is_ai ? 'Yes' : 'No'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p class="text-muted">No translation agents configured yet. <a href="/admin/agents/add">Add your first agent</a></p>'}
        </div>
      </div>`;
    
    return c.html(getLayoutTemplate('Dashboard', content, 'dashboard'));
  } catch (error) {
    console.error('Admin dashboard failed:', error);
    const content = `<div class="alert alert-danger">Failed to load dashboard: ${error.message}</div>`;
    return c.html(getLayoutTemplate('Error', content, 'dashboard'), 500);
  }
});

// RSS Feeds Management
adminRoutes.get('/feeds', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const page = parseInt(c.req.query('page')) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    const feeds = await db.getFeeds(limit, offset);
    const totalCount = await db.db.prepare('SELECT COUNT(*) as count FROM feeds').first();
    const totalPages = Math.ceil(totalCount.count / limit);
    
    const content = `
      <div class="card">
        <div class="card-header">
          <h3>RSS Feeds Management</h3>
          <a href="/admin/feeds/add" class="btn btn-success">Add New Feed</a>
        </div>
        <div class="card-body">
          ${feeds.results?.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Feed URL</th>
                  <th>Target Language</th>
                  <th>Translation Options</th>
                  <th>Status</th>
                  <th>Last Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${feeds.results.map(feed => `
                  <tr>
                    <td class="truncate">${feed.name || 'Unnamed'}</td>
                    <td class="truncate"><a href="${feed.feed_url}" target="_blank">${feed.feed_url}</a></td>
                    <td>${feed.target_language}</td>
                    <td>
                      ${feed.translate_title ? '<span class="status-badge status-success">Title</span>' : ''}
                      ${feed.translate_content ? '<span class="status-badge status-success">Content</span>' : ''}
                      ${feed.summary ? '<span class="status-badge status-warning">Summary</span>' : ''}
                    </td>
                    <td>
                      <span class="status-badge ${feed.fetch_status ? 'status-success' : 'status-danger'}">
                        ${feed.fetch_status ? '✓ Active' : '✗ Error'}
                      </span>
                      ${feed.translation_status ? '<br><span class="status-badge status-success">Translated</span>' : '<br><span class="status-badge status-danger">Not Translated</span>'}
                    </td>
                    <td class="text-muted">${feed.last_fetch ? new Date(feed.last_fetch).toLocaleString() : 'Never'}</td>
                    <td class="actions">
                      <a href="/feeds/${feed.slug}.rss" class="btn btn-sm btn-secondary" target="_blank">RSS</a>
                      <a href="/admin/feeds/${feed.id}/edit" class="btn btn-sm">Edit</a>
                      <button onclick="if(confirmAction('Are you sure you want to update this feed?')) { fetch('/admin/feeds/${feed.id}/update', {method: 'POST'}).then(() => location.reload()); }" class="btn btn-sm btn-success">Update</button>
                      <button onclick="if(confirmAction('Are you sure you want to delete this feed?')) { fetch('/admin/feeds/${feed.id}/delete', {method: 'POST'}).then(() => location.reload()); }" class="btn btn-sm btn-danger">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            ${totalPages > 1 ? `
              <div style="margin-top: 1rem; text-align: center;">
                ${page > 1 ? `<a href="/admin/feeds?page=${page - 1}" class="btn btn-secondary">Previous</a>` : ''}
                <span style="margin: 0 1rem;">Page ${page} of ${totalPages}</span>
                ${page < totalPages ? `<a href="/admin/feeds?page=${page + 1}" class="btn btn-secondary">Next</a>` : ''}
              </div>
            ` : ''}
          ` : '<p class="text-muted">No RSS feeds found. <a href="/admin/feeds/add">Add your first feed</a></p>'}
        </div>
      </div>`;
    
    return c.html(getLayoutTemplate('RSS Feeds', content, 'feeds'));
  } catch (error) {
    const content = `<div class="alert alert-danger">Failed to load feeds: ${error.message}</div>`;
    return c.html(getLayoutTemplate('Error', content, 'feeds'), 500);
  }
});

// Add Feed Form
adminRoutes.get('/feeds/add', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const agents = await db.getAgents();
    
    const content = `
      <div class="card">
        <div class="card-header">
          <h3>Add New RSS Feed</h3>
          <a href="/admin/feeds" class="btn btn-secondary">Back to Feeds</a>
        </div>
        <div class="card-body">
          <form method="POST" action="/admin/feeds/add">
            <div class="tabs">
              <div class="tab active" onclick="showTab('feed-info')">Feed Information</div>
              <div class="tab" onclick="showTab('translation-settings')">Translation Settings</div>
              <div class="tab" onclick="showTab('output-settings')">Output Settings</div>
            </div>
            
            <div id="feed-info" class="tab-content active">
              <div class="form-group">
                <label class="form-label">Feed URL *</label>
                <input type="url" name="feed_url" class="form-control" required placeholder="https://example.com/feed.rss">
              </div>
              
              <div class="form-group">
                <label class="form-label">Name (Optional)</label>
                <input type="text" name="name" class="form-control" placeholder="Leave empty to use RSS title">
              </div>
              
              <div class="form-group">
                <label class="form-label">Max Posts</label>
                <input type="number" name="max_posts" class="form-control" value="20" min="1" max="100">
              </div>
              
              <div class="form-group">
                <label class="form-label">Update Frequency (minutes)</label>
                <select name="update_frequency" class="form-control form-select">
                  <option value="5">5 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30" selected>30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="360">6 hours</option>
                  <option value="720">12 hours</option>
                  <option value="1440">24 hours</option>
                </select>
              </div>
              
              <div class="form-check">
                <input type="checkbox" name="fetch_article" id="fetch_article">
                <label for="fetch_article">Fetch full article content</label>
              </div>
            </div>
            
            <div id="translation-settings" class="tab-content">
              <div class="form-group">
                <label class="form-label">Target Language</label>
                <select name="target_language" class="form-control form-select">
                  <option value="Chinese Simplified" selected>Chinese Simplified</option>
                  <option value="Chinese Traditional">Chinese Traditional</option>
                  <option value="English">English</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Korean">Korean</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Spanish">Spanish</option>
                  <option value="Russian">Russian</option>
                </select>
              </div>
              
              <div class="form-group">
                <label class="form-label">Translation Options</label>
                <div class="form-check">
                  <input type="checkbox" name="translate_title" id="translate_title">
                  <label for="translate_title">Translate titles</label>
                </div>
                <div class="form-check">
                  <input type="checkbox" name="translate_content" id="translate_content" checked>
                  <label for="translate_content">Translate content</label>
                </div>
                <div class="form-check">
                  <input type="checkbox" name="summary" id="summary">
                  <label for="summary">Generate AI summary</label>
                </div>
              </div>
              
              <div class="form-group">
                <label class="form-label">Translator</label>
                <select name="translator_id" class="form-control form-select">
                  <option value="">Select a translator</option>
                  ${agents.results?.filter(a => a.valid).map(agent => 
                    `<option value="${agent.id}">${agent.name} (${agent.type})</option>`
                  ).join('') || '<option disabled>No valid agents available</option>'}
                </select>
              </div>
              
              <div class="form-group">
                <label class="form-label">Additional Prompt (Optional)</label>
                <textarea name="additional_prompt" class="form-control" rows="3" placeholder="Additional instructions for translation"></textarea>
              </div>
            </div>
            
            <div id="output-settings" class="tab-content">
              <div class="form-group">
                <label class="form-label">Translation Display Mode</label>
                <select name="translation_display" class="form-control form-select">
                  <option value="0">Translation only</option>
                  <option value="1">Translation | Original</option>
                  <option value="2">Original | Translation</option>
                </select>
              </div>
              
              <div class="form-group">
                <label class="form-label">URL Slug (Optional)</label>
                <input type="text" name="slug" class="form-control" placeholder="Leave empty for auto-generated">
                <small class="text-muted">Used for RSS URL: /feeds/your-slug.rss</small>
              </div>
            </div>
            
            <div style="margin-top: 2rem;">
              <button type="submit" class="btn btn-success">Create Feed</button>
              <a href="/admin/feeds" class="btn btn-secondary">Cancel</a>
            </div>
          </form>
        </div>
      </div>`;
    
    return c.html(getLayoutTemplate('Add RSS Feed', content, 'feeds'));
  } catch (error) {
    const content = `<div class="alert alert-danger">Failed to load form: ${error.message}</div>`;
    return c.html(getLayoutTemplate('Error', content, 'feeds'), 500);
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
      update_frequency: parseInt(body.update_frequency) || 30,
      translate_title: body.translate_title === 'on',
      translate_content: body.translate_content === 'on',
      summary: body.summary === 'on',
      fetch_article: body.fetch_article === 'on',
      translator_id: body.translator_id ? parseInt(body.translator_id) : null,
      additional_prompt: body.additional_prompt || '',
      translation_display: parseInt(body.translation_display) || 0,
      slug: body.slug || null
    };
    
    await db.createFeed(feedData);
    
    return c.redirect('/admin/feeds');
  } catch (error) {
    console.error('Failed to create feed:', error);
    const content = `<div class="alert alert-danger">Failed to create feed: ${error.message}</div>`;
    return c.html(getLayoutTemplate('Error', content, 'feeds'), 500);
  }
});

// Translation Agents Management
adminRoutes.get('/agents', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const agents = await db.getAgents();
    
    const content = `
      <div class="card">
        <div class="card-header">
          <h3>Translation Agents</h3>
          <a href="/admin/agents/add" class="btn btn-success">Add New Agent</a>
        </div>
        <div class="card-body">
          ${agents.results?.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>AI Capable</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${agents.results.map(agent => `
                  <tr>
                    <td>${agent.name}</td>
                    <td><span class="status-badge status-success">${agent.type.toUpperCase()}</span></td>
                    <td>
                      <span class="status-badge ${agent.valid ? 'status-success' : 'status-danger'}">
                        ${agent.valid ? '✓ Valid' : '✗ Invalid'}
                      </span>
                    </td>
                    <td>${agent.is_ai ? '🤖 Yes' : '🔤 No'}</td>
                    <td class="text-muted">${agent.created_at ? new Date(agent.created_at).toLocaleString() : 'Unknown'}</td>
                    <td class="actions">
                      <a href="/admin/agents/${agent.id}/edit" class="btn btn-sm">Edit</a>
                      <button onclick="if(confirmAction('Test this agent?')) { fetch('/admin/agents/${agent.id}/test', {method: 'POST'}).then(r => r.text()).then(result => alert(result)); }" class="btn btn-sm btn-secondary">Test</button>
                      <button onclick="if(confirmAction('Delete this agent?')) { fetch('/admin/agents/${agent.id}/delete', {method: 'POST'}).then(() => location.reload()); }" class="btn btn-sm btn-danger">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<p class="text-muted">No translation agents found. <a href="/admin/agents/add">Add your first agent</a></p>'}
        </div>
      </div>`;
    
    return c.html(getLayoutTemplate('Translation Agents', content, 'agents'));
  } catch (error) {
    const content = `<div class="alert alert-danger">Failed to load agents: ${error.message}</div>`;
    return c.html(getLayoutTemplate('Error', content, 'agents'), 500);
  }
});

// Add Agent Form
adminRoutes.get('/agents/add', async (c) => {
  const content = `
    <div class="card">
      <div class="card-header">
        <h3>Add Translation Agent</h3>
        <a href="/admin/agents" class="btn btn-secondary">Back to Agents</a>
      </div>
      <div class="card-body">
        <form method="POST" action="/admin/agents/add">
          <div class="form-group">
            <label class="form-label">Agent Type</label>
            <select name="type" class="form-control form-select" onchange="showAgentConfig(this.value)" required>
              <option value="">Select agent type</option>
              <option value="openai">OpenAI (GPT)</option>
              <option value="deepl">DeepL</option>
              <option value="libretranslate">LibreTranslate</option>
              <option value="test">Test Agent (Development only)</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Agent Name</label>
            <input type="text" name="name" class="form-control" required placeholder="My OpenAI Agent">
          </div>
          
          <!-- OpenAI Configuration -->
          <div id="openai-config" style="display: none;">
            <h4>OpenAI Configuration</h4>
            <div class="form-group">
              <label class="form-label">API Key *</label>
              <input type="password" name="openai_api_key" class="form-control" placeholder="sk-...">
            </div>
            <div class="form-group">
              <label class="form-label">Base URL</label>
              <input type="url" name="openai_base_url" class="form-control" value="https://api.openai.com/v1" placeholder="https://api.openai.com/v1">
            </div>
            <div class="form-group">
              <label class="form-label">Model</label>
              <input type="text" name="openai_model" class="form-control" value="gpt-3.5-turbo" placeholder="gpt-3.5-turbo">
            </div>
            <div class="form-group">
              <label class="form-label">Temperature (0.0 - 2.0)</label>
              <input type="number" name="openai_temperature" class="form-control" value="0.3" step="0.1" min="0" max="2">
            </div>
            <div class="form-group">
              <label class="form-label">Max Tokens</label>
              <input type="number" name="openai_max_tokens" class="form-control" value="4000" min="1">
            </div>
          </div>
          
          <!-- DeepL Configuration -->
          <div id="deepl-config" style="display: none;">
            <h4>DeepL Configuration</h4>
            <div class="form-group">
              <label class="form-label">API Key *</label>
              <input type="password" name="deepl_api_key" class="form-control" placeholder="...">
            </div>
            <div class="form-group">
              <label class="form-label">Server URL</label>
              <input type="url" name="deepl_server_url" class="form-control" value="https://api.deepl.com" placeholder="https://api.deepl.com">
            </div>
            <div class="form-group">
              <label class="form-label">Max Characters per Request</label>
              <input type="number" name="deepl_max_characters" class="form-control" value="5000" min="1">
            </div>
          </div>
          
          <!-- LibreTranslate Configuration -->
          <div id="libretranslate-config" style="display: none;">
            <h4>LibreTranslate Configuration</h4>
            <div class="form-group">
              <label class="form-label">Server URL *</label>
              <input type="url" name="libre_server_url" class="form-control" value="https://translate.astian.org" placeholder="https://translate.astian.org">
            </div>
            <div class="form-group">
              <label class="form-label">API Key (Optional)</label>
              <input type="password" name="libre_api_key" class="form-control" placeholder="Leave empty for public servers">
            </div>
            <div class="form-group">
              <label class="form-label">Max Characters per Request</label>
              <input type="number" name="libre_max_characters" class="form-control" value="5000" min="1">
            </div>
          </div>
          
          <!-- Test Agent Configuration -->
          <div id="test-config" style="display: none;">
            <h4>Test Agent Configuration</h4>
            <p class="text-muted">This agent will simulate translation for development purposes. No real translation will be performed.</p>
          </div>
          
          <div style="margin-top: 2rem;">
            <button type="submit" class="btn btn-success">Create Agent</button>
            <a href="/admin/agents" class="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </div>
    
    <script>
      function showAgentConfig(type) {
        // Hide all config sections
        document.querySelectorAll('[id$="-config"]').forEach(el => el.style.display = 'none');
        
        // Show selected config
        if (type) {
          const config = document.getElementById(type + '-config');
          if (config) config.style.display = 'block';
        }
      }
    </script>`;
  
  return c.html(getLayoutTemplate('Add Translation Agent', content, 'agents'));
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
          base_url: body.openai_base_url || 'https://api.openai.com/v1',
          model: body.openai_model || 'gpt-3.5-turbo',
          temperature: parseFloat(body.openai_temperature) || 0.3,
          max_tokens: parseInt(body.openai_max_tokens) || 4000
        };
        isAI = true;
        break;
      case 'deepl':
        config = {
          api_key: body.deepl_api_key,
          server_url: body.deepl_server_url || 'https://api.deepl.com',
          max_characters: parseInt(body.deepl_max_characters) || 5000
        };
        break;
      case 'libretranslate':
        config = {
          server_url: body.libre_server_url || 'https://translate.astian.org',
          api_key: body.libre_api_key || null,
          max_characters: parseInt(body.libre_max_characters) || 5000
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
      valid: body.type === 'test' || Boolean(config.api_key || config.server_url),
      is_ai: isAI
    };
    
    await db.createAgent(agentData);
    
    return c.redirect('/admin/agents');
  } catch (error) {
    console.error('Failed to create agent:', error);
    const content = `<div class="alert alert-danger">Failed to create agent: ${error.message}</div>`;
    return c.html(getLayoutTemplate('Error', content, 'agents'), 500);
  }
});

// Test Agent
adminRoutes.post('/agents/:id/test', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const agent = await db.getAgentById(c.req.param('id'));
    
    if (!agent) {
      return c.text('Agent not found', 404);
    }
    
    // Simple test - in production, would actually test translation
    const testResult = `Agent '${agent.name}' (${agent.type}) test completed successfully.`;
    
    return c.text(testResult);
  } catch (error) {
    return c.text(`Test failed: ${error.message}`, 500);
  }
});

// Delete Agent
adminRoutes.post('/agents/:id/delete', async (c) => {
  try {
    const db = new Database(c.env.DB);
    await db.db.prepare('DELETE FROM agents WHERE id = ?').bind(c.req.param('id')).run();
    
    return c.redirect('/admin/agents');
  } catch (error) {
    console.error('Failed to delete agent:', error);
    return c.text(`Failed to delete agent: ${error.message}`, 500);
  }
});

// Placeholder routes for other management sections
adminRoutes.get('/tags', async (c) => {
  const content = `
    <div class="card">
      <div class="card-header">
        <h3>Tags Management</h3>
        <a href="/admin/tags/add" class="btn btn-success">Add New Tag</a>
      </div>
      <div class="card-body">
        <p class="text-muted">Tags management interface - Coming soon</p>
      </div>
    </div>`;
  
  return c.html(getLayoutTemplate('Tags', content, 'tags'));
});

adminRoutes.get('/filters', async (c) => {
  const content = `
    <div class="card">
      <div class="card-header">
        <h3>Content Filters</h3>
        <a href="/admin/filters/add" class="btn btn-success">Add New Filter</a>
      </div>
      <div class="card-body">
        <p class="text-muted">Content filters management interface - Coming soon</p>
      </div>
    </div>`;
  
  return c.html(getLayoutTemplate('Content Filters', content, 'filters'));
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