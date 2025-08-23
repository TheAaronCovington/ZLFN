import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { performanceMonitor } from '../services/performanceMonitor.js';
import { batchProcessor } from '../services/batchProcessor.js';
import { cacheManager } from '../config/cache.js';
import database from '../config/database.js';
import { createLogger } from '../config/logger.js';

const router = express.Router();
const logger = createLogger('performance-api');

/**
 * Performance monitoring API endpoints
 * Phase 6: Performance & Scalability - Monitoring and analytics
 */

// Get performance statistics
router.get('/stats', authenticateToken, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const stats = await performanceMonitor.getStats(parseInt(days));
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting performance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get performance statistics'
    });
  }
});

// Get system resource usage
router.get('/resources', authenticateToken, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const resources = await performanceMonitor.monitorResources();
    
    res.json({
      success: true,
      data: resources
    });
  } catch (error) {
    logger.error('Error getting resource stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get resource statistics'
    });
  }
});

// Get database performance metrics
router.get('/database', authenticateToken, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const [healthCheck, stats] = await Promise.all([
      database.healthCheck(),
      database.getStats()
    ]);
    
    res.json({
      success: true,
      data: {
        health: healthCheck,
        stats,
        connection: database.getConnectionStatus()
      }
    });
  } catch (error) {
    logger.error('Error getting database stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get database statistics'
    });
  }
});

// Get cache performance metrics
router.get('/cache', authenticateToken, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const cacheStats = await cacheManager.getStats();
    
    res.json({
      success: true,
      data: cacheStats
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics'
    });
  }
});

// Get batch processing statistics
router.get('/batch', authenticateToken, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const batchStats = batchProcessor.getStats();
    
    res.json({
      success: true,
      data: batchStats
    });
  } catch (error) {
    logger.error('Error getting batch stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get batch processing statistics'
    });
  }
});

// Get batch job status
router.get('/batch/:jobId', authenticateToken, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const { jobId } = req.params;
    const jobStatus = await batchProcessor.getJobStatus(jobId);
    
    if (!jobStatus) {
      return res.status(404).json({
        success: false,
        error: 'Batch job not found'
      });
    }
    
    res.json({
      success: true,
      data: jobStatus
    });
  } catch (error) {
    logger.error('Error getting batch job status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get batch job status'
    });
  }
});

// Generate comprehensive performance report
router.get('/report', authenticateToken, requirePermission('canViewAnalytics'), async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const report = await performanceMonitor.generateReport(parseInt(days));
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    logger.error('Error generating performance report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate performance report'
    });
  }
});

// Clear cache by pattern (admin only)
router.delete('/cache/:pattern', authenticateToken, requirePermission('canManageSystem'), async (req, res) => {
  try {
    const { pattern } = req.params;
    
    const deletedCount = await cacheManager.invalidatePattern(pattern);
    
    res.json({
      success: true,
      data: {
        pattern,
        deletedCount
      }
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

// Warm up cache (admin only)
router.post('/cache/warmup', authenticateToken, requirePermission('canManageSystem'), async (req, res) => {
  try {
    const { warmUpFunctions = [] } = req.body;
    
    const results = await cacheManager.warmUp(warmUpFunctions);
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    logger.error('Error warming up cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to warm up cache'
    });
  }
});

// Clean up old batch jobs (admin only)
router.delete('/batch/cleanup/:hours', authenticateToken, requirePermission('canManageSystem'), async (req, res) => {
  try {
    const { hours } = req.params;
    
    const cleanedCount = await batchProcessor.cleanup(parseInt(hours));
    
    res.json({
      success: true,
      data: {
        cleanedCount,
        olderThanHours: parseInt(hours)
      }
    });
  } catch (error) {
    logger.error('Error cleaning up batch jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clean up batch jobs'
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const [dbHealth, cacheStats, resources] = await Promise.all([
      database.healthCheck(),
      cacheManager.getStats(),
      performanceMonitor.monitorResources()
    ]);
    
    const overallHealth = dbHealth.healthy && resources.memory.heapUsedPercent < 90;
    
    res.status(overallHealth ? 200 : 503).json({
      success: true,
      healthy: overallHealth,
      data: {
        database: dbHealth,
        cache: cacheStats,
        resources,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      healthy: false,
      error: 'Health check failed'
    });
  }
});

export default router;
