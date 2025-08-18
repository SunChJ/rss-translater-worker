import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { feedRoutes } from './routes/feeds.js';
import { adminRoutes } from './routes/admin.js';
import { apiRoutes } from './routes/api.js';

const app = new Hono();

// Middleware
app.use('*', cors({
  origin: ['*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

app.use('*', logger());
app.use('/api/*', prettyJSON());

// Routes
app.route('/feeds', feedRoutes);
app.route('/admin', adminRoutes);
app.route('/api', apiRoutes);

// Root route
app.get('/', (c) => {
  return c.json({
    name: 'RSS Translator Worker',
    version: '1.0.0',
    description: 'RSS Translation service powered by Cloudflare Workers',
    endpoints: {
      feeds: '/feeds',
      admin: '/admin',
      api: '/api'
    }
  });
});

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