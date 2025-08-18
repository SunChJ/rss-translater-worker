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
    .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; transition: transform 0.2s, box-shadow 0.2s; }
    .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
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
    .status-badge { padding: 0.25rem 0.5rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .status-success { background: #d4edda; color: #155724; }
    .status-danger { background: #f8d7da; color: #721c24; }
    .status-warning { background: #fff3cd; color: #856404; }
    .status-info { background: #d1ecf1; color: #0c5460; }
    .truncate { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .text-muted { color: #6c757d; font-size: 0.9rem; }
    .actions { white-space: nowrap; }
    .updating { opacity: 0.6; pointer-events: none; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .spinning { animation: spin 1s linear infinite; }
`;

// Generate navigation  
function getNavigation() {
    return `
        <div class="nav">
            <a href="/">Dashboard</a>
            <a href="/feeds">RSS Feeds</a>
            <a href="/agents">Translation Agents</a>
            <a href="/entries">Entries</a>
            <a href="/logs">System Logs</a>
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
                <a href="/db-status" class="btn">Check Database Status</a>
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
            <a href="/feeds" class="stat-card" style="text-decoration: none; color: inherit;">
                <div class="stat-number">${feedCount.count}</div>
                <div class="stat-label">RSS Feeds</div>
            </a>
            <a href="/agents" class="stat-card" style="text-decoration: none; color: inherit;">
                <div class="stat-number">${agentCount.count}</div>
                <div class="stat-label">Translation Agents</div>
            </a>
            <a href="/entries" class="stat-card" style="text-decoration: none; color: inherit;">
                <div class="stat-number">${entryCount.count}</div>
                <div class="stat-label">Translated Entries</div>
            </a>
        </div>
        
        <h3>Recent RSS Feeds</h3>
        ${recentFeeds.results?.length > 0 ? `
            <table>
                <thead>
                    <tr><th>Name</th><th>URL</th><th>Language</th><th>Translation Status</th><th>Last Updated</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    ${recentFeeds.results.map(feed => {
                        // Determine translation status
                        let translationStatus = 'Not Started';
                        let statusClass = 'status-warning';
                        let statusIcon = '⏳';
                        
                        if (feed.translation_status) {
                            translationStatus = 'Completed';
                            statusClass = 'status-success';
                            statusIcon = '✅';
                        } else if (feed.last_translate) {
                            translationStatus = 'In Progress';
                            statusClass = 'status-info';
                            statusIcon = '🔄';
                        }
                        
                        return `
                        <tr>
                            <td>${feed.name || 'Unnamed'}</td>
                            <td class="truncate">${feed.feed_url}</td>
                            <td>${feed.target_language}</td>
                            <td>
                                <span class="status-badge ${statusClass}">
                                    ${statusIcon} ${translationStatus}
                                </span>
                            </td>
                            <td class="text-muted">
                                ${feed.last_translate ? new Date(feed.last_translate).toLocaleString() : 
                                  feed.last_fetch ? new Date(feed.last_fetch).toLocaleString() : 'Never'}
                            </td>
                            <td>
                                <a href="/feeds/${feed.slug}.rss" class="btn btn-sm" target="_blank">RSS</a>
                                <a href="/feeds" class="btn btn-sm">Manage</a>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        ` : '<p>No RSS feeds found. <a href="/feeds/add">Add your first feed</a></p>'}
        
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
                            <td><a href="/agents" class="btn btn-sm">Manage</a></td>
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
            <a href="/feeds/add" class="btn btn-success">Add New Feed</a>
        </div>
        
        ${feeds.results?.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Feed URL</th>
                        <th>Target Language</th>
                        <th>Fetch Status</th>
                        <th>Translation Status</th>
                        <th>Last Updated</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${feeds.results.map(feed => {
                        // Determine translation status
                        let translationStatus = 'Not Started';
                        let statusClass = 'status-warning';
                        let statusIcon = '⏳';
                        
                        if (feed.translation_status) {
                            translationStatus = 'Completed';
                            statusClass = 'status-success';
                            statusIcon = '✅';
                        } else if (feed.last_translate) {
                            translationStatus = 'In Progress';
                            statusClass = 'status-info';
                            statusIcon = '🔄';
                        }
                        
                        return `
                        <tr>
                            <td>${feed.name || 'Unnamed'}</td>
                            <td class="truncate"><a href="${feed.feed_url}" target="_blank">${feed.feed_url}</a></td>
                            <td>${feed.target_language}</td>
                            <td>
                                <span class="status-badge ${feed.fetch_status ? 'status-success' : 'status-danger'}">
                                    ${feed.fetch_status ? '✓ Active' : '✗ Error'}
                                </span>
                            </td>
                            <td>
                                <span class="status-badge ${statusClass}">
                                    ${statusIcon} ${translationStatus}
                                </span>
                            </td>
                            <td class="text-muted">
                                ${feed.last_translate ? new Date(feed.last_translate).toLocaleString() : 
                                  feed.last_fetch ? new Date(feed.last_fetch).toLocaleString() : 'Never'}
                            </td>
                            <td class="actions">
                                <a href="/feeds/${feed.slug}.rss" class="btn btn-sm btn-secondary" target="_blank">RSS</a>
                                <a href="/feeds/${feed.id}/edit" class="btn btn-sm">Edit</a>
                                <button onclick="updateFeed(${feed.id})" class="btn btn-sm btn-success" id="update-btn-${feed.id}">Update</button>
                                <button onclick="translateFeed(${feed.id})" class="btn btn-sm btn-info" id="translate-btn-${feed.id}">Translate</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        ` : '<p>No RSS feeds found.</p>'}
    </div>

    <script>
        function updateFeed(feedId) {
            const button = document.getElementById(\`update-btn-\${feedId}\`);
            const row = button.closest('tr');
            
            // Update button state
            button.innerHTML = '🔄 Updating...';
            button.classList.add('updating');
            row.classList.add('updating');
            
            // Send update request
            fetch(\`/feeds/\${feedId}/update\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update status in the row
                    const statusCell = row.cells[4]; // Translation Status column
                    statusCell.innerHTML = \`<span class="status-badge status-info">🔄 In Progress</span>\`;
                    
                    const timeCell = row.cells[5]; // Last Updated column
                    timeCell.innerHTML = new Date().toLocaleString();
                    
                    button.innerHTML = '✅ Updated';
                    setTimeout(() => {
                        button.innerHTML = 'Update';
                        button.classList.remove('updating');
                        row.classList.remove('updating');
                    }, 2000);
                } else {
                    throw new Error(data.error || 'Update failed');
                }
            })
            .catch(error => {
                button.innerHTML = '❌ Failed';
                button.classList.remove('updating');
                row.classList.remove('updating');
                alert('Update failed: ' + error.message);
                setTimeout(() => {
                    button.innerHTML = 'Update';
                }, 3000);
            });
        }
        
        function translateFeed(feedId) {
            const button = document.getElementById(\`translate-btn-\${feedId}\`);
            const row = button.closest('tr');
            
            // Update button state
            button.innerHTML = '🔄 Translating...';
            button.classList.add('updating');
            row.classList.add('updating');
            
            // Send translate request
            fetch(\`/api/feeds/\${feedId}/translate\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Update status in the row
                    const statusCell = row.cells[4]; // Translation Status column
                    statusCell.innerHTML = \`<span class="status-badge status-success">✅ Completed</span>\`;
                    
                    const timeCell = row.cells[5]; // Last Updated column
                    timeCell.innerHTML = new Date().toLocaleString();
                    
                    // Show token usage if available
                    if (data.tokens_used || data.characters_used) {
                        const tokenInfo = [];
                        if (data.tokens_used) tokenInfo.push(\`\${data.tokens_used} tokens\`);
                        if (data.characters_used) tokenInfo.push(\`\${data.characters_used} chars\`);
                        
                        button.innerHTML = \`✅ Done (\${tokenInfo.join(', ')})\`;
                    } else {
                        button.innerHTML = '✅ Translated';
                    }
                    
                    setTimeout(() => {
                        button.innerHTML = 'Translate';
                        button.classList.remove('updating');
                        row.classList.remove('updating');
                    }, 3000);
                } else {
                    throw new Error(data.error || 'Translation failed');
                }
            })
            .catch(error => {
                button.innerHTML = '❌ Failed';
                button.classList.remove('updating');
                row.classList.remove('updating');
                alert('Translation failed: ' + error.message);
                setTimeout(() => {
                    button.innerHTML = 'Translate';
                }, 3000);
            });
        }
        
        // Auto-refresh status every 30 seconds
        setInterval(() => {
            const updatingRows = document.querySelectorAll('.updating');
            if (updatingRows.length === 0) {
                // Only refresh if no updates are in progress
                location.reload();
            }
        }, 30000);
    </script>
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
        
        <form method="POST" action="/feeds/add">
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
                <a href="/feeds" class="btn btn-secondary">Cancel</a>
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
    
    return c.redirect('/feeds');
  } catch (error) {
    console.error('Failed to create feed:', error);
    
    // Handle specific UNIQUE constraint error
    let errorMessage = error.message;
    if (error.message.includes('UNIQUE constraint failed: feeds.feed_url, feeds.target_language')) {
      errorMessage = `This RSS feed URL already exists for target language "${body.target_language}". Please use a different URL or target language.`;
    }
    
    // Return to form with error message
    const agents = await (new Database(c.env.DB)).getAgents();
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
        
        <div style="padding: 15px; margin: 20px 0; border-radius: 4px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb;">
            <strong>Error:</strong> ${errorMessage}
        </div>
        
        <form method="POST" action="/feeds/add">
            <div class="form-group">
                <label class="form-label">Feed URL *</label>
                <input type="url" name="feed_url" class="form-control" required placeholder="https://example.com/feed.rss" value="${body.feed_url || ''}">
            </div>
            
            <div class="form-group">
                <label class="form-label">Name (Optional)</label>
                <input type="text" name="name" class="form-control" placeholder="Leave empty to use RSS title" value="${body.name || ''}">
            </div>
            
            <div class="form-group">
                <label class="form-label">Target Language</label>
                <select name="target_language" class="form-control">
                    <option value="Chinese Simplified" ${(body.target_language || 'Chinese Simplified') === 'Chinese Simplified' ? 'selected' : ''}>Chinese Simplified</option>
                    <option value="Chinese Traditional" ${body.target_language === 'Chinese Traditional' ? 'selected' : ''}>Chinese Traditional</option>
                    <option value="English" ${body.target_language === 'English' ? 'selected' : ''}>English</option>
                    <option value="Japanese" ${body.target_language === 'Japanese' ? 'selected' : ''}>Japanese</option>
                    <option value="Korean" ${body.target_language === 'Korean' ? 'selected' : ''}>Korean</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Max Posts</label>
                <input type="number" name="max_posts" class="form-control" value="${body.max_posts || '20'}" min="1" max="100">
            </div>
            
            <div class="form-group">
                <label class="form-label">Translator</label>
                <select name="translator_id" class="form-control">
                    <option value="">Select a translator</option>
                    ${agents.results?.filter(a => a.valid).map(agent => 
                        `<option value="${agent.id}" ${body.translator_id == agent.id ? 'selected' : ''}>${agent.name} (${agent.type})</option>`
                    ).join('') || '<option disabled>No valid agents available</option>'}
                </select>
            </div>
            
            <div class="form-group">
                <label><input type="checkbox" name="translate_title" ${body.translate_title === 'on' ? 'checked' : ''}> Translate titles</label><br>
                <label><input type="checkbox" name="translate_content" ${body.translate_content === 'on' || !body.feed_url ? 'checked' : ''}> Translate content</label><br>
                <label><input type="checkbox" name="summary" ${body.summary === 'on' ? 'checked' : ''}> Generate AI summary</label>
            </div>
            
            <div style="margin-top: 20px;">
                <button type="submit" class="btn btn-success">Create Feed</button>
                <a href="/feeds" class="btn btn-secondary">Cancel</a>
            </div>
        </form>
    </div>
</body>
</html>`;

    return c.html(html, 400);
  }
});

// Edit Feed Form
adminRoutes.get('/feeds/:id/edit', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const feedId = c.req.param('id');
    const feed = await db.getFeedById(feedId);
    const agents = await db.getAgents();
    
    if (!feed) {
      return c.html(`<!DOCTYPE html>
<html>
<head><title>Feed Not Found</title><meta charset="UTF-8"><style>${commonStyles}</style></head>
<body>
    <div class="container">
        <div class="header">
            <h1>Feed Not Found</h1>
            ${getNavigation()}
        </div>
        <p>The requested RSS feed was not found.</p>
        <a href="/feeds" class="btn">Back to Feeds</a>
    </div>
</body>
</html>`, 404);
    }
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Edit RSS Feed - RSS Translator Admin</title>
    <meta charset="UTF-8">
    <style>${commonStyles}</style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Edit RSS Feed</h1>
            ${getNavigation()}
        </div>
        
        <form method="POST" action="/feeds/${feed.id}/edit">
            <div class="form-group">
                <label class="form-label">Feed URL *</label>
                <input type="url" name="feed_url" class="form-control" required value="${feed.feed_url}">
            </div>
            
            <div class="form-group">
                <label class="form-label">Name</label>
                <input type="text" name="name" class="form-control" value="${feed.name || ''}" placeholder="Leave empty to use RSS title">
            </div>
            
            <div class="form-group">
                <label class="form-label">Target Language</label>
                <select name="target_language" class="form-control">
                    <option value="Chinese Simplified" ${feed.target_language === 'Chinese Simplified' ? 'selected' : ''}>Chinese Simplified</option>
                    <option value="Chinese Traditional" ${feed.target_language === 'Chinese Traditional' ? 'selected' : ''}>Chinese Traditional</option>
                    <option value="English" ${feed.target_language === 'English' ? 'selected' : ''}>English</option>
                    <option value="Japanese" ${feed.target_language === 'Japanese' ? 'selected' : ''}>Japanese</option>
                    <option value="Korean" ${feed.target_language === 'Korean' ? 'selected' : ''}>Korean</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Max Posts</label>
                <input type="number" name="max_posts" class="form-control" value="${feed.max_posts || 20}" min="1" max="100">
            </div>
            
            <div class="form-group">
                <label class="form-label">Update Frequency (minutes)</label>
                <input type="number" name="update_frequency" class="form-control" value="${feed.update_frequency || 30}" min="5">
            </div>
            
            <div class="form-group">
                <label class="form-label">Translator</label>
                <select name="translator_id" class="form-control">
                    <option value="">Select a translator</option>
                    ${agents.results?.filter(a => a.valid).map(agent => 
                        `<option value="${agent.id}" ${feed.translator_id == agent.id ? 'selected' : ''}>${agent.name} (${agent.type})</option>`
                    ).join('') || '<option disabled>No valid agents available</option>'}
                </select>
            </div>
            
            <div class="form-group">
                <label><input type="checkbox" name="translate_title" ${feed.translate_title ? 'checked' : ''}> Translate titles</label><br>
                <label><input type="checkbox" name="translate_content" ${feed.translate_content ? 'checked' : ''}> Translate content</label><br>
                <label><input type="checkbox" name="summary" ${feed.summary ? 'checked' : ''}> Generate AI summary</label><br>
                <label><input type="checkbox" name="fetch_article" ${feed.fetch_article ? 'checked' : ''}> Fetch full article content</label>
            </div>
            
            <div class="form-group">
                <label class="form-label">Translation Display Mode</label>
                <select name="translation_display" class="form-control">
                    <option value="0" ${feed.translation_display == 0 ? 'selected' : ''}>Translation only</option>
                    <option value="1" ${feed.translation_display == 1 ? 'selected' : ''}>Translation | Original</option>
                    <option value="2" ${feed.translation_display == 2 ? 'selected' : ''}>Original | Translation</option>
                </select>
            </div>
            
            <div class="form-group">
                <label class="form-label">Additional Prompt (Optional)</label>
                <textarea name="additional_prompt" class="form-control" rows="3" placeholder="Additional instructions for translation">${feed.additional_prompt || ''}</textarea>
            </div>
            
            <div class="form-group" style="background: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <label class="form-label">Translation Status & RSS Output</label>
                <div style="margin-bottom: 15px;">
                    ${(() => {
                        let statusClass = 'status-warning';
                        let statusIcon = '⏳';
                        let statusText = 'Not Started';
                        
                        if (feed.translation_status) {
                            statusClass = 'status-success';
                            statusIcon = '✅';
                            statusText = 'Translation Completed';
                        } else if (feed.last_translate) {
                            statusClass = 'status-info';
                            statusIcon = '🔄';
                            statusText = 'Translation In Progress';
                        }
                        
                        return `
                        <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${statusIcon} ${statusText}</span></p>
                        <p><strong>Last Fetch:</strong> ${feed.last_fetch ? new Date(feed.last_fetch).toLocaleString() : 'Never'}</p>
                        <p><strong>Last Translation:</strong> ${feed.last_translate ? new Date(feed.last_translate).toLocaleString() : 'Never'}</p>
                        <p><strong>Total Tokens:</strong> ${feed.total_tokens || 0} | <strong>Characters:</strong> ${feed.total_characters || 0}</p>
                        `;
                    })()}
                    <button type="button" onclick="updateFeedNow(${feed.id})" class="btn btn-success" id="update-now-btn" style="margin-top: 10px;">🔄 Update Now</button>
                </div>
                <hr style="margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>RSS:</strong> <code>/feeds/${feed.slug}.rss</code> 
                   <button type="button" onclick="copyToClipboard(window.location.origin + '/feeds/${feed.slug}.rss')" style="margin-left: 10px; padding: 2px 8px; font-size: 12px;" class="btn">Copy</button>
                   <a href="/feeds/${feed.slug}.rss" target="_blank" style="margin-left: 5px; padding: 2px 8px; font-size: 12px;" class="btn">Open</a>
                </p>
                <p style="margin: 5px 0;"><strong>Atom:</strong> <code>/feeds/${feed.slug}.atom</code>
                   <button type="button" onclick="copyToClipboard(window.location.origin + '/feeds/${feed.slug}.atom')" style="margin-left: 10px; padding: 2px 8px; font-size: 12px;" class="btn">Copy</button>
                   <a href="/feeds/${feed.slug}.atom" target="_blank" style="margin-left: 5px; padding: 2px 8px; font-size: 12px;" class="btn">Open</a>
                </p>
            </div>
            
            <script>
                function copyToClipboard(text) {
                    navigator.clipboard.writeText(text).then(() => {
                        alert('RSS URL copied to clipboard!');
                    }).catch(() => {
                        // Fallback for older browsers
                        const textarea = document.createElement('textarea');
                        textarea.value = text;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textarea);
                        alert('RSS URL copied to clipboard!');
                    });
                }
                
                function updateFeedNow(feedId) {
                    const button = document.getElementById('update-now-btn');
                    
                    // Update button state
                    button.innerHTML = '🔄 Updating...';
                    button.disabled = true;
                    button.style.opacity = '0.6';
                    
                    // Send update request
                    fetch(\`/feeds/\${feedId}/update\`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            button.innerHTML = '✅ Update Triggered';
                            alert('Feed update has been triggered. Translation will start shortly.');
                            
                            setTimeout(() => {
                                location.reload(); // Refresh to show updated status
                            }, 2000);
                        } else {
                            throw new Error(data.error || 'Update failed');
                        }
                    })
                    .catch(error => {
                        button.innerHTML = '❌ Update Failed';
                        alert('Update failed: ' + error.message);
                        setTimeout(() => {
                            button.innerHTML = '🔄 Update Now';
                            button.disabled = false;
                            button.style.opacity = '1';
                        }, 3000);
                    });
                }
            </script>
            
            <div style="margin-top: 20px;">
                <button type="submit" class="btn btn-success">Update Feed</button>
                <a href="/feeds" class="btn btn-secondary">Cancel</a>
                <button type="button" onclick="if(confirm('Are you sure you want to delete this feed? This action cannot be undone.')) { window.location.href='/feeds/${feed.id}/delete'; }" class="btn" style="background: #dc3545; margin-left: 10px;">Delete Feed</button>
            </div>
        </form>
    </div>
</body>
</html>`;

    return c.html(html);
  } catch (error) {
    console.error('Edit feed form failed:', error);
    return c.html(`<h1>Error</h1><p>Failed to load edit form: ${error.message}</p>`, 500);
  }
});

// Handle Edit Feed Form Submission
adminRoutes.post('/feeds/:id/edit', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const feedId = c.req.param('id');
    const body = await c.req.parseBody();
    
    const updateData = {
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
      translation_display: parseInt(body.translation_display) || 0,
      additional_prompt: body.additional_prompt || ''
    };
    
    await db.updateFeed(feedId, updateData);
    
    return c.redirect('/feeds');
  } catch (error) {
    console.error('Failed to update feed:', error);
    
    // Handle specific errors and return to edit form with error
    let errorMessage = error.message;
    if (error.message.includes('UNIQUE constraint failed')) {
      errorMessage = `This RSS feed URL already exists for the target language. Please use a different URL or target language.`;
    }
    
    return c.html(`<!DOCTYPE html>
<html>
<head><title>Update Failed</title><meta charset="UTF-8"><style>${commonStyles}</style></head>
<body>
    <div class="container">
        <div class="header">
            <h1>Update Failed</h1>
            ${getNavigation()}
        </div>
        <div style="padding: 15px; margin: 20px 0; border-radius: 4px; background: #f8d7da; color: #721c24;">
            <strong>Error:</strong> ${errorMessage}
        </div>
        <a href="/feeds/${c.req.param('id')}/edit" class="btn">Back to Edit</a>
        <a href="/feeds" class="btn btn-secondary">Back to Feeds</a>
    </div>
</body>
</html>`, 400);
  }
});

// Manual Update Feed
adminRoutes.post('/feeds/:id/update', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const feedId = c.req.param('id');
    
    // Get feed info
    const feed = await db.getFeedById(feedId);
    if (!feed) {
      return c.json({ success: false, error: 'Feed not found' }, 404);
    }
    
    // Update last_fetch and set translation_status to false (indicating update in progress)
    await db.updateFeed(feedId, {
      last_fetch: new Date().toISOString(),
      translation_status: false
    });
    
    // In a real implementation, you would trigger the feed update process here
    // For now, we'll just simulate the update
    
    return c.json({ 
      success: true, 
      message: 'Feed update triggered successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to update feed:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// Delete Feed
adminRoutes.get('/feeds/:id/delete', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const feedId = c.req.param('id');
    
    await db.deleteFeed(feedId);
    
    return c.redirect('/feeds');
  } catch (error) {
    console.error('Failed to delete feed:', error);
    return c.html(`<!DOCTYPE html>
<html>
<head><title>Delete Failed</title><meta charset="UTF-8"><style>${commonStyles}</style></head>
<body>
    <div class="container">
        <div class="header">
            <h1>Delete Failed</h1>
            ${getNavigation()}
        </div>
        <div style="padding: 15px; margin: 20px 0; border-radius: 4px; background: #f8d7da; color: #721c24;">
            <strong>Error:</strong> Failed to delete feed: ${error.message}
        </div>
        <a href="/feeds" class="btn">Back to Feeds</a>
    </div>
</body>
</html>`, 500);
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
            <a href="/agents/add" class="btn btn-success">Add New Agent</a>
        </div>
        
        ${agents.results?.length > 0 ? `
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>AI Capable</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${agents.results.map(agent => `
                        <tr>
                            <td>${agent.name}</td>
                            <td>${agent.type.toUpperCase()}</td>
                            <td>${agent.valid ? '✓ Valid' : '✗ Invalid'}</td>
                            <td>${agent.is_ai ? '🤖 Yes' : '🔤 No'}</td>
                            <td class="actions">
                                <a href="/agents" class="btn btn-sm">Manage</a>
                                <button onclick="testAgent(${agent.id})" class="btn btn-sm btn-success" id="test-btn-${agent.id}">Test</button>
                                <button onclick="deleteAgent(${agent.id}, '${agent.name.replace(/'/g, "\\'")}')}" class="btn btn-sm" style="background: #dc3545; color: white;">Delete</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        ` : '<p>No translation agents found. <a href="/agents/add">Add your first agent</a></p>'}
    </div>
    
    <script>
        function testAgent(agentId) {
            const button = document.getElementById(\`test-btn-\${agentId}\`);
            const row = button.closest('tr');
            
            // Update button state
            button.innerHTML = '🔄 Testing...';
            button.classList.add('updating');
            row.classList.add('updating');
            
            // Send test request
            fetch(\`/api/agents/\${agentId}/test\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    button.innerHTML = '✅ Success';
                    alert('Translation test successful!\\n\\nTest Text: "Hello world"\\nTranslated: ' + data.translated_text);
                    
                    setTimeout(() => {
                        button.innerHTML = 'Test';
                        button.classList.remove('updating');
                        row.classList.remove('updating');
                    }, 3000);
                } else {
                    throw new Error(data.error || 'Translation test failed');
                }
            })
            .catch(error => {
                button.innerHTML = '❌ Failed';
                button.classList.remove('updating');
                row.classList.remove('updating');
                alert('Translation test failed: ' + error.message);
                setTimeout(() => {
                    button.innerHTML = 'Test';
                }, 3000);
            });
        }
        
        function deleteAgent(agentId, agentName) {
            if (!confirm('Are you sure you want to delete the agent "' + agentName + '"?\\n\\nThis action cannot be undone.')) {
                return;
            }
            
            const row = document.getElementById('test-btn-' + agentId).closest('tr');
            
            // Update row state
            row.style.opacity = '0.6';
            row.style.pointerEvents = 'none';
            
            // Send delete request
            fetch('/agents/' + agentId + '/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Remove the row from the table
                    row.remove();
                    alert('Agent "' + agentName + '" has been deleted successfully.');
                    
                    // Check if no agents left
                    const table = document.querySelector('table tbody');
                    if (table && table.children.length === 0) {
                        location.reload(); // Reload to show "no agents" message
                    }
                } else {
                    throw new Error(data.error || 'Delete failed');
                }
            })
            .catch(error => {
                row.style.opacity = '1';
                row.style.pointerEvents = 'auto';
                alert('Failed to delete agent: ' + error.message);
            });
        }
    </script>
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
        
        <form method="POST" action="/agents/add">
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
                <a href="/agents" class="btn btn-secondary">Cancel</a>
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
    
    return c.redirect('/agents');
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

// System Logs page
adminRoutes.get('/logs', async (c) => {
  try {
    const db = new Database(c.env.DB);
    
    // Check if logs table exists, create if not
    try {
      await db.db.prepare('SELECT 1 FROM logs LIMIT 1').first();
    } catch (error) {
      if (error.message.includes('no such table: logs')) {
        console.log('Creating logs table...');
        await db.db.prepare(`
          CREATE TABLE logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL,
            category TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT,
            feed_id INTEGER,
            agent_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (feed_id) REFERENCES feeds (id) ON DELETE SET NULL,
            FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE SET NULL
          )
        `).run();
        console.log('Logs table created successfully');
      } else {
        throw error;
      }
    }
    
    // Get query parameters for filtering
    const level = c.req.query('level') || '';
    const category = c.req.query('category') || '';
    const page = parseInt(c.req.query('page') || '1');
    const limit = 50;
    const offset = (page - 1) * limit;
    
    // Get logs and stats
    const logs = await db.getLogs(limit, offset, level || null, category || null);
    const stats = await db.getLogStats();
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>System Logs - RSS Translator Admin</title>
    <meta charset="UTF-8">
    <style>
        ${commonStyles}
        .log-entry {
            margin-bottom: 10px;
            padding: 10px;
            border-radius: 4px;
            border-left: 4px solid;
            font-family: monospace;
            font-size: 14px;
        }
        .log-info { border-left-color: #007bff; background: #e7f3ff; }
        .log-warn { border-left-color: #ffc107; background: #fffbf0; }
        .log-error { border-left-color: #dc3545; background: #ffebee; }
        .log-debug { border-left-color: #6c757d; background: #f8f9fa; }
        .log-header {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .log-time {
            color: #666;
            font-size: 12px;
        }
        .log-details {
            margin-top: 5px;
            padding: 5px;
            background: rgba(0,0,0,0.05);
            border-radius: 3px;
            max-height: 200px;
            overflow-y: auto;
        }
        .log-filters {
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .log-stats {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .log-stat {
            padding: 10px;
            background: white;
            border-radius: 4px;
            text-align: center;
            flex: 1;
            border: 1px solid #ddd;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>System Logs</h1>
            ${getNavigation()}
        </div>
        
        <div class="log-stats">
            <div class="log-stat">
                <div style="font-size: 24px; font-weight: bold;">${stats.total}</div>
                <div style="color: #666;">Total (24h)</div>
            </div>
            <div class="log-stat">
                <div style="font-size: 24px; font-weight: bold; color: #007bff;">${stats.info}</div>
                <div style="color: #666;">Info</div>
            </div>
            <div class="log-stat">
                <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${stats.warn}</div>
                <div style="color: #666;">Warnings</div>
            </div>
            <div class="log-stat">
                <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${stats.error}</div>
                <div style="color: #666;">Errors</div>
            </div>
            <div class="log-stat">
                <div style="font-size: 24px; font-weight: bold; color: #6c757d;">${stats.debug}</div>
                <div style="color: #666;">Debug</div>
            </div>
        </div>
        
        <div class="log-filters">
            <form method="GET" style="display: flex; gap: 10px; align-items: end;">
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Log Level:</label>
                    <select name="level" class="form-control">
                        <option value="">All Levels</option>
                        <option value="info" ${level === 'info' ? 'selected' : ''}>Info</option>
                        <option value="warn" ${level === 'warn' ? 'selected' : ''}>Warning</option>
                        <option value="error" ${level === 'error' ? 'selected' : ''}>Error</option>
                        <option value="debug" ${level === 'debug' ? 'selected' : ''}>Debug</option>
                    </select>
                </div>
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Category:</label>
                    <select name="category" class="form-control">
                        <option value="">All Categories</option>
                        <option value="feed" ${category === 'feed' ? 'selected' : ''}>Feed</option>
                        <option value="translation" ${category === 'translation' ? 'selected' : ''}>Translation</option>
                        <option value="system" ${category === 'system' ? 'selected' : ''}>System</option>
                        <option value="api" ${category === 'api' ? 'selected' : ''}>API</option>
                    </select>
                </div>
                <div>
                    <button type="submit" class="btn">Filter</button>
                    <a href="/logs" class="btn btn-secondary">Clear</a>
                </div>
            </form>
        </div>
        
        ${logs.length > 0 ? logs.map(log => {
            const details = log.details ? JSON.parse(log.details) : null;
            return `
            <div class="log-entry log-${log.level}">
                <div class="log-header">
                    [${log.level.toUpperCase()}] ${log.category.toUpperCase()} - ${log.message}
                    <span class="log-time">${new Date(log.created_at).toLocaleString()}</span>
                </div>
                ${log.feed_name ? `<div><strong>Feed:</strong> ${log.feed_name}</div>` : ''}
                ${log.agent_name ? `<div><strong>Agent:</strong> ${log.agent_name}</div>` : ''}
                ${details ? `
                <div class="log-details">
                    <strong>Details:</strong><br>
                    <pre>${JSON.stringify(details, null, 2)}</pre>
                </div>` : ''}
            </div>`;
        }).join('') : '<p>No logs found.</p>'}
        
        ${logs.length === limit ? `
        <div style="text-align: center; margin-top: 20px;">
            <a href="?page=${page + 1}${level ? '&level=' + level : ''}${category ? '&category=' + category : ''}" class="btn">Load More</a>
        </div>` : ''}
    </div>
</body>
</html>`;

    return c.html(html);
  } catch (error) {
    console.error('Logs page failed:', error);
    return c.html(`<h1>Error</h1><p>Failed to load logs: ${error.message}</p>`, 500);
  }
});

// Entries page
adminRoutes.get('/entries', async (c) => {
  try {
    const db = new Database(c.env.DB);
    
    // Get query parameters for filtering
    const feedId = c.req.query('feed_id') || '';
    const page = parseInt(c.req.query('page') || '1');
    const limit = 20;
    const offset = (page - 1) * limit;
    
    // Get entries with feed information
    let query = `
      SELECT e.*, f.name as feed_name, f.slug as feed_slug, f.target_language
      FROM entries e
      LEFT JOIN feeds f ON e.feed_id = f.id
    `;
    let params = [];
    
    if (feedId && feedId !== 'empty') {
      query += ' WHERE e.feed_id = ?';
      params.push(parseInt(feedId));
    } else if (feedId === 'empty') {
      query += ' WHERE e.feed_id IS NULL';
    }
    
    query += ' ORDER BY e.published DESC, e.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const entriesResult = await db.db.prepare(query).bind(...params).all();
    const entries = entriesResult.results || [];
    
    // Get feeds for filter dropdown
    const feeds = await db.getFeeds(100, 0);
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>Translated Entries - RSS Translator Admin</title>
    <meta charset="UTF-8">
    <style>
        ${commonStyles}
        .entry-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 20px;
            padding: 20px;
            background: white;
        }
        .entry-header {
            display: flex;
            justify-content: between;
            align-items: flex-start;
            margin-bottom: 15px;
            gap: 15px;
        }
        .entry-title {
            flex: 1;
        }
        .entry-title h3 {
            margin: 0 0 5px 0;
            font-size: 18px;
        }
        .entry-title h3 a {
            color: #333;
            text-decoration: none;
        }
        .entry-title h3 a:hover {
            color: #007bff;
        }
        .entry-meta {
            color: #666;
            font-size: 14px;
            margin-bottom: 10px;
        }
        .entry-content {
            margin-top: 15px;
        }
        .entry-section {
            margin-bottom: 15px;
        }
        .entry-section h4 {
            margin: 0 0 8px 0;
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
        }
        .entry-section .content {
            line-height: 1.6;
            max-height: 200px;
            overflow-y: auto;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .entry-stats {
            display: flex;
            gap: 15px;
            margin-top: 10px;
            font-size: 12px;
            color: #666;
        }
        .filter-bar {
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 4px;
        }
        .translated-title {
            color: #007bff;
            font-weight: 500;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Translated Entries</h1>
            ${getNavigation()}
        </div>
        
        <div class="filter-bar">
            <form method="GET" style="display: flex; gap: 10px; align-items: end;">
                <div style="flex: 1;">
                    <label style="display: block; margin-bottom: 5px;">Filter by Feed:</label>
                    <select name="feed_id" class="form-control">
                        <option value="">All Entries</option>
                        <option value="empty" ${feedId === 'empty' ? 'selected' : ''}>Entries without Feed (feed_id is NULL)</option>
                        ${feeds.results?.map(feed => `
                            <option value="${feed.id}" ${feedId == feed.id ? 'selected' : ''}>
                                ${feed.name || 'Unnamed'} (${feed.target_language})
                            </option>
                        `).join('') || ''}
                    </select>
                </div>
                <div>
                    <button type="submit" class="btn">Filter</button>
                    <a href="/entries" class="btn btn-secondary">Clear</a>
                </div>
            </form>
        </div>
        
        ${entries.length > 0 ? entries.map(entry => `
            <div class="entry-card">
                <div class="entry-header">
                    <div class="entry-title">
                        <h3>
                            ${entry.link ? `<a href="${entry.link}" target="_blank">${entry.title || 'Untitled'}</a>` : (entry.title || 'Untitled')}
                        </h3>
                        ${entry.translated_title ? `<div class="translated-title">${entry.translated_title}</div>` : ''}
                        <div class="entry-meta">
                            <strong>Feed:</strong> 
                            ${entry.feed_id ? 
                                `<a href="/feeds/${entry.feed_slug || entry.feed_id}/edit">${entry.feed_name || 'Unknown Feed'}</a>` :
                                '<span style="color: #999;">No Feed (feed_id is NULL)</span>'
                            }
                            | <strong>Language:</strong> ${entry.target_language || 'Unknown'}
                            | <strong>Published:</strong> ${entry.published ? new Date(entry.published).toLocaleString() : 'Unknown'}
                            ${entry.author ? `| <strong>Author:</strong> ${entry.author}` : ''}
                            ${entry.feed_id ? '' : ' | <strong>Feed ID:</strong> NULL'}
                        </div>
                    </div>
                </div>
                
                <div class="entry-content">
                    ${entry.content ? `
                    <div class="entry-section">
                        <h4>Original Content</h4>
                        <div class="content">${entry.content}</div>
                    </div>` : ''}
                    
                    ${entry.translated_content ? `
                    <div class="entry-section">
                        <h4>Translated Content</h4>
                        <div class="content">${entry.translated_content}</div>
                    </div>` : ''}
                    
                    ${entry.summary ? `
                    <div class="entry-section">
                        <h4>Summary</h4>
                        <div class="content">${entry.summary}</div>
                    </div>` : ''}
                </div>
                
                <div class="entry-stats">
                    ${entry.tokens_used ? `<span>🔢 ${entry.tokens_used} tokens</span>` : ''}
                    ${entry.characters_used ? `<span>📝 ${entry.characters_used} characters</span>` : ''}
                    <span>⏰ Created: ${new Date(entry.created_at).toLocaleString()}</span>
                </div>
            </div>
        `).join('') : '<p>No entries found.</p>'}
        
        ${entries.length === limit ? `
        <div style="text-align: center; margin-top: 20px;">
            <a href="?page=${page + 1}${feedId ? '&feed_id=' + feedId : ''}" class="btn">Load More</a>
        </div>` : ''}
    </div>
</body>
</html>`;

    return c.html(html);
  } catch (error) {
    console.error('Entries page failed:', error);
    return c.html(`<h1>Error</h1><p>Failed to load entries: ${error.message}</p>`, 500);
  }
});

// Delete Agent
adminRoutes.post('/agents/:id/delete', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const agentId = c.req.param('id');
    
    // Check if agent exists
    const agent = await db.getAgentById(parseInt(agentId));
    if (!agent) {
      return c.json({ success: false, error: 'Agent not found' }, 404);
    }
    
    // Check if agent is being used by any feeds
    const feedsUsingAgent = await db.db.prepare(`
      SELECT COUNT(*) as count FROM feeds 
      WHERE translator_id = ? OR summarizer_id = ?
    `).bind(parseInt(agentId), parseInt(agentId)).first();
    
    if (feedsUsingAgent.count > 0) {
      return c.json({ 
        success: false, 
        error: `Cannot delete agent "${agent.name}" because it is being used by ${feedsUsingAgent.count} feed(s). Please update or delete those feeds first.` 
      }, 400);
    }
    
    // Delete the agent
    const result = await db.db.prepare('DELETE FROM agents WHERE id = ?').bind(parseInt(agentId)).run();
    
    if (result.changes > 0) {
      // Log the deletion
      await db.addLog('info', 'system', `Agent deleted: ${agent.name}`, {
        agent_id: parseInt(agentId),
        agent_name: agent.name,
        agent_type: agent.type
      });
      
      return c.json({ 
        success: true, 
        message: `Agent "${agent.name}" deleted successfully` 
      });
    } else {
      return c.json({ success: false, error: 'Failed to delete agent' }, 500);
    }
  } catch (error) {
    console.error('Failed to delete agent:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});