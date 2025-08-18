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

## Quick Start

### 1. Setup Cloudflare Services

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler auth login

# Create D1 database
wrangler d1 create rss-translator

# Create KV namespaces
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "CACHE" --preview
```

### 2. Configure Environment

Update `wrangler.toml` with your service IDs:

```toml
[[d1_databases]]
binding = "DB"
database_name = "rss-translator"
database_id = "your-database-id"

[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-id"
preview_id = "your-preview-kv-id"
```

### 3. Set Secrets

```bash
# Set API keys (optional, can be configured via admin interface)
wrangler secret put OPENAI_API_KEY
wrangler secret put DEEPL_API_KEY
wrangler secret put FIELD_ENCRYPTION_KEY
```

### 4. Deploy

```bash
# Development
npm run dev

# Production deployment
npm run deploy
```

### 5. Initialize Database

```bash
# Initialize database tables
curl -X POST https://your-worker.your-subdomain.workers.dev/admin/init
```

## API Endpoints

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

- `GET /admin/` - Simple web dashboard
- `GET /admin/db-status` - Database status
- `POST /admin/init` - Initialize database

## Configuration

### Creating a Feed

```bash
curl -X POST https://your-worker.workers.dev/api/feeds \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Translated Feed",
    "feed_url": "https://example.com/feed.xml",
    "target_language": "Chinese Simplified",
    "translate_title": true,
    "translate_content": true,
    "update_frequency": 30
  }'
```

### Creating an OpenAI Agent

```bash
curl -X POST https://your-worker.workers.dev/api/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "OpenAI GPT-4",
    "type": "openai",
    "config": {
      "api_key": "sk-...",
      "model": "gpt-4-turbo",
      "base_url": "https://api.openai.com/v1"
    }
  }'
```

## Supported Translation Engines

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

## Deployment Options

### Cloudflare Workers (Recommended)
- Global edge deployment
- Automatic scaling
- Built-in caching and security

### Environment Variables

- `ENVIRONMENT` - production/staging
- `DEFAULT_TARGET_LANGUAGE` - Default translation target
- `LOG_LEVEL` - Logging verbosity
- `OPENAI_API_KEY` - OpenAI API key
- `DEEPL_API_KEY` - DeepL API key
- `FIELD_ENCRYPTION_KEY` - Database encryption key

## Rate Limits

- OpenAI: Configurable per-agent rate limiting
- DeepL: Built-in API rate limit handling
- Feed updates: Max 50 feeds per cron execution
- Caching: 30-minute cache for generated feeds

## Monitoring

- Built-in health checks at `/api/health`
- Usage statistics at `/api/stats`
- Real-time logs via `wrangler tail`
- Error tracking in feed logs

## Security

- API key encryption in database
- CORS protection
- Input validation and sanitization
- XSS protection in generated feeds

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Deploy to staging
npm run deploy:staging

# View logs
npm run tail
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

- GitHub Issues: Report bugs and request features
- Documentation: Check the `/admin` dashboard for real-time status
- API Documentation: All endpoints return JSON with error details