import { createLogger } from '../config/logger.js';
import { performanceMonitor } from './performanceMonitor.js';
import { cacheManager, CacheNamespaces } from '../config/cache.js';

const logger = createLogger('batch-processor');

/**
 * Batch processing service for handling bulk operations efficiently
 * Phase 6.4: Batch processing and memory management
 */
export class BatchProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 100;
    this.concurrency = options.concurrency || 5;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.activeJobs = new Map();
    this.jobQueue = [];
    this.processing = false;
  }

  /**
   * Process items in batches with controlled concurrency
   */
  async processBatch(items, processor, options = {}) {
    const jobId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timerId = performanceMonitor.startTimer(jobId);
    
    try {
      const batchSize = options.batchSize || this.batchSize;
      const concurrency = options.concurrency || this.concurrency;
      
      logger.info(`Starting batch processing: ${items.length} items, batch size: ${batchSize}, concurrency: ${concurrency}`);
      
      const batches = this.createBatches(items, batchSize);
      const results = [];
      const errors = [];
      
      // Process batches with controlled concurrency
      for (let i = 0; i < batches.length; i += concurrency) {
        const batchGroup = batches.slice(i, i + concurrency);
        
        const batchPromises = batchGroup.map(async (batch, index) => {
          const batchId = `${jobId}_batch_${i + index}`;
          return this.processSingleBatch(batch, processor, batchId, options);
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(...result.value.results);
            if (result.value.errors.length > 0) {
              errors.push(...result.value.errors);
            }
          } else {
            errors.push({
              batchIndex: i + index,
              error: result.reason.message || 'Unknown batch error'
            });
          }
        });
        
        // Memory management: force garbage collection between batch groups
        if (global.gc && (i + concurrency) % (concurrency * 2) === 0) {
          global.gc();
        }
      }
      
      const metrics = performanceMonitor.endTimer(timerId, {
        operationType: 'batch_processing',
        totalItems: items.length,
        batchCount: batches.length,
        successCount: results.length,
        errorCount: errors.length,
        batchSize,
        concurrency
      });
      
      logger.info(`Batch processing completed: ${results.length} successful, ${errors.length} errors, ${metrics.duration.toFixed(2)}ms`);
      
      return {
        jobId,
        results,
        errors,
        metrics,
        summary: {
          totalItems: items.length,
          processed: results.length,
          failed: errors.length,
          duration: metrics.duration
        }
      };
      
    } catch (error) {
      performanceMonitor.endTimer(timerId, {
        operationType: 'batch_processing',
        error: error.message
      });
      logger.error('Batch processing failed:', error);
      throw error;
    }
  }

  /**
   * Process a single batch with retry logic
   */
  async processSingleBatch(batch, processor, batchId, options = {}) {
    const results = [];
    const errors = [];
    
    for (const item of batch) {
      let attempts = 0;
      let success = false;
      
      while (attempts < this.retryAttempts && !success) {
        try {
          const result = await processor(item, { batchId, attempt: attempts });
          results.push(result);
          success = true;
        } catch (error) {
          attempts++;
          
          if (attempts >= this.retryAttempts) {
            errors.push({
              item,
              error: error.message,
              attempts
            });
            logger.error(`Item processing failed after ${attempts} attempts:`, error);
          } else {
            logger.warn(`Item processing failed, retrying (${attempts}/${this.retryAttempts}):`, error);
            await this.delay(this.retryDelay * attempts); // Exponential backoff
          }
        }
      }
    }
    
    return { results, errors };
  }

  /**
   * Create batches from array of items
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Queue-based batch processing for background jobs
   */
  async queueBatchJob(items, processor, options = {}) {
    const jobId = `queued_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const job = {
      id: jobId,
      items,
      processor,
      options,
      status: 'queued',
      createdAt: new Date(),
      progress: 0
    };
    
    this.jobQueue.push(job);
    this.activeJobs.set(jobId, job);
    
    logger.info(`Batch job queued: ${jobId} (${items.length} items)`);
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
    
    return jobId;
  }

  /**
   * Process job queue
   */
  async processQueue() {
    if (this.processing) {
      return;
    }
    
    this.processing = true;
    logger.info('Starting batch job queue processing');
    
    try {
      while (this.jobQueue.length > 0) {
        const job = this.jobQueue.shift();
        
        if (!job) continue;
        
        job.status = 'processing';
        job.startedAt = new Date();
        
        try {
          const result = await this.processBatch(job.items, job.processor, job.options);
          
          job.status = 'completed';
          job.completedAt = new Date();
          job.result = result;
          job.progress = 100;
          
          logger.info(`Batch job completed: ${job.id}`);
          
        } catch (error) {
          job.status = 'failed';
          job.completedAt = new Date();
          job.error = error.message;
          
          logger.error(`Batch job failed: ${job.id}`, error);
        }
        
        // Cache job result for retrieval
        await cacheManager.set(
          cacheManager.generateKey(CacheNamespaces.ANALYTICS, 'batch_job', { id: job.id }),
          job,
          24 * 3600 // 24 hours
        );
      }
    } finally {
      this.processing = false;
      logger.info('Batch job queue processing completed');
    }
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    // Check active jobs first
    if (this.activeJobs.has(jobId)) {
      return this.activeJobs.get(jobId);
    }
    
    // Check cache for completed jobs
    const cachedJob = await cacheManager.get(
      cacheManager.generateKey(CacheNamespaces.ANALYTICS, 'batch_job', { id: jobId })
    );
    
    return cachedJob || null;
  }

  /**
   * Bulk database operations with optimized batching
   */
  async bulkInsert(collection, documents, options = {}) {
    const batchSize = options.batchSize || 1000;
    
    return this.processBatch(
      documents,
      async (batch) => {
        const result = await collection.insertMany(batch, {
          ordered: false, // Continue on errors
          ...options
        });
        return result;
      },
      { batchSize }
    );
  }

  /**
   * Bulk update operations
   */
  async bulkUpdate(collection, updates, options = {}) {
    const batchSize = options.batchSize || 500;
    
    return this.processBatch(
      updates,
      async (batch) => {
        const bulkOps = batch.map(update => ({
          updateOne: {
            filter: update.filter,
            update: update.update,
            upsert: update.upsert || false
          }
        }));
        
        const result = await collection.bulkWrite(bulkOps, {
          ordered: false,
          ...options
        });
        return result;
      },
      { batchSize }
    );
  }

  /**
   * Bulk delete operations
   */
  async bulkDelete(collection, filters, options = {}) {
    const batchSize = options.batchSize || 500;
    
    return this.processBatch(
      filters,
      async (batch) => {
        const bulkOps = batch.map(filter => ({
          deleteOne: { filter }
        }));
        
        const result = await collection.bulkWrite(bulkOps, {
          ordered: false,
          ...options
        });
        return result;
      },
      { batchSize }
    );
  }

  /**
   * Memory-efficient streaming processor
   */
  async processStream(stream, processor, options = {}) {
    const batchSize = options.batchSize || this.batchSize;
    let batch = [];
    let totalProcessed = 0;
    const results = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', async (chunk) => {
        batch.push(chunk);
        
        if (batch.length >= batchSize) {
          try {
            const batchResult = await this.processSingleBatch(
              batch, 
              processor, 
              `stream_batch_${totalProcessed}`,
              options
            );
            
            results.push(...batchResult.results);
            totalProcessed += batch.length;
            batch = [];
            
            // Memory management
            if (global.gc && totalProcessed % (batchSize * 10) === 0) {
              global.gc();
            }
            
          } catch (error) {
            stream.destroy();
            reject(error);
            return;
          }
        }
      });
      
      stream.on('end', async () => {
        try {
          // Process remaining items
          if (batch.length > 0) {
            const batchResult = await this.processSingleBatch(
              batch, 
              processor, 
              `stream_batch_final`,
              options
            );
            results.push(...batchResult.results);
            totalProcessed += batch.length;
          }
          
          resolve({
            totalProcessed,
            results
          });
        } catch (error) {
          reject(error);
        }
      });
      
      stream.on('error', reject);
    });
  }

  /**
   * Utility: delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clean up completed jobs
   */
  async cleanup(olderThanHours = 24) {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.completedAt && job.completedAt < cutoff) {
        this.activeJobs.delete(jobId);
        cleaned++;
      }
    }
    
    logger.info(`Cleaned up ${cleaned} completed batch jobs`);
    return cleaned;
  }

  /**
   * Get processing statistics
   */
  getStats() {
    const activeCount = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'processing').length;
    
    const queuedCount = this.jobQueue.length;
    
    const completedCount = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'completed').length;
    
    const failedCount = Array.from(this.activeJobs.values())
      .filter(job => job.status === 'failed').length;
    
    return {
      active: activeCount,
      queued: queuedCount,
      completed: completedCount,
      failed: failedCount,
      total: this.activeJobs.size,
      processing: this.processing
    };
  }
}

// Singleton instance
export const batchProcessor = new BatchProcessor();

export default batchProcessor;
