import mongoose from 'mongoose';
import config from './config.js';
import { createLogger } from './logger.js';
import { createIndexes, getIndexStats } from './indexes.js';
import { performanceMonitor } from '../services/performanceMonitor.js';

const logger = createLogger('database');

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  async connect(uri = config.mongodb.uri) {
    const timerId = performanceMonitor.startTimer('database_connection');
    
    try {
      if (this.isConnected) {
        logger.info('Database already connected');
        return;
      }

      const options = {
        ...config.mongodb.options,
        bufferCommands: false,
        retryWrites: true,
        w: 'majority',
        // Performance optimizations
        maxPoolSize: 20,
        maxIdleTimeMS: 30000,
        compressors: ['zlib'],
        zlibCompressionLevel: 6
      };

      await mongoose.connect(uri, options);
      
      this.isConnected = true;
      this.retryCount = 0;
      
      performanceMonitor.endTimer(timerId, {
        operationType: 'database_connection',
        status: 'success',
        uri: uri.replace(/\/\/.*@/, '//***@') // Hide credentials
      });
      
      logger.info('Successfully connected to MongoDB');

      // Initialize indexes for performance
      await this.initializeIndexes();
      
      // Set up performance monitoring
      this.setupQueryMonitoring();

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        logger.error('MongoDB connection error:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
        this.handleReconnection();
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
        this.retryCount = 0;
      });

    } catch (error) {
      performanceMonitor.endTimer(timerId, {
        operationType: 'database_connection',
        status: 'error',
        error: error.message
      });
      logger.error('Failed to connect to MongoDB:', error);
      this.isConnected = false;
      await this.handleReconnection();
    }
  }

  async handleReconnection() {
    if (this.retryCount >= this.maxRetries) {
      logger.error(`Max reconnection attempts (${this.maxRetries}) reached`);
      return;
    }

    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
    
    logger.info(`Attempting to reconnect to MongoDB (attempt ${this.retryCount}/${this.maxRetries}) in ${delay}ms`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  async disconnect() {
    try {
      await mongoose.connection.close();
      this.isConnected = false;
      logger.info('Disconnected from MongoDB');
    } catch (error) {
      logger.error('Error disconnecting from MongoDB:', error);
    }
  }

  /**
   * Initialize database indexes for optimal performance
   */
  async initializeIndexes() {
    try {
      logger.info('Initializing database indexes...');
      
      const collections = await mongoose.connection.db.listCollections().toArray();
      
      for (const collectionInfo of collections) {
        if (collectionInfo.name === 'zlfn_objects') {
          const collection = mongoose.connection.db.collection(collectionInfo.name);
          await createIndexes(collection);
          
          const stats = await getIndexStats(collection);
          logger.info(`Collection ${collectionInfo.name}: ${stats.totalIndexes} indexes, ${stats.totalIndexSize} bytes`);
        }
      }
      
    } catch (error) {
      logger.error('Error initializing indexes:', error);
      // Don't throw - indexes are optimization, not critical
    }
  }

  /**
   * Set up query performance monitoring
   */
  setupQueryMonitoring() {
    // Monitor slow queries
    mongoose.set('debug', (collectionName, method, query, doc, options) => {
      const timerId = performanceMonitor.startTimer(`query_${method}_${collectionName}`);
      
      // Store timer for completion tracking
      if (!global.mongooseTimers) {
        global.mongooseTimers = new Map();
      }
      global.mongooseTimers.set(`${collectionName}_${method}_${Date.now()}`, timerId);
    });
  }

  /**
   * Get database performance statistics
   */
  async getStats() {
    if (!this.isConnected) {
      return null;
    }

    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      
      return {
        collections: stats.collections,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexSize: stats.indexSize,
        objects: stats.objects,
        avgObjSize: stats.avgObjSize,
        indexes: stats.indexes
      };
    } catch (error) {
      logger.error('Error getting database stats:', error);
      return null;
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck() {
    try {
      if (!this.isConnected) {
        return { status: 'disconnected', healthy: false };
      }

      const pingResult = await mongoose.connection.db.admin().ping();
      
      if (pingResult.ok === 1) {
        const stats = await this.getStats();
        return {
          status: 'connected',
          healthy: true,
          stats,
          connectionState: mongoose.connection.readyState
        };
      } else {
        return { status: 'ping_failed', healthy: false };
      }
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'error',
        healthy: false,
        error: error.message
      };
    }
  }

  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }
}

export const database = new DatabaseConnection();
export default database;
