import mongoose from 'mongoose';
import config from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('database');

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
  }

  async connect(uri = config.mongodb.uri) {
    try {
      if (this.isConnected) {
        logger.info('Database already connected');
        return;
      }

      const options = {
        ...config.mongodb.options,
        bufferCommands: false,
        bufferMaxEntries: 0,
        retryWrites: true,
        w: 'majority'
      };

      await mongoose.connect(uri, options);
      
      this.isConnected = true;
      this.retryCount = 0;
      
      logger.info('Successfully connected to MongoDB');

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
