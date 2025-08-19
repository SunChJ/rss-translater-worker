import { Hono } from 'hono';
import { Database } from '../models/database.js';
import { TranslationQueue } from '../services/translationQueue.js';

export const adminRoutes = new Hono();

// 翻译进度监控页面
adminRoutes.get('/translation-monitor', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const translationQueue = new TranslationQueue(3);
    
    // 检查是否需要强制刷新
    const forceRefresh = c.req.query('_cache_clear') || c.req.query('_t');
    const cacheBuster = forceRefresh ? `?v=${Date.now()}` : '';
    
    // 获取队列状态
    const queueStatus = translationQueue.getStatus();
    
    // 获取所有Feed的翻译统计（添加强制刷新支持）
    const feedStats = await db.db.prepare(`
      SELECT 
        f.id,
        f.name,
        f.feed_url,
        f.last_fetch,
        f.fetch_status,
        f.translator_id,
        f.target_language,
        COUNT(e.id) as total_entries,
        COUNT(CASE WHEN e.translated_title != '' OR e.translated_content != '' THEN 1 END) as translated_entries,
        SUM(e.tokens_used) as total_tokens,
        SUM(e.characters_used) as total_characters
      FROM feeds f
      LEFT JOIN entries e ON f.id = e.feed_id
      GROUP BY f.id
      ORDER BY f.last_fetch DESC
    `).all();
    
    const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RSS翻译进度监控</title>
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <meta http-equiv="Last-Modified" content="${new Date().toISOString()}">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2em;
        }
        .content {
            padding: 20px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .stat-card h3 {
            margin: 0 0 10px 0;
            color: #495057;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .stat-card .value {
            font-size: 2em;
            font-weight: bold;
            color: #212529;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 10px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #28a745, #20c997);
            transition: width 0.3s ease;
        }
        .feeds-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .feeds-table th,
        .feeds-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
        }
        .feeds-table th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }
        .feeds-table tr:hover {
            background: #f8f9fa;
        }
        .status-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: 500;
        }
        .status-active {
            background: #d4edda;
            color: #155724;
        }
        .status-inactive {
            background: #f8d7da;
            color: #721c24;
        }
        .refresh-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
            margin-bottom: 20px;
        }
        .refresh-btn:hover {
            background: #5a6fd8;
        }
        .queue-status {
            background: #e3f2fd;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #2196f3;
        }
        .queue-status h3 {
            margin: 0 0 10px 0;
            color: #1976d2;
        }
        .queue-info {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }
        .queue-item {
            text-align: center;
        }
        .queue-item .label {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 5px;
        }
        .queue-item .value {
            font-size: 1.5em;
            font-weight: bold;
            color: #1976d2;
        }
        .refresh-controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            align-items: center;
            flex-wrap: wrap;
        }
        .last-refresh {
            margin-left: 20px;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 RSS翻译进度监控</h1>
            <p>实时监控翻译队列状态和Feed处理进度</p>
        </div>
        
        <div class="content">
            <div class="refresh-controls">
                <button class="refresh-btn" onclick="refreshData()">🔄 刷新数据</button>
                <button class="refresh-btn" onclick="forceRefresh()" style="background: #dc3545;">⚡ 强制刷新</button>
                <button class="refresh-btn" onclick="clearCacheAndRefresh()" style="background: #fd7e14;">🧹 清除缓存并刷新</button>
                <button class="refresh-btn" onclick="updateDataOnly()" style="background: #17a2b8;">📊 仅更新数据</button>
                <span class="last-refresh" id="last-refresh-time">
                    最后刷新: ${new Date().toLocaleString('zh-CN')}
                </span>
            </div>
            
            <div class="queue-status">
                <h3>📊 翻译队列状态</h3>
                <div class="queue-info">
                    <div class="queue-item">
                        <div class="label">最大并发数</div>
                        <div class="value">${queueStatus.maxConcurrent}</div>
                    </div>
                    <div class="queue-item">
                        <div class="label">正在运行</div>
                        <div class="value">${queueStatus.running}</div>
                    </div>
                    <div class="queue-item">
                        <div class="label">队列中</div>
                        <div class="value">${queueStatus.queued}</div>
                    </div>
                    <div class="queue-item">
                        <div class="label">总任务数</div>
                        <div class="value">${queueStatus.progress.total}</div>
                    </div>
                    <div class="queue-item">
                        <div class="label">已完成</div>
                        <div class="value">${queueStatus.progress.completed}</div>
                    </div>
                    <div class="queue-item">
                        <div class="label">失败</div>
                        <div class="value">${queueStatus.progress.failed}</div>
                    </div>
                </div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>总Feed数</h3>
                    <div class="value">${feedStats.results?.length || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>活跃Feed</h3>
                    <div class="value">${feedStats.results?.filter(f => f.fetch_status).length || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>总条目数</h3>
                    <div class="value">${feedStats.results?.reduce((sum, f) => sum + (f.total_entries || 0), 0) || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>已翻译条目</h3>
                    <div class="value">${feedStats.results?.reduce((sum, f) => sum + (f.translated_entries || 0), 0) || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>总Token使用量</h3>
                    <div class="value">${feedStats.results?.reduce((sum, f) => sum + (f.total_tokens || 0), 0).toLocaleString() || 0}</div>
                </div>
                <div class="stat-card">
                    <h3>总字符使用量</h3>
                    <div class="value">${feedStats.results?.reduce((sum, f) => sum + (f.total_characters || 0), 0).toLocaleString() || 0}</div>
                </div>
            </div>
            
            <h2>📋 Feed详细状态</h2>
            <table class="feeds-table">
                <thead>
                    <tr>
                        <th>Feed名称</th>
                        <th>URL</th>
                        <th>状态</th>
                        <th>最后更新</th>
                        <th>总条目</th>
                        <th>已翻译</th>
                        <th>翻译进度</th>
                        <th>Token使用</th>
                    </tr>
                </thead>
                <tbody>
                    ${(feedStats.results || []).map(feed => {
                        const progress = feed.total_entries > 0 ? 
                            Math.round((feed.translated_entries / feed.total_entries) * 100) : 0;
                        const statusClass = feed.fetch_status ? 'status-active' : 'status-inactive';
                        const statusText = feed.fetch_status ? '活跃' : '非活跃';
                        
                        return `
                            <tr>
                                <td><strong>${feed.name || '未命名'}</strong></td>
                                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">
                                    ${feed.feed_url}
                                </td>
                                <td>
                                    <span class="status-badge ${statusClass}">${statusText}</span>
                                </td>
                                <td>${feed.last_fetch ? new Date(feed.last_fetch).toLocaleString('zh-CN') : '从未更新'}</td>
                                <td>${feed.total_entries || 0}</td>
                                <td>${feed.translated_entries || 0}</td>
                                <td>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${progress}%"></div>
                                    </div>
                                    <small>${progress}%</small>
                                </td>
                                <td>${(feed.total_tokens || 0).toLocaleString()}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>
    
    <script>
        let refreshInProgress = false;
        let autoRefreshTimer = null;
        
        // 更新最后刷新时间
        function updateLastRefreshTime() {
            const now = new Date();
            document.getElementById('last-refresh-time').textContent = 
                '最后刷新: ' + now.toLocaleString('zh-CN');
        }
        
        // 普通刷新数据
        async function refreshData() {
            if (refreshInProgress) return;
            
            try {
                refreshInProgress = true;
                const refreshBtn = event.target;
                const originalText = refreshBtn.textContent;
                
                refreshBtn.textContent = '🔄 刷新中...';
                refreshBtn.disabled = true;
                
                // 强制刷新页面
                location.reload();
                
            } catch (error) {
                console.error('刷新失败:', error);
                alert('刷新失败: ' + error.message);
            } finally {
                refreshInProgress = false;
            }
        }
        
        // 仅更新数据（不刷新页面）
        async function updateDataOnly() {
            if (refreshInProgress) return;
            
            try {
                refreshInProgress = true;
                const updateBtn = event.target;
                const originalText = updateBtn.textContent;
                
                updateBtn.textContent = '📊 更新中...';
                updateBtn.disabled = true;
                
                // 获取最新的翻译进度数据
                const response = await fetch('/api/translation/progress?_t=' + Date.now(), {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        // 更新队列状态显示
                        updateQueueStatus(data.queue);
                        updateLastRefreshTime();
                        console.log('数据更新成功');
                    }
                }
                
                // 获取最新的队列状态
                const queueResponse = await fetch('/api/translation/queue/status?_t=' + Date.now(), {
                    method: 'GET',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                
                if (queueResponse.ok) {
                    const queueData = await queueResponse.json();
                    if (queueData.success) {
                        updateQueueStatus(queueData.status);
                    }
                }
                
            } catch (error) {
                console.error('数据更新失败:', error);
                alert('数据更新失败: ' + error.message);
            } finally {
                refreshInProgress = false;
                const updateBtn = event.target;
                updateBtn.textContent = originalText;
                updateBtn.disabled = false;
            }
        }
        
        // 更新队列状态显示
        function updateQueueStatus(status) {
            const queueInfo = document.querySelector('.queue-info');
            if (queueInfo && status) {
                const values = queueInfo.querySelectorAll('.value');
                if (values.length >= 6) {
                    values[0].textContent = status.maxConcurrent || 0;
                    values[1].textContent = status.running || 0;
                    values[2].textContent = status.queued || 0;
                    values[3].textContent = status.progress?.total || 0;
                    values[4].textContent = status.progress?.completed || 0;
                    values[5].textContent = status.progress?.failed || 0;
                }
            }
        }
        
        // 强制刷新（清除所有缓存）
        async function forceRefresh() {
            if (refreshInProgress) return;
            
            try {
                refreshInProgress = true;
                const refreshBtn = event.target;
                const originalText = refreshBtn.textContent;
                
                refreshBtn.textContent = '⚡ 强制刷新中...';
                refreshBtn.disabled = true;
                
                // 清除浏览器缓存
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
                
                // 清除localStorage和sessionStorage
                localStorage.clear();
                sessionStorage.clear();
                
                // 添加时间戳参数强制刷新
                const url = new URL(window.location.href);
                url.searchParams.set('_t', Date.now());
                
                // 强制重新加载页面
                window.location.href = url.toString();
                
            } catch (error) {
                console.error('强制刷新失败:', error);
                alert('强制刷新失败: ' + error.message);
            } finally {
                refreshInProgress = false;
            }
        }
        
        // 清除缓存并刷新
        async function clearCacheAndRefresh() {
            if (refreshInProgress) return;
            
            try {
                refreshInProgress = true;
                const refreshBtn = event.target;
                const originalText = refreshBtn.textContent;
                
                refreshBtn.textContent = '🧹 清除缓存中...';
                refreshBtn.disabled = true;
                
                // 清除所有可能的缓存
                if ('caches' in window) {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                }
                
                // 清除localStorage和sessionStorage
                localStorage.clear();
                sessionStorage.clear();
                
                // 清除IndexedDB（如果存在）
                if ('indexedDB' in window) {
                    const databases = await indexedDB.databases();
                    databases.forEach(db => {
                        if (db.name) {
                            indexedDB.deleteDatabase(db.name);
                        }
                    });
                }
                
                // 添加随机参数并强制刷新
                const url = new URL(window.location.href);
                url.searchParams.set('_cache_clear', Date.now());
                url.searchParams.set('_v', Math.random().toString(36).substr(2, 9));
                
                // 强制重新加载页面
                window.location.replace(url.toString());
                
            } catch (error) {
                console.error('清除缓存失败:', error);
                alert('清除缓存失败: ' + error.message);
            } finally {
                refreshInProgress = false;
            }
        }
        
        // 重置自动刷新定时器
        function resetAutoRefresh() {
            if (autoRefreshTimer) {
                clearTimeout(autoRefreshTimer);
            }
            
            // 设置新的自动刷新（每30秒）
            autoRefreshTimer = setTimeout(() => {
                if (!refreshInProgress) {
                    console.log('自动刷新页面...');
                    location.reload();
                }
            }, 30000);
        }
        
        // 页面加载完成后初始化
        document.addEventListener('DOMContentLoaded', function() {
            updateLastRefreshTime();
            resetAutoRefresh();
            
            // 监听页面可见性变化，当页面重新可见时重置定时器
            document.addEventListener('visibilitychange', function() {
                if (!document.hidden) {
                    resetAutoRefresh();
                }
            });
        });
        
        // 防止页面意外关闭时丢失刷新状态
        window.addEventListener('beforeunload', function() {
            if (refreshInProgress) {
                return '刷新正在进行中，确定要离开吗？';
            }
        });
    </script>
</body>
</html>`;
    
    return c.html(html);
    
  } catch (error) {
    console.error('Failed to render translation monitor:', error);
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>错误</title></head>
        <body>
          <h1>加载失败</h1>
          <p>错误: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

// 简单的Dashboard页面
adminRoutes.get('/', async (c) => {
  try {
    const db = new Database(c.env.DB);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>RSS Translator Admin</title>
    <meta charset="UTF-8">
    <style>
        body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { border-bottom: 1px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }
        .nav { margin: 20px 0; }
        .nav a { margin-right: 20px; padding: 8px 16px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .nav a:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>RSS Translator Admin</h1>
            <div class="nav">
                <a href="/translation-monitor">🚀 翻译监控</a>
            </div>
        </div>
        <p>欢迎使用RSS翻译系统！点击上方链接查看翻译进度监控。</p>
    </div>
</body>
</html>`;
    
    return c.html(html);
  } catch (error) {
    console.error('Admin dashboard failed:', error);
    return c.html(`<h1>Error</h1><p>Failed to load dashboard: ${error.message}</p>`, 500);
  }
});
