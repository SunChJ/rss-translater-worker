# RSS Translator Worker

A Cloudflare Worker implementation of RSS Translator - translate RSS feeds using various translation engines.

## Features

- 🌐 **Multi-language Translation**: Support for OpenAI, DeepL, LibreTranslate, and custom agents
- 📡 **RSS/Atom/JSON Feeds**: Generate translated feeds in multiple formats
- ⚡ **Serverless**: Runs on Cloudflare Workers with D1 database and KV storage
- 🔄 **Automatic Updates**: Scheduled feed updates via cron triggers
- 🎯 **Smart Filtering**: Keyword and AI-based content filtering
- 📊 **Analytics**: Track token usage and translation costs
- 🛡️ **Caching**: Intelligent caching to reduce API calls

## Architecture

- **Runtime**: Cloudflare Workers (JavaScript/ES Modules)
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **Scheduling**: Cloudflare Cron Triggers
- **Framework**: Hono.js

## 🚀 Quick Deployment via Cloudflare Dashboard

### Method 1: Deploy from GitHub (Recommended)

1. **Fork this repository** to your GitHub account

2. **Sign in to Cloudflare Dashboard**
   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
   - Navigate to **Workers & Pages**

3. **Create a new Worker**
   - Click **Create Application**
   - Select **Pages** tab
   - Click **Connect to Git**
   - Select your forked repository
   - Click **Begin setup**

4. **Configure build settings**
   ```
   Framework preset: None
   Build command: (leave empty)
   Build output directory: /
   Root directory: (leave empty)
   ```

5. **Set environment variables** (in Cloudflare Dashboard):
   ```
   ENVIRONMENT = production
   DEFAULT_TARGET_LANGUAGE = Chinese Simplified
   LOG_LEVEL = INFO
   ```

6. **Create D1 Database**
   - Go to **Workers & Pages** > **D1 SQL Database**
   - Click **Create Database**
   - Name: `rss-translator`
   - Click **Create**

7. **Create KV Namespace**
   - Go to **Workers & Pages** > **KV**
   - Click **Create a namespace**
   - Namespace name: `rss-translator-cache`
   - Click **Add**

8. **Configure Worker Bindings**
   - Go back to your deployed Worker
   - Click **Settings** > **Variables**
   - Under **Service bindings**, add:
     - **D1 database binding**: Variable name `DB`, Dataset `rss-translator`
     - **KV namespace binding**: Variable name `CACHE`, KV namespace `rss-translator-cache`
   
   **Important**: Use exactly these names:
   - D1 Database: `rss-translator`
   - KV Namespace: `rss-translator-cache`

9. **Set Secrets** (optional, can be done later via admin interface):
   - In **Settings** > **Variables** > **Environment Variables**:
     - `OPENAI_API_KEY`: Your OpenAI API key
     - `DEEPL_API_KEY`: Your DeepL API key  
     - `FIELD_ENCRYPTION_KEY`: Random 32-character string for database encryption

10. **Initialize Database**
    - Visit your Worker URL: `https://your-worker.pages.dev/admin/init`
    - Or use curl: `curl -X POST https://your-worker.pages.dev/admin/init`

### Method 2: Manual Deploy with Wrangler CLI

If you prefer command-line deployment:

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   wrangler auth login
   ```

2. **Clone and setup**
   ```bash
   git clone https://github.com/SunChJ/rss-translater-worker.git
   cd rss-translator-worker
   npm install
   ```

3. **Create resources manually**
   ```bash
   # Create D1 database
   wrangler d1 create rss-translator
   
   # Create KV namespace
   wrangler kv:namespace create "CACHE"
   ```

4. **Update wrangler.toml** with the IDs from step 3

5. **Deploy**
   ```bash
   npm run deploy
   ```

## 🔧 Configuration

### Creating Your First Translation Agent

Once deployed, visit your Worker's admin interface at `https://your-worker.pages.dev/admin/`

**Create OpenAI Agent:**
```bash
curl -X POST https://your-worker.pages.dev/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OpenAI GPT-4",
    "type": "openai",
    "config": {
      "api_key": "sk-your-openai-api-key",
      "model": "gpt-4-turbo",
      "base_url": "https://api.openai.com/v1",
      "temperature": 0.2
    }
  }'
```

**Create DeepL Agent:**
```bash
curl -X POST https://your-worker.pages.dev/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DeepL Translator",
    "type": "deepl",
    "config": {
      "api_key": "your-deepl-api-key"
    }
  }'
```

### Creating Your First Translated Feed

```bash
curl -X POST https://your-worker.pages.dev/api/feeds \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hacker News Translated",
    "feed_url": "https://hnrss.org/frontpage",
    "target_language": "Chinese Simplified",
    "translate_title": true,
    "translate_content": true,
    "update_frequency": 60,
    "max_posts": 20,
    "translator_id": 1
  }'
```

## 📡 API Endpoints

### Feed Management
- `GET /api/feeds` - List all feeds
- `POST /api/feeds` - Create new feed
- `GET /api/feeds/:id` - Get feed details
- `PUT /api/feeds/:id` - Update feed
- `DELETE /api/feeds/:id` - Delete feed
- `POST /api/feeds/:id/update` - Manually update feed

### Agent Management
- `GET /api/agents` - List translation agents
- `POST /api/agents` - Create new agent
- `POST /api/agents/:id/test` - Test agent translation
- `POST /api/agents/:id/validate` - Validate agent credentials

### Feed Output
- `GET /feeds/:slug.rss` - RSS format
- `GET /feeds/:slug.atom` - Atom format
- `GET /feeds/:slug.json` - JSON Feed format
- `GET /feeds/:slug/info` - Feed information

### Admin Interface
- `GET /admin/` - Web dashboard
- `GET /admin/db-status` - Database status
- `POST /admin/init` - Initialize database

## 🌍 Supported Translation Engines

### OpenAI
- All OpenAI models (GPT-3.5, GPT-4, etc.)
- Compatible third-party providers
- AI-powered filtering and summarization

### DeepL
- High-quality translation
- Supports 31+ languages
- HTML tag preservation

### LibreTranslate
- Open source translation
- Self-hosted option
- Multiple language pairs

### Test Agent
- Development testing
- No API calls required
- Configurable responses

## ⚙️ Environment Variables

Configure these in Cloudflare Dashboard under **Settings** > **Variables**:

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment name | `production` |
| `DEFAULT_TARGET_LANGUAGE` | Default translation target | `Chinese Simplified` |
| `LOG_LEVEL` | Logging verbosity | `INFO` |

## 🔐 Required Secrets

Set these in Cloudflare Dashboard under **Settings** > **Variables** > **Environment Variables**:

| Secret | Description | Required |
|--------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key | Optional |
| `DEEPL_API_KEY` | DeepL API key | Optional |
| `FIELD_ENCRYPTION_KEY` | Database encryption key | Required |

## 📊 Monitoring & Maintenance

### Health Checks
- **API Health**: `GET /api/health`
- **Database Status**: `GET /admin/db-status`
- **Usage Statistics**: `GET /api/stats`

### Logging
- Real-time logs: Use Cloudflare Dashboard > **Functions** > **Logs**
- Or with CLI: `wrangler tail`

### Rate Limits
- OpenAI: Configurable per-agent rate limiting
- DeepL: Built-in API rate limit handling
- Feed updates: Max 50 feeds per cron execution
- Caching: 30-minute cache for generated feeds

## 🔧 Customization

### Cron Schedule
Edit the cron trigger in `wrangler.toml`:
```toml
[triggers]
crons = [
  "*/15 * * * *",  # Every 15 minutes
  "0 */2 * * *"    # Every 2 hours
]
```

### Custom Domain
1. Add custom domain in Cloudflare Dashboard
2. Configure DNS records
3. SSL/TLS will be automatically managed

## 🐛 Troubleshooting

### Common Issues

1. **Worker not responding**: Check D1 and KV bindings are configured
2. **Database errors**: Ensure database is initialized via `/admin/init`
3. **Translation failures**: Verify API keys in agent configuration
4. **Cron not running**: Check trigger configuration and Worker limits

### Debug Steps

1. **Check Worker logs** in Cloudflare Dashboard
2. **Test database connection**: Visit `/admin/db-status`
3. **Validate agents**: Use `/api/agents/:id/validate`
4. **Manual feed update**: Use `/api/feeds/:id/update`

## 🔄 Updates & Maintenance

### Updating the Worker
If using GitHub integration, simply push to your main branch and Cloudflare will auto-deploy.

### Database Maintenance
- Old entries are automatically cleaned up
- Monitor usage via `/api/stats`
- Database size limits apply based on your Cloudflare plan

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check `/admin` dashboard for real-time status
- **API Documentation**: All endpoints return JSON with error details
- **Community**: Join discussions in GitHub Discussions

---

**Note**: This is a serverless application designed for Cloudflare Workers. It automatically scales based on usage and requires no server maintenance.