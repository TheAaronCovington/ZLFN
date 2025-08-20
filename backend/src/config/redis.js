import { createClient } from 'redis';
import { createLogger } from './logger.js';

const logger = createLogger('redis');

class RedisConnection {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  async connect() {
    try {
      if (this.isConnected && this.client) {
        logger.info('Redis already connected');
        return this.client;
      }

      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            logger.error('Redis server refused connection');
            return new Error('Redis server refused connection');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            logger.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            logger.error('Redis max retry attempts reached');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.isConnected = true;
        this.retryCount = 0;
      });

      this.client.on('ready', () => {
        logger.info('Redis client ready');
      });

      this.client.on('end', () => {
        logger.warn('Redis client disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;

    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.quit();
        this.client = null;
        this.isConnected = false;
        logger.info('Disconnected from Redis');
      }
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
    }
  }

  getClient() {
    return this.client;
  }

  isReady() {
    return this.isConnected && this.client && this.client.isReady;
  }

  // Lock management utilities
  async acquireLock(key, ttl = 30000, retries = 3) {
    if (!this.isReady()) {
      throw new Error('Redis not connected');
    }

    const lockKey = `lock:${key}`;
    const lockValue = `${Date.now()}-${Math.random()}`;

    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.client.set(lockKey, lockValue, {
          PX: ttl, // TTL in milliseconds
          NX: true // Only set if key doesn't exist
        });

        if (result === 'OK') {
          logger.debug(`Lock acquired: ${lockKey}`);
          return { key: lockKey, value: lockValue, ttl };
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      } catch (error) {
        logger.error(`Error acquiring lock ${lockKey}:`, error);
        if (i === retries - 1) throw error;
      }
    }

    throw new Error(`Failed to acquire lock: ${lockKey}`);
  }

  async releaseLock(lockKey, lockValue) {
    if (!this.isReady()) {
      throw new Error('Redis not connected');
    }

    try {
      // Use Lua script to ensure atomic check-and-delete
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.client.eval(script, {
        keys: [lockKey],
        arguments: [lockValue]
      });

      if (result === 1) {
        logger.debug(`Lock released: ${lockKey}`);
        return true;
      } else {
        logger.warn(`Lock not owned or expired: ${lockKey}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error releasing lock ${lockKey}:`, error);
      throw error;
    }
  }

  async extendLock(lockKey, lockValue, ttl = 30000) {
    if (!this.isReady()) {
      throw new Error('Redis not connected');
    }

    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `;

      const result = await this.client.eval(script, {
        keys: [lockKey],
        arguments: [lockValue, ttl.toString()]
      });

      return result === 1;
    } catch (error) {
      logger.error(`Error extending lock ${lockKey}:`, error);
      throw error;
    }
  }
}

export const redis = new RedisConnection();
export default redis;
