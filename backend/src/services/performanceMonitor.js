import { createLogger } from '../config/logger.js';
import { cacheManager, CacheNamespaces } from '../config/cache.js';

const logger = createLogger('performance-monitor');

/**
 * Performance monitoring and optimization service
 * Phase 6.3: Frontend and backend performance tracking
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.slowQueryThreshold = 100; // ms
    this.memoryThreshold = 0.8; // 80% of available memory
    this.alertCallbacks = [];
  }

  /**
   * Start timing a operation
   */
  startTimer(operationId) {
    this.metrics.set(operationId, {
      startTime: process.hrtime.bigint(),
      memoryStart: process.memoryUsage()
    });
    return operationId;
  }

  /**
   * End timing and record metrics
   */
  endTimer(operationId, metadata = {}) {
    const metric = this.metrics.get(operationId);
    if (!metric) {
      logger.warn(`Timer not found: ${operationId}`);
      return null;
    }

    const endTime = process.hrtime.bigint();
    const memoryEnd = process.memoryUsage();
    
    const duration = Number(endTime - metric.startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = {
      rss: memoryEnd.rss - metric.memoryStart.rss,
      heapUsed: memoryEnd.heapUsed - metric.memoryStart.heapUsed,
      heapTotal: memoryEnd.heapTotal - metric.memoryStart.heapTotal,
      external: memoryEnd.external - metric.memoryStart.external
    };

    const result = {
      operationId,
      duration,
      memoryDelta,
      timestamp: new Date(),
      ...metadata
    };

    // Log slow operations
    if (duration > this.slowQueryThreshold) {
      logger.warn(`Slow operation detected: ${operationId} took ${duration.toFixed(2)}ms`, {
        duration,
        memoryDelta,
        metadata
      });
    }

    // Clean up
    this.metrics.delete(operationId);

    // Store metrics for analysis
    this.recordMetric(result);

    return result;
  }

  /**
   * Record metric for later analysis
   */
  async recordMetric(metric) {
    try {
      const key = cacheManager.generateKey(CacheNamespaces.ANALYTICS, 'performance', {
        date: new Date().toISOString().split('T')[0] // Daily buckets
      });

      // Get existing metrics for the day
      const dailyMetrics = await cacheManager.get(key) || [];
      dailyMetrics.push(metric);

      // Keep only last 1000 metrics per day
      if (dailyMetrics.length > 1000) {
        dailyMetrics.splice(0, dailyMetrics.length - 1000);
      }

      // Cache for 25 hours (overlap for timezone handling)
      await cacheManager.set(key, dailyMetrics, 25 * 3600);
    } catch (error) {
      logger.error('Error recording metric:', error);
    }
  }

  /**
   * Get performance statistics
   */
  async getStats(days = 7) {
    try {
      const stats = {
        totalOperations: 0,
        averageDuration: 0,
        slowOperations: 0,
        memoryUsage: {
          average: 0,
          peak: 0
        },
        operationTypes: {},
        dailyBreakdown: []
      };

      // Collect metrics from multiple days
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const key = cacheManager.generateKey(CacheNamespaces.ANALYTICS, 'performance', {
          date: dateStr
        });

        const dailyMetrics = await cacheManager.get(key) || [];
        
        if (dailyMetrics.length > 0) {
          const dayStats = this.analyzeDailyMetrics(dailyMetrics);
          stats.dailyBreakdown.push({
            date: dateStr,
            ...dayStats
          });

          // Aggregate totals
          stats.totalOperations += dayStats.totalOperations;
          stats.slowOperations += dayStats.slowOperations;
          
          // Track operation types
          Object.entries(dayStats.operationTypes).forEach(([type, count]) => {
            stats.operationTypes[type] = (stats.operationTypes[type] || 0) + count;
          });
        }
      }

      // Calculate averages
      if (stats.totalOperations > 0) {
        const allDurations = stats.dailyBreakdown.flatMap(day => 
          day.durations || []
        );
        stats.averageDuration = allDurations.reduce((a, b) => a + b, 0) / allDurations.length;
        
        const allMemoryUsage = stats.dailyBreakdown.flatMap(day => 
          day.memoryUsage || []
        );
        stats.memoryUsage.average = allMemoryUsage.reduce((a, b) => a + b, 0) / allMemoryUsage.length;
        stats.memoryUsage.peak = Math.max(...allMemoryUsage);
      }

      return stats;
    } catch (error) {
      logger.error('Error getting performance stats:', error);
      return null;
    }
  }

  /**
   * Analyze daily metrics
   */
  analyzeDailyMetrics(metrics) {
    const durations = metrics.map(m => m.duration);
    const memoryUsage = metrics.map(m => m.memoryDelta.heapUsed);
    const operationTypes = {};

    metrics.forEach(metric => {
      const type = metric.operationType || 'unknown';
      operationTypes[type] = (operationTypes[type] || 0) + 1;
    });

    return {
      totalOperations: metrics.length,
      slowOperations: metrics.filter(m => m.duration > this.slowQueryThreshold).length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      durations,
      memoryUsage,
      operationTypes
    };
  }

  /**
   * Monitor system resources
   */
  async monitorResources() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    const stats = {
      memory: {
        rss: usage.rss,
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
        heapUsedPercent: (usage.heapUsed / usage.heapTotal) * 100
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      timestamp: new Date()
    };

    // Check for memory alerts
    if (stats.memory.heapUsedPercent > this.memoryThreshold * 100) {
      this.triggerAlert('high_memory_usage', {
        heapUsedPercent: stats.memory.heapUsedPercent,
        threshold: this.memoryThreshold * 100
      });
    }

    return stats;
  }

  /**
   * Database query performance monitoring
   */
  async monitorQuery(collection, query, options = {}) {
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.startTimer(queryId);
    
    try {
      // Execute query with explain
      const explain = await collection.find(query, options).explain('executionStats');
      const result = await collection.find(query, options).toArray();
      
      const metrics = this.endTimer(queryId, {
        operationType: 'database_query',
        collection: collection.collectionName,
        query: JSON.stringify(query),
        options: JSON.stringify(options),
        docsExamined: explain.executionStats.totalDocsExamined,
        docsReturned: explain.executionStats.totalDocsReturned,
        indexesUsed: this.extractIndexesUsed(explain.executionStats),
        executionTimeMillis: explain.executionStats.executionTimeMillis
      });

      // Log inefficient queries
      const efficiency = metrics.docsReturned / Math.max(metrics.docsExamined, 1);
      if (efficiency < 0.1) {
        logger.warn('Inefficient query detected', {
          queryId,
          efficiency,
          docsExamined: metrics.docsExamined,
          docsReturned: metrics.docsReturned
        });
      }

      return { result, metrics };
    } catch (error) {
      this.endTimer(queryId, {
        operationType: 'database_query',
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Extract indexes used from explain output
   */
  extractIndexesUsed(executionStats) {
    const indexes = [];
    
    function traverse(stage) {
      if (stage.stage === 'IXSCAN') {
        indexes.push(stage.indexName);
      }
      if (stage.inputStage) {
        traverse(stage.inputStage);
      }
      if (stage.inputStages) {
        stage.inputStages.forEach(traverse);
      }
    }
    
    traverse(executionStats);
    return indexes;
  }

  /**
   * Add alert callback
   */
  onAlert(callback) {
    this.alertCallbacks.push(callback);
  }

  /**
   * Trigger performance alert
   */
  triggerAlert(type, data) {
    const alert = {
      type,
      data,
      timestamp: new Date(),
      severity: this.getAlertSeverity(type, data)
    };

    logger.warn(`Performance alert: ${type}`, alert);

    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        logger.error('Alert callback error:', error);
      }
    });
  }

  /**
   * Determine alert severity
   */
  getAlertSeverity(type, data) {
    switch (type) {
      case 'high_memory_usage':
        return data.heapUsedPercent > 90 ? 'critical' : 'warning';
      case 'slow_query':
        return data.duration > 1000 ? 'critical' : 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Generate performance report
   */
  async generateReport(days = 7) {
    const stats = await this.getStats(days);
    const resources = await this.monitorResources();
    const cacheStats = await cacheManager.getStats();

    return {
      reportDate: new Date(),
      period: `${days} days`,
      performance: stats,
      resources,
      cache: cacheStats,
      recommendations: this.generateRecommendations(stats, resources, cacheStats)
    };
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(perfStats, resources, cacheStats) {
    const recommendations = [];

    // Memory recommendations
    if (resources.memory.heapUsedPercent > 80) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        message: 'High memory usage detected. Consider optimizing data structures or increasing memory allocation.',
        metric: `${resources.memory.heapUsedPercent.toFixed(1)}% heap used`
      });
    }

    // Query performance recommendations
    if (perfStats && perfStats.slowOperations > perfStats.totalOperations * 0.1) {
      recommendations.push({
        type: 'query_performance',
        priority: 'medium',
        message: 'High number of slow operations detected. Review database indexes and query patterns.',
        metric: `${perfStats.slowOperations} slow operations out of ${perfStats.totalOperations}`
      });
    }

    // Cache recommendations
    if (cacheStats && cacheStats.hitRate < 0.7) {
      recommendations.push({
        type: 'cache_efficiency',
        priority: 'medium',
        message: 'Low cache hit rate. Consider adjusting cache TTL or warming up frequently accessed data.',
        metric: `${(cacheStats.hitRate * 100).toFixed(1)}% hit rate`
      });
    }

    return recommendations;
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Middleware for automatic performance monitoring
 */
export function performanceMiddleware(operationType = 'request') {
  return (req, res, next) => {
    const timerId = performanceMonitor.startTimer(`${operationType}_${req.method}_${req.path}`);
    
    // Store timer ID for cleanup
    req.performanceTimerId = timerId;
    
    // Override res.end to capture completion
    const originalEnd = res.end;
    res.end = function(...args) {
      performanceMonitor.endTimer(timerId, {
        operationType,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
      
      originalEnd.apply(this, args);
    };
    
    next();
  };
}

export default performanceMonitor;
