import { Hono } from 'hono';
import { Database } from '../models/database.js';
import { FeedGenerator } from '../services/feedGenerator.js';

export const feedRoutes = new Hono();

// Get translated feed by slug (all formats)
feedRoutes.get('/:filename', async (c) => {
  try {
    const filename = c.req.param('filename');
    console.log('Feed request filename:', filename);
    
    // Determine format and extract slug
    let slug, format;
    if (filename.endsWith('.rss')) {
      slug = filename.replace('.rss', '');
      format = 'rss';
    } else if (filename.endsWith('.atom')) {
      slug = filename.replace('.atom', '');
      format = 'atom';
    } else if (filename.endsWith('.json')) {
      slug = filename.replace('.json', '');
      format = 'json';
    } else {
      return c.text('Unsupported feed format', 404);
    }
    
    console.log('Extracted slug:', slug, 'format:', format);
    
    if (!slug) {
      return c.text('Invalid slug parameter', 400);
    }
    
    const db = new Database(c.env.DB);
    
    console.log('About to query database for slug:', slug, 'type:', typeof slug);
    const feed = await db.getFeedBySlug(slug);
    console.log('Feed found:', feed ? 'yes' : 'no');
    console.log('Feed data:', feed);
    if (!feed) {
      return c.text('Feed not found', 404);
    }

    if (!feed.id) {
      console.error('Feed has no ID:', feed);
      return c.text('Feed data corrupted - missing ID', 500);
    }

    console.log('About to query entries for feed.id:', feed.id, 'max_posts:', feed.max_posts);
    const entries = await db.getEntriesByFeedId(feed.id, feed.max_posts || 20);
    console.log('Entries found:', entries.length);
    console.log('Sample entry:', entries[0] ? {
      id: entries[0].id,
      title: entries[0].title,
      translated_title: entries[0].translated_title,
      content_length: entries[0].content?.length || 0,
      translated_content_length: entries[0].translated_content?.length || 0
    } : 'none');
    
    const generator = new FeedGenerator();
    
    // Generate appropriate format
    if (format === 'rss') {
      console.log('Generating RSS for feed:', feed.name, 'with', entries.length, 'entries');
      const rssXml = generator.generateRSS(feed, entries);
      console.log('RSS XML generated, length:', rssXml.length);
      
      return c.text(rssXml, 200, {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800' // 30 minutes
      });
    } else if (format === 'atom') {
      console.log('Generating Atom for feed:', feed.name, 'with', entries.length, 'entries');
      const atomXml = generator.generateAtom(feed, entries);
      
      return c.text(atomXml, 200, {
        'Content-Type': 'application/atom+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800' // 30 minutes
      });
    } else if (format === 'json') {
      console.log('Generating JSON for feed:', feed.name, 'with', entries.length, 'entries');
      const jsonFeed = generator.generateJSON(feed, entries);
      
      return c.json(jsonFeed, 200, {
        'Cache-Control': 'public, max-age=1800' // 30 minutes
      });
    } else {
      return c.text('Unsupported format', 400);
    }
  } catch (error) {
    console.error('RSS generation failed:', error);
    console.error('Error stack:', error.stack);
    return c.text(`Internal server error: ${error.message}`, 500);
  }
});

// Get feed info and statistics
feedRoutes.get('/:slug/info', async (c) => {
  try {
    const { slug } = c.req.param();
    const db = new Database(c.env.DB);
    
    const feed = await db.getFeedBySlug(slug);
    if (!feed) {
      return c.json({ error: 'Feed not found' }, 404);
    }

    const entries = await db.getEntriesByFeedId(feed.id, 1);
    const entryCount = entries ? entries.length : 0;
    
    const info = {
      name: feed.name,
      subtitle: feed.subtitle,
      feed_url: feed.feed_url,
      target_language: feed.target_language,
      translation_display: feed.translation_display,
      update_frequency: feed.update_frequency,
      max_posts: feed.max_posts,
      last_fetch: feed.last_fetch,
      last_translate: feed.last_translate,
      total_tokens: feed.total_tokens,
      total_characters: feed.total_characters,
      entry_count: entryCount,
      formats: {
        rss: `/feeds/${slug}.rss`,
        atom: `/feeds/${slug}.atom`,
        json: `/feeds/${slug}.json`
      }
    };
    
    return c.json(info);
  } catch (error) {
    console.error('Feed info retrieval failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// List all public feeds
feedRoutes.get('/', async (c) => {
  try {
    const db = new Database(c.env.DB);
    const feeds = await db.getFeeds(50, 0);
    
    const publicFeeds = feeds.results.map(feed => ({
      slug: feed.slug,
      name: feed.name,
      subtitle: feed.subtitle,
      target_language: feed.target_language,
      last_fetch: feed.last_fetch,
      formats: {
        rss: `/feeds/${feed.slug}.rss`,
        atom: `/feeds/${feed.slug}.atom`,
        json: `/feeds/${feed.slug}.json`
      }
    }));
    
    return c.json({
      feeds: publicFeeds,
      total: feeds.results.length
    });
  } catch (error) {
    console.error('Feed listing failed:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});