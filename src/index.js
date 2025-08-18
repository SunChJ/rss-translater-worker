import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { feedRoutes } from './routes/feeds.js';
import { adminRoutes } from './routes/admin.js';
import { apiRoutes } from './routes/api.js';
import { Database } from './models/database.js';

const app = new Hono();

// Auto-initialization middleware
app.use('*', async (c, next) => {
  // Only initialize for routes that need database access (all routes except health and cron)
  const skipDB = c.req.path === '/health' || c.req.path === '/cron';
  
  if (!skipDB && c.env.DB) {
    try {
      const db = new Database(c.env.DB);
      const wasInitialized = await db.ensureInitialized();
      
      if (wasInitialized) {
        // Add a header to indicate auto-initialization occurred
        c.header('X-Auto-Initialized', 'true');
      }
    } catch (error) {
      console.error('Database auto-initialization failed:', error);
      // Continue anyway - let individual routes handle database errors
    }
  }
  
  await next();
});

// Middleware
app.use('*', cors({
  origin: ['*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.use('*', logger());
app.use('/api/*', prettyJSON());

// Mount admin routes directly to root
app.route('/', adminRoutes);
app.route('/feeds', feedRoutes);
// API routes disabled - use Web interface instead
// app.route('/api', apiRoutes);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Scheduled event handler for cron triggers
app.all('/cron', async (c) => {
  const { updateAllFeeds } = await import('./services/feedUpdater.js');
  
  try {
    const result = await updateAllFeeds(c.env);
    return c.json({ success: true, updated: result.updated, errors: result.errors });
  } catch (error) {
    console.error('Cron job failed:', error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Handle scheduled events
async function scheduled(event, env, ctx) {
  const { updateAllFeeds } = await import('./services/feedUpdater.js');
  
  try {
    console.log('Starting scheduled feed update...');
    const result = await updateAllFeeds(env);
    console.log(`Feed update completed: ${result.updated} updated, ${result.errors} errors`);
  } catch (error) {
    console.error('Scheduled feed update failed:', error);
  }
}

export default {
  fetch: app.fetch,
  scheduled
};