import { createLogger } from './logger.js';

const logger = createLogger('mongodb-indexes');

/**
 * Enhanced MongoDB index configuration for optimal performance
 * Phase 6.1: Performance & Scalability optimizations
 */
export const indexConfigurations = [
  // Primary indexes for core queries
  {
    name: 'id_unique',
    fields: { id: 1 },
    options: { unique: true, background: true }
  },
  
  // Compound indexes for common query patterns
  {
    name: 'author_modified_compound',
    fields: { 'metadata.author': 1, 'metadata.modified': -1 },
    options: { background: true }
  },
  
  {
    name: 'public_modified_compound',
    fields: { 'metadata.isPublic': 1, 'metadata.modified': -1 },
    options: { background: true }
  },
  
  {
    name: 'tags_modified_compound',
    fields: { 'metadata.tags': 1, 'metadata.modified': -1 },
    options: { background: true }
  },
  
  // Date range queries optimization
  {
    name: 'created_date_range',
    fields: { 'metadata.created': -1 },
    options: { background: true }
  },
  
  {
    name: 'accessed_tracking',
    fields: { 'metadata.lastAccessed': -1 },
    options: { background: true }
  },
  
  // Full-text search optimization
  {
    name: 'text_search_comprehensive',
    fields: { 
      title: 'text', 
      markdownContent: 'text', 
      'metadata.description': 'text',
      'notes.$**': 'text' 
    },
    options: { 
      background: true,
      weights: {
        title: 10,
        'metadata.description': 5,
        markdownContent: 3,
        'notes.$**': 1
      },
      name: 'comprehensive_text_search'
    }
  },
  
  // Collaboration and locking indexes
  {
    name: 'collaboration_locks',
    fields: { 'collaboration.editLocks': 1 },
    options: { background: true, sparse: true }
  },
  
  {
    name: 'active_collaborators',
    fields: { 'collaboration.activeUsers': 1, 'metadata.modified': -1 },
    options: { background: true, sparse: true }
  },
  
  // Version history optimization
  {
    name: 'version_timestamp',
    fields: { 'versionHistory.timestamp': -1 },
    options: { background: true, sparse: true }
  },
  
  // ZLFN structure optimization for graph queries
  {
    name: 'zlfn_nodes_type',
    fields: { 'zlfnJson.nodes.type': 1 },
    options: { background: true, sparse: true }
  },
  
  {
    name: 'zlfn_nodes_zone',
    fields: { 'zlfnJson.nodes.zone': 1 },
    options: { background: true, sparse: true }
  },
  
  // Performance monitoring indexes
  {
    name: 'size_tracking',
    fields: { 'metadata.created': -1 },
    options: { 
      background: true,
      partialFilterExpression: {
        $expr: {
          $gt: [{ $bsonSize: '$$ROOT' }, 1024 * 100] // Documents > 100KB
        }
      }
    }
  }
];

/**
 * Create all indexes for a given collection
 */
export async function createIndexes(collection) {
  try {
    logger.info('Creating MongoDB indexes...');
    
    const results = [];
    
    for (const indexConfig of indexConfigurations) {
      try {
        const result = await collection.createIndex(
          indexConfig.fields,
          { ...indexConfig.options, name: indexConfig.name }
        );
        
        results.push({
          name: indexConfig.name,
          result,
          status: 'created'
        });
        
        logger.debug(`Created index: ${indexConfig.name}`);
      } catch (error) {
        if (error.code === 85) { // Index already exists
          results.push({
            name: indexConfig.name,
            status: 'exists'
          });
          logger.debug(`Index already exists: ${indexConfig.name}`);
        } else {
          results.push({
            name: indexConfig.name,
            error: error.message,
            status: 'failed'
          });
          logger.error(`Failed to create index ${indexConfig.name}:`, error);
        }
      }
    }
    
    logger.info(`Index creation completed. ${results.length} indexes processed.`);
    return results;
    
  } catch (error) {
    logger.error('Error creating indexes:', error);
    throw error;
  }
}

/**
 * Get index statistics and performance metrics
 */
export async function getIndexStats(collection) {
  try {
    const stats = await collection.stats();
    const indexes = await collection.listIndexes().toArray();
    
    return {
      totalIndexes: indexes.length,
      indexSizes: stats.indexSizes || {},
      totalIndexSize: stats.totalIndexSize || 0,
      indexes: indexes.map(idx => ({
        name: idx.name,
        key: idx.key,
        unique: idx.unique || false,
        sparse: idx.sparse || false,
        background: idx.background || false,
        textIndexVersion: idx.textIndexVersion,
        weights: idx.weights
      }))
    };
  } catch (error) {
    logger.error('Error getting index stats:', error);
    throw error;
  }
}

/**
 * Analyze query performance and suggest optimizations
 */
export async function analyzeQueryPerformance(collection, query, options = {}) {
  try {
    const explain = await collection.find(query, options).explain('executionStats');
    
    const stats = explain.executionStats;
    const performance = {
      totalDocsExamined: stats.totalDocsExamined,
      totalDocsReturned: stats.totalDocsReturned,
      executionTimeMillis: stats.executionTimeMillis,
      indexesUsed: [],
      efficiency: stats.totalDocsReturned / Math.max(stats.totalDocsExamined, 1),
      needsOptimization: false
    };
    
    // Extract index usage information
    if (stats.inputStage) {
      performance.indexesUsed = extractIndexUsage(stats.inputStage);
    }
    
    // Determine if optimization is needed
    performance.needsOptimization = 
      performance.efficiency < 0.1 || // Less than 10% efficiency
      performance.executionTimeMillis > 100 || // Takes more than 100ms
      stats.totalDocsExamined > 1000; // Examines too many documents
    
    return performance;
  } catch (error) {
    logger.error('Error analyzing query performance:', error);
    throw error;
  }
}

/**
 * Extract index usage from execution stats
 */
function extractIndexUsage(stage) {
  const indexes = [];
  
  if (stage.stage === 'IXSCAN') {
    indexes.push({
      name: stage.indexName,
      keysExamined: stage.keysExamined,
      docsExamined: stage.docsExamined
    });
  }
  
  if (stage.inputStage) {
    indexes.push(...extractIndexUsage(stage.inputStage));
  }
  
  if (stage.inputStages) {
    for (const inputStage of stage.inputStages) {
      indexes.push(...extractIndexUsage(inputStage));
    }
  }
  
  return indexes;
}

/**
 * Drop unused or redundant indexes
 */
export async function optimizeIndexes(collection) {
  try {
    logger.info('Analyzing index usage...');
    
    // Get index usage statistics (requires MongoDB 3.2+)
    const indexStats = await collection.aggregate([
      { $indexStats: {} }
    ]).toArray();
    
    const recommendations = [];
    
    for (const stat of indexStats) {
      const usage = stat.accesses;
      const indexName = stat.name;
      
      // Skip the default _id index
      if (indexName === '_id_') continue;
      
      // Recommend removal if index hasn't been used
      if (usage.ops === 0) {
        recommendations.push({
          action: 'consider_removal',
          index: indexName,
          reason: 'Index has not been used',
          usage: usage
        });
      }
      
      // Recommend optimization if index is used but inefficient
      if (usage.ops > 0 && usage.since) {
        const daysSinceLastUse = (new Date() - usage.since) / (1000 * 60 * 60 * 24);
        if (daysSinceLastUse > 30) {
          recommendations.push({
            action: 'review_usage',
            index: indexName,
            reason: `Index last used ${Math.round(daysSinceLastUse)} days ago`,
            usage: usage
          });
        }
      }
    }
    
    return {
      totalIndexes: indexStats.length,
      recommendations,
      indexStats
    };
    
  } catch (error) {
    logger.error('Error optimizing indexes:', error);
    throw error;
  }
}

export default {
  createIndexes,
  getIndexStats,
  analyzeQueryPerformance,
  optimizeIndexes,
  indexConfigurations
};
