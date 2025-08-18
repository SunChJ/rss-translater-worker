# Deployment Guide

This guide shows how to deploy RSS Translator Worker using Cloudflare Dashboard.

## Prerequisites

- Cloudflare account (free tier is sufficient)
- GitHub account
- Forked repository

## Step 1: Fork Repository

1. Fork this repository to your GitHub account
2. Clone your fork locally (optional, for development)

## Step 2: Create Cloudflare Resources

### Create D1 Database

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **Workers & Pages** > **D1 SQL Database**
3. Click **Create Database**
4. Database name: `rss-translator`
5. Click **Create**

### Create KV Namespace

1. Go to **Workers & Pages** > **KV**
2. Click **Create a namespace**
3. Namespace name: `rss-translator-cache`
4. Click **Add**

## Step 3: Deploy Worker via GitHub

1. Go to **Workers & Pages**
2. Click **Create Application**
3. Select **Pages** tab
4. Click **Connect to Git**
5. Authorize Cloudflare to access your GitHub
6. Select your forked repository
7. Click **Begin setup**

### Build Configuration

```
Project name: rss-translator-worker
Production branch: main
Framework preset: None
Build command: npm run build
Build output directory: /
Root directory: (leave empty)
```

Click **Save and Deploy**

## Step 4: Configure Bindings

After deployment, configure the required bindings:

1. Go to your deployed project settings
2. Navigate to **Settings** > **Functions**
3. Add the following bindings:

### D1 Database Binding
- Variable name: `DB`
- D1 database: `rss-translator`

### KV Namespace Binding
- Variable name: `CACHE`
- KV namespace: `rss-translator-cache`

## Step 5: Set Environment Variables

In **Settings** > **Environment Variables**, add:

```
ENVIRONMENT = production
DEFAULT_TARGET_LANGUAGE = Chinese Simplified
LOG_LEVEL = INFO
```

## Step 6: Set Secrets (Optional)

For translation services, add these encrypted variables:

```
OPENAI_API_KEY = sk-your-openai-key
DEEPL_API_KEY = your-deepl-key
FIELD_ENCRYPTION_KEY = random-32-character-string
```

## Step 7: Initialize Database

1. Visit your deployed Worker URL
2. Go to `/admin/init` to initialize database tables
3. Or use curl: `curl -X POST https://your-worker.pages.dev/admin/init`

## Step 8: Verify Deployment

1. **Check health**: Visit `/api/health`
2. **View admin panel**: Visit `/admin/`
3. **Database status**: Visit `/admin/db-status`

## Custom Domain (Optional)

1. In project settings, go to **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain name
4. Follow DNS configuration instructions

## Automatic Updates

Once connected to GitHub, your Worker will automatically update when you push to the main branch.

## Troubleshooting

### Common Issues

1. **Binding errors**: Ensure D1 and KV bindings are correctly configured
2. **Database not found**: Initialize database via `/admin/init`
3. **Function errors**: Check function logs in Cloudflare Dashboard

### Debug Steps

1. Check **Functions** > **Logs** in Cloudflare Dashboard
2. Verify all bindings in **Settings** > **Functions**
3. Test database connection via `/admin/db-status`
4. Validate environment variables in **Settings**

## Security Notes

- Never commit API keys to your repository
- Use Cloudflare's encrypted environment variables for secrets
- Regularly rotate API keys
- Monitor usage via the admin dashboard

## Performance

- Worker automatically scales based on usage
- D1 database has generous free tier limits
- KV storage provides fast global caching
- Cron triggers handle scheduled feed updates

## Next Steps

After successful deployment:

1. Create translation agents via admin panel or API
2. Add RSS feeds to translate
3. Subscribe to translated feeds
4. Monitor usage and performance

For detailed API usage, see the main README.md file.