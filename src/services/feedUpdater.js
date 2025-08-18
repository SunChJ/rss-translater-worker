import { Database } from '../models/database.js';
import { AgentManager } from './agents.js';
import { FeedProcessor } from './feedProcessor.js';
import { TranslationQueue } from './translationQueue.js';

export async function updateAllFeeds(env) {
  const db = new Database(env.DB);
  const agentManager = new AgentManager(env);
  const processor = new FeedProcessor(env);
  const translationQueue = new TranslationQueue(3); // 最多3个并发翻译
  
  console.log('Starting scheduled feed updates...');
  
  try {
    // Get feeds that need updating
    const now = new Date();
    const feeds = await db.db.prepare(`
      SELECT * FROM feeds 
      WHERE (
        last_fetch IS NULL 
        OR datetime(last_fetch, '+' || update_frequency || ' minutes') <= datetime('now')
      )
      ORDER BY last_fetch ASC NULLS FIRST
      LIMIT 50
    `).all();
    
    const feedsToUpdate = feeds.results || [];
    console.log(`Found ${feedsToUpdate.length} feeds to update`);
    
    let updated = 0;
    let errors = 0;
    const results = [];
    
    // Create agent manager with cached agents
    const agents = await db.getAgents();
    const agentCache = new Map();
    
    for (const agentData of agents.results || []) {
      try {
        const agent = agentManager.createAgent(agentData.type, {
          ...JSON.parse(agentData.config || '{}'),
          name: agentData.name,
          valid: agentData.valid
        });
        agentCache.set(agentData.id, agent);
      } catch (error) {
        console.error(`Failed to create agent ${agentData.name}:`, error);
      }
    }
    
    // Add agent retrieval method to processor
    processor.getAgentById = (id) => agentCache.get(id);
    
    // Process feeds sequentially but with concurrent translation
    for (const feed of feedsToUpdate) {
      try {
        console.log(`Processing feed: ${feed.name || feed.feed_url}`);
        
        const result = await processor.processFeedWithConcurrentTranslation(
          feed, 
          processor, 
          translationQueue
        );
        
        if (result.success && !result.notModified) {
          // Update feed metadata
          await db.updateFeed(feed.id, result.feedUpdates);
          
          // Save new entries
          for (const entry of result.entries || []) {
            try {
              // Check if entry already exists
              const existingEntry = await db.db.prepare(
                'SELECT id FROM entries WHERE feed_id = ? AND guid = ?'
              ).bind(feed.id, entry.guid).first();
              
              if (!existingEntry) {
                await db.createEntry({
                  ...entry,
                  feed_id: feed.id
                });
              }
            } catch (entryError) {
              console.error(`Failed to save entry for feed ${feed.id}:`, entryError);
            }
          }
          
          // Update feed usage statistics
          if (result.entries?.length > 0) {
            const totalTokens = result.entries.reduce((sum, e) => sum + (e.tokens_used || 0), 0);
            const totalChars = result.entries.reduce((sum, e) => sum + (e.characters_used || 0), 0);
            
            await db.db.prepare(`
              UPDATE feeds 
              SET total_tokens = total_tokens + ?, 
                  total_characters = total_characters + ?,
                  last_translate = ?
              WHERE id = ?
            `).bind(totalTokens, totalChars, new Date().toISOString(), feed.id).run();
          }
          
          updated++;
          results.push({ success: true, feed: feed.name || feed.feed_url, entries: result.entries?.length || 0 });
        } else if (result.notModified) {
          // Update last_fetch even if not modified
          await db.updateFeed(feed.id, { 
            last_fetch: new Date().toISOString(),
            fetch_status: true 
          });
          results.push({ success: true, feed: feed.name || feed.feed_url, notModified: true });
        } else {
          // Update error status
          await db.updateFeed(feed.id, result.feedUpdates || {
            fetch_status: false,
            log: result.error || 'Unknown error',
            last_fetch: new Date().toISOString()
          });
          
          errors++;
          results.push({ success: false, feed: feed.name || feed.feed_url, error: result.error });
        }
      } catch (error) {
        console.error(`Failed to process feed ${feed.id}:`, error);
        
        // Update error status
        await db.updateFeed(feed.id, {
          fetch_status: false,
          log: `${new Date().toISOString()}: ${error.message}`,
          last_fetch: new Date().toISOString()
        });
        
        errors++;
        results.push({ success: false, feed: feed.name || feed.feed_url, error: error.message });
      }
    }
    
    const endTime = new Date();
    const duration = Math.round((endTime - now) / 1000);
    
    console.log(`Feed update completed: ${updated} updated, ${errors} errors, ${duration}s`);
    
    return {
      success: true,
      updated,
      errors,
      duration,
      results
    };
    
  } catch (error) {
    console.error('Feed update process failed:', error);
    return {
      success: false,
      error: error.message,
      updated: 0,
      errors: 1
    };
  }
}

export async function updateSingleFeed(feedId, env) {
  const db = new Database(env.DB);
  const agentManager = new AgentManager(env);
  const processor = new FeedProcessor(env);
  const translationQueue = new TranslationQueue(3);
  
  try {
    const feed = await db.getFeedById(feedId);
    if (!feed) {
      throw new Error('Feed not found');
    }
    
    // Load agents
    const agents = await db.getAgents();
    const agentCache = new Map();
    
    for (const agentData of agents.results || []) {
      try {
        const agent = agentManager.createAgent(agentData.type, {
          ...JSON.parse(agentData.config || '{}'),
          name: agentData.name,
          valid: agentData.valid
        });
        agentCache.set(agentData.id, agent);
      } catch (error) {
        console.error(`Failed to create agent ${agentData.name}:`, error);
      }
    }
    
    processor.getAgentById = (id) => agentCache.get(id);
    
    const result = await processor.processFeedWithConcurrentTranslation(
      feed, 
      processor, 
      translationQueue
    );
    
    if (result.success) {
      // Update feed metadata
      await db.updateFeed(feed.id, result.feedUpdates);
      
      // Save entries
      const savedEntries = [];
      for (const entry of result.entries || []) {
        try {
          const existingEntry = await db.db.prepare(
            'SELECT id FROM entries WHERE feed_id = ? AND guid = ?'
          ).bind(feed.id, entry.guid).first();
          
          if (!existingEntry) {
            const saveResult = await db.createEntry({
              ...entry,
              feed_id: feed.id
            });
            savedEntries.push({ ...entry, id: saveResult.meta.last_row_id });
          }
        } catch (entryError) {
          console.error(`Failed to save entry:`, entryError);
        }
      }
      
      return {
        success: true,
        feed,
        entries: savedEntries,
        message: `Updated ${savedEntries.length} entries`
      };
    } else {
      throw new Error(result.error || 'Feed processing failed');
    }
    
  } catch (error) {
    console.error(`Single feed update failed for feed ${feedId}:`, error);
    throw error;
  }
}

// Cleanup old entries
export async function cleanupOldEntries(env, daysToKeep = 30) {
  const db = new Database(env.DB);
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await db.db.prepare(`
      DELETE FROM entries 
      WHERE created_at < ? 
      AND id NOT IN (
        SELECT id FROM entries e1 
        WHERE e1.feed_id = entries.feed_id 
        ORDER BY e1.created_at DESC 
        LIMIT (SELECT max_posts FROM feeds WHERE id = e1.feed_id)
      )
    `).bind(cutoffDate.toISOString()).run();
    
    console.log(`Cleaned up ${result.changes} old entries`);
    
    return {
      success: true,
      deletedEntries: result.changes
    };
  } catch (error) {
    console.error('Cleanup failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}