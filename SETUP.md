# Quick Setup Guide

Follow these exact steps to configure your RSS Translator Worker:

## 1. Create Required Resources

### Create D1 Database
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → D1 SQL Database
2. Click **Create Database**
3. Database name: `rss-translator`
4. Click **Create**

### Create KV Namespace
1. Go to Workers & Pages → KV
2. Click **Create a namespace**
3. Namespace name: `rss-translator-cache`
4. Click **Add**

## 2. Configure Worker Bindings

1. Find your deployed worker: `rss-translater`
2. Go to **Settings** → **Variables**
3. Add these bindings:

**D1 Database Binding:**
- Type: D1 database
- Variable name: `DB`
- D1 database: `rss-translator`

**KV Namespace Binding:**
- Type: KV namespace  
- Variable name: `CACHE`
- KV namespace: `rss-translator-cache`

## 3. Verify Setup

After configuration, test these endpoints:

1. **Health Check:**
   ```
   https://rss-translater.cs35075290003332.workers.dev/api/health
   ```
   Should return: `"database": "ok"` and `"cache": "configured"`

2. **Database Status:**
   ```
   https://rss-translater.cs35075290003332.workers.dev/admin/db-status
   ```

3. **Initialize Database:**
   ```
   https://rss-translater.cs35075290003332.workers.dev/admin/init
   ```

4. **Access Admin Panel:**
   ```
   https://rss-translater.cs35075290003332.workers.dev/admin/
   ```

## 4. Common Issues

**Error: "Cannot read properties of undefined (reading 'prepare')"**
- D1 database binding is missing
- Make sure variable name is exactly `DB`
- Make sure database name is exactly `rss-translator`

**Error: "Database binding missing"**
- Check that bindings are saved and deployed
- Wait a few minutes for changes to propagate

## 5. Next Steps

Once setup is complete:
1. Create translation agents (OpenAI, DeepL)
2. Add RSS feeds to translate
3. Subscribe to translated feeds

## Required Names (Must Use Exactly)

- **D1 Database Name**: `rss-translator`
- **KV Namespace Name**: `rss-translator-cache`
- **Database Binding Variable**: `DB`
- **Cache Binding Variable**: `CACHE`