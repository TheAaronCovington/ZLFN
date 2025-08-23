import redis from './redis.js';
import { createLogger } from './logger.js';

const logger = createLogger('cache-manager');

/**
 * Enhanced Redis caching system for Phase 6.2: Performance & Scalability
 */
export class CacheManager {
  constructor() {
    this.defaultTTL = 3600; // 1 hour default
    this.keyPrefix = 'xv:';
    this.compressionThreshold = 1024; // Compress values > 1KB
  }

  /**
   * Generate cache key with consistent formatting
   */
  generateKey(namespace, identifier, params = {}) {
    const paramString = Object.keys(params).length > 0 
      ? `:${JSON.stringify(params)}` 
      : '';
    return `${this.keyPrefix}${namespace}:${identifier}${paramString}`;
  }

  /**
   * Set cache value with optional compression and TTL
   */
  async set(key, value, ttl = this.defaultTTL, options = {}) {
    if (!redis.isReady()) {
      logger.warn('Redis not ready, skipping cache set');
      return false;
    }

    try {
      let serializedValue = JSON.stringify(value);
      
      // Compress large values
      if (serializedValue.length > this.compressionThreshold && options.compress !== false) {
        const zlib = await import('zlib');
        serializedValue = zlib.gzipSync(serializedValue).toString('base64');
        key = `${key}:compressed`;
      }

      await redis.getClient().setEx(key, ttl, serializedValue);
      
      logger.debug(`Cache set: ${key} (TTL: ${ttl}s, Size: ${serializedValue.length})`);
      return true;
    } catch (error) {
      logger.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get cache value with automatic decompression
   */
  async get(key) {
    if (!redis.isReady()) {
      return null;
    }

    try {
      // Try compressed version first
      let value = await redis.getClient().get(`${key}:compressed`);
      let isCompressed = true;
      
      // Fall back to uncompressed
      if (!value) {
        value = await redis.getClient().get(key);
        isCompressed = false;
      }

      if (!value) {
        return null;
      }

      // Decompress if needed
      if (isCompressed) {
        const zlib = await import('zlib');
        value = zlib.gunzipSync(Buffer.from(value, 'base64')).toString();
      }

      const result = JSON.parse(value);
      logger.debug(`Cache hit: ${key} (compressed: ${isCompressed})`);
      return result;
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  async del(key) {
    if (!redis.isReady()) {
      return false;
    }

    try {
      const deleted = await redis.getClient().del(key, `${key}:compressed`);
      logger.debug(`Cache deleted: ${key} (${deleted} keys removed)`);
      return deleted > 0;
    } catch (error) {
      logger.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern) {
    if (!redis.isReady()) {
      return 0;
    }

    try {
      const keys = await redis.getClient().keys(`${this.keyPrefix}${pattern}`);
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await redis.getClient().del(...keys);
      logger.info(`Cache pattern invalidated: ${pattern} (${deleted} keys removed)`);
      return deleted;
    } catch (error) {
      logger.error('Cache pattern invalidation error:', error);
      return 0;
    }
  }

  /**
   * Cache with automatic refresh
   */
  async getOrSet(key, fetchFunction, ttl = this.defaultTTL, options = {}) {
    // Try to get from cache first
    let value = await this.get(key);
    
    if (value !== null) {
      // Refresh in background if TTL is low
      if (options.backgroundRefresh) {
        const remainingTTL = await this.getTTL(key);
        if (remainingTTL < ttl * 0.1) { // Less than 10% TTL remaining
          this.refreshInBackground(key, fetchFunction, ttl, options);
        }
      }
      return value;
    }

    // Cache miss - fetch and cache
    try {
      value = await fetchFunction();
      await this.set(key, value, ttl, options);
      return value;
    } catch (error) {
      logger.error('Cache fetch function error:', error);
      throw error;
    }
  }

  /**
   * Get remaining TTL for a key
   */
  async getTTL(key) {
    if (!redis.isReady()) {
      return -1;
    }

    try {
      return await redis.getClient().ttl(key);
    } catch (error) {
      logger.error('Cache TTL error:', error);
      return -1;
    }
  }

  /**
   * Refresh cache in background
   */
  async refreshInBackground(key, fetchFunction, ttl, options) {
    try {
      logger.debug(`Background refresh started: ${key}`);
      const value = await fetchFunction();
      await this.set(key, value, ttl, options);
      logger.debug(`Background refresh completed: ${key}`);
    } catch (error) {
      logger.error(`Background refresh failed for ${key}:`, error);
    }
  }

  /**
   * Batch operations for multiple keys
   */
  async mget(keys) {
    if (!redis.isReady() || keys.length === 0) {
      return {};
    }

    try {
      const pipeline = redis.getClient().pipeline();
      
      // Add all keys to pipeline (both compressed and uncompressed)
      keys.forEach(key => {
        pipeline.get(key);
        pipeline.get(`${key}:compressed`);
      });

      const results = await pipeline.exec();
      const values = {};

      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const uncompressed = results[i * 2][1];
        const compressed = results[i * 2 + 1][1];

        let value = uncompressed || compressed;
        if (value) {
          try {
            // Decompress if it was the compressed version
            if (!uncompressed && compressed) {
              const zlib = await import('zlib');
              value = zlib.gunzipSync(Buffer.from(value, 'base64')).toString();
            }
            values[key] = JSON.parse(value);
          } catch (parseError) {
            logger.error(`Parse error for key ${key}:`, parseError);
          }
        }
      }

      logger.debug(`Batch get: ${keys.length} keys, ${Object.keys(values).length} hits`);
      return values;
    } catch (error) {
      logger.error('Batch get error:', error);
      return {};
    }
  }

  /**
   * Cache statistics and monitoring
   */
  async getStats() {
    if (!redis.isReady()) {
      return null;
    }

    try {
      const info = await redis.getClient().info('memory');
      const keyCount = await redis.getClient().dbsize();
      
      // Parse memory info
      const memoryInfo = {};
      info.split('\r\n').forEach(line => {
        const [key, value] = line.split(':');
        if (key && value) {
          memoryInfo[key] = value;
        }
      });

      return {
        keyCount,
        usedMemory: memoryInfo.used_memory_human,
        usedMemoryPeak: memoryInfo.used_memory_peak_human,
        keyspaceHits: memoryInfo.keyspace_hits,
        keyspaceMisses: memoryInfo.keyspace_misses,
        hitRate: memoryInfo.keyspace_hits / 
          (parseInt(memoryInfo.keyspace_hits) + parseInt(memoryInfo.keyspace_misses))
      };
    } catch (error) {
      logger.error('Cache stats error:', error);
      return null;
    }
  }

  /**
   * Warm up cache with frequently accessed data
   */
  async warmUp(warmUpFunctions = []) {
    logger.info('Starting cache warm-up...');
    
    const results = [];
    for (const { key, fetchFunction, ttl } of warmUpFunctions) {
      try {
        const value = await fetchFunction();
        await this.set(key, value, ttl);
        results.push({ key, status: 'success' });
        logger.debug(`Warmed up: ${key}`);
      } catch (error) {
        results.push({ key, status: 'failed', error: error.message });
        logger.error(`Warm-up failed for ${key}:`, error);
      }
    }
    
    logger.info(`Cache warm-up completed: ${results.length} items processed`);
    return results;
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

/**
 * Specialized cache namespaces for different data types
 */
export const CacheNamespaces = {
  OBJECTS: 'objects',
  SEARCH: 'search',
  USERS: 'users',
  SESSIONS: 'sessions',
  ANALYTICS: 'analytics',
  LOCKS: 'locks',
  VERSIONS: 'versions'
};

/**
 * Cache decorators for common patterns
 */
export function cached(namespace, ttl = 3600, options = {}) {
  return function(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args) {
      const key = cacheManager.generateKey(namespace, propertyKey, { args });
      
      return await cacheManager.getOrSet(
        key,
        () => originalMethod.apply(this, args),
        ttl,
        options
      );
    };
    
    return descriptor;
  };
}

/**
 * Cache invalidation helper
 */
export async function invalidateObjectCache(objectId) {
  await cacheManager.invalidatePattern(`${CacheNamespaces.OBJECTS}:${objectId}*`);
  await cacheManager.invalidatePattern(`${CacheNamespaces.SEARCH}:*`);
}

export default cacheManager;
