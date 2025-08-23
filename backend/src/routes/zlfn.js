import express from 'express';
import ZLFNObject from '../models/ZLFNObject.js';
import { authenticateToken, optionalAuth, requirePermission } from '../middleware/auth.js';
import { 
  validateZLFNObject, 
  validateZLFNObjectUpdate, 
  validateObjectId, 
  validateNote,
  validateSearch,
  validateVersionRevert
} from '../middleware/validation.js';
import { createLogger } from '../config/logger.js';
import redis from '../config/redis.js';

const router = express.Router();
const logger = createLogger('zlfn-routes');

// Get all objects (with pagination and search)
router.get('/', optionalAuth, validateSearch, async (req, res) => {
  try {
    const { q, tags, author, limit = 20, offset = 0, dateFrom, dateTo } = req.query;
    
    // Create cache key from query parameters
    const cacheKey = `search:${JSON.stringify({ q, tags, author, limit, offset, dateFrom, dateTo, userId: req.user?.id })}`;
    
    // Try to get cached results first
    if (redis.isReady()) {
      try {
        const cached = await redis.getClient().get(cacheKey);
        if (cached) {
          logger.debug(`Cache hit for search: ${cacheKey}`);
          return res.json(JSON.parse(cached));
        }
      } catch (cacheError) {
        logger.warn('Cache read error:', cacheError);
      }
    }
    
    let query = {};
    let searchScore = {};
    
    // Build text search query with scoring
    if (q) {
      query.$text = { $search: q };
      searchScore = { score: { $meta: 'textScore' } };
    }
    
    // Filter by tags (support array or comma-separated string)
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
      if (tagArray.length > 0) {
        query['metadata.tags'] = { $in: tagArray };
      }
    }
    
    // Filter by author
    if (author) {
      query['metadata.author'] = author;
    }
    
    // Date range filtering
    if (dateFrom || dateTo) {
      query['metadata.created'] = {};
      if (dateFrom) query['metadata.created'].$gte = new Date(dateFrom);
      if (dateTo) query['metadata.created'].$lte = new Date(dateTo);
    }
    
    // Only show public objects if not authenticated
    if (!req.user) {
      query['metadata.isPublic'] = true;
    }
    
    // Build sort criteria (text score first, then modified date)
    let sortCriteria = { 'metadata.modified': -1 };
    if (q) {
      sortCriteria = { score: { $meta: 'textScore' }, 'metadata.modified': -1 };
    }
    
    // Execute search with aggregation for better performance
    const pipeline = [
      { $match: query },
      { $addFields: searchScore },
      { $sort: sortCriteria },
      {
        $facet: {
          data: [
            { $skip: parseInt(offset) },
            { $limit: parseInt(limit) },
            {
              $project: {
                id: 1,
                title: 1,
                'metadata.created': 1,
                'metadata.modified': 1,
                'metadata.author': 1,
                'metadata.tags': 1,
                'metadata.description': 1,
                score: searchScore.score ? { $meta: 'textScore' } : { $literal: 0 }
              }
            }
          ],
          totalCount: [{ $count: 'count' }]
        }
      }
    ];
    
    const [result] = await ZLFNObject.aggregate(pipeline);
    const objects = result.data;
    const total = result.totalCount[0]?.count || 0;
    
    const response = {
      success: true,
      data: objects,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total,
        hasMore: parseInt(offset) + parseInt(limit) < total
      },
      searchMeta: {
        query: q || null,
        filters: { tags, author, dateFrom, dateTo },
        executionTime: Date.now()
      }
    };
    
    // Cache the results for 1 hour
    if (redis.isReady()) {
      try {
        await redis.getClient().setEx(cacheKey, 3600, JSON.stringify(response));
        logger.debug(`Cached search results: ${cacheKey}`);
      } catch (cacheError) {
        logger.warn('Cache write error:', cacheError);
      }
    }
    
    res.json(response);
  } catch (error) {
    logger.error('Error fetching objects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch objects'
    });
  }
});

// Get object by ID
router.get('/:id', optionalAuth, validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    
    const object = await ZLFNObject.findOne({ id });
    
    if (!object) {
      return res.status(404).json({
        success: false,
        error: 'Object not found'
      });
    }
    
    // Check permissions
    if (!object.metadata.isPublic && (!req.user || object.metadata.author !== req.user.username)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Update last accessed
    await object.updateLastAccessed();
    
    res.json({
      success: true,
      data: object
    });
  } catch (error) {
    logger.error('Error fetching object:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch object'
    });
  }
});

// Create new object
router.post('/', authenticateToken, requirePermission('canCreateObjects'), validateZLFNObject, async (req, res) => {
  try {
    const { id, title, markdownContent, zlfnJson, notes } = req.body;
    
    // Check if object already exists
    const existing = await ZLFNObject.findOne({ id });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Object with this ID already exists'
      });
    }
    
    // Check user's object limit
    const userObjectCount = await ZLFNObject.countDocuments({ 'metadata.author': req.user.username });
    if (userObjectCount >= req.user.permissions.maxObjectsPerUser) {
      return res.status(429).json({
        success: false,
        error: 'Object limit reached'
      });
    }
    
    const object = new ZLFNObject({
      id,
      title,
      markdownContent: markdownContent || '',
      zlfnJson,
      notes: notes || new Map(),
      metadata: {
        author: req.user.username,
        created: new Date(),
        modified: new Date()
      }
    });
    
    // Add initial version
    object.addVersion({
      description: 'Initial version',
      changeType: 'create',
      author: req.user.username,
      zlfnJson,
      notes: notes || new Map()
    });
    
    await object.save();
    
    // Update user activity
    req.user.activity.objectsCreated += 1;
    await req.user.save();
    
    logger.info(`Object created: ${id} by ${req.user.username}`);
    
    res.status(201).json({
      success: true,
      data: object
    });
  } catch (error) {
    logger.error('Error creating object:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create object'
    });
  }
});

// Update object
router.put('/:id', authenticateToken, requirePermission('canEditObjects'), validateObjectId, validateZLFNObjectUpdate, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const object = await ZLFNObject.findOne({ id });
    
    if (!object) {
      return res.status(404).json({
        success: false,
        error: 'Object not found'
      });
    }
    
    // Check permissions
    if (object.metadata.author !== req.user.username && !req.user.hasRole('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Acquire lock for concurrent editing
    let lock = null;
    try {
      lock = await redis.acquireLock(`object:${id}`, 30000);
    } catch (lockError) {
      return res.status(423).json({
        success: false,
        error: 'Object is currently being edited by another user'
      });
    }
    
    try {
      // Create version before updating
      object.addVersion({
        description: updates.description || 'Object updated',
        changeType: 'update',
        author: req.user.username,
        zlfnJson: object.zlfnJson,
        notes: object.notes
      });
      
      // Apply updates
      if (updates.title) object.title = updates.title;
      if (updates.markdownContent !== undefined) object.markdownContent = updates.markdownContent;
      if (updates.zlfnJson) object.zlfnJson = updates.zlfnJson;
      if (updates.notes) object.notes = updates.notes;
      
      await object.save();
      
      // Update user activity
      req.user.activity.objectsModified += 1;
      await req.user.save();
      
      logger.info(`Object updated: ${id} by ${req.user.username}`);
      
      res.json({
        success: true,
        data: object
      });
    } finally {
      // Release lock
      if (lock) {
        await redis.releaseLock(lock.key, lock.value);
      }
    }
  } catch (error) {
    logger.error('Error updating object:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update object'
    });
  }
});

// Delete object
router.delete('/:id', authenticateToken, requirePermission('canDeleteObjects'), validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    
    const object = await ZLFNObject.findOne({ id });
    
    if (!object) {
      return res.status(404).json({
        success: false,
        error: 'Object not found'
      });
    }
    
    // Check permissions
    if (object.metadata.author !== req.user.username && !req.user.hasRole('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    await ZLFNObject.deleteOne({ id });
    
    logger.info(`Object deleted: ${id} by ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Object deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting object:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete object'
    });
  }
});

// Get object notes
router.get('/:id/notes', optionalAuth, validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    
    const object = await ZLFNObject.findOne({ id }).select('notes metadata.isPublic metadata.author');
    
    if (!object) {
      return res.status(404).json({
        success: false,
        error: 'Object not found'
      });
    }
    
    // Check permissions
    if (!object.metadata.isPublic && (!req.user || object.metadata.author !== req.user.username)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { notes: object.notes }
    });
  } catch (error) {
    logger.error('Error fetching notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notes'
    });
  }
});

// Update note
router.put('/:id/notes/:nodeId', authenticateToken, validateObjectId, validateNote, async (req, res) => {
  try {
    const { id, nodeId } = req.params;
    const { content } = req.body;
    
    const object = await ZLFNObject.findOne({ id });
    
    if (!object) {
      return res.status(404).json({
        success: false,
        error: 'Object not found'
      });
    }
    
    // Check permissions
    if (object.metadata.author !== req.user.username && !req.user.hasRole('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Create version snapshot for note changes
    object.addVersion({
      description: `Note ${content ? 'updated' : 'deleted'} for node ${nodeId}`,
      changeType: 'note',
      author: req.user.username,
      zlfnJson: object.zlfnJson,
      notes: object.notes
    });
    
    if (content) {
      object.notes.set(nodeId, content);
    } else {
      object.notes.delete(nodeId);
    }
    
    await object.save();
    
    logger.info(`Note ${content ? 'updated' : 'deleted'}: ${id}/${nodeId} by ${req.user.username}`);
    
    res.json({
      success: true,
      data: { notes: object.notes }
    });
  } catch (error) {
    logger.error('Error updating note:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update note'
    });
  }
});

// Get version history
router.get('/:id/versions', optionalAuth, validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    
    const object = await ZLFNObject.findOne({ id }).select('versionHistory metadata.isPublic metadata.author');
    
    if (!object) {
      return res.status(404).json({
        success: false,
        error: 'Object not found'
      });
    }
    
    // Check permissions
    if (!object.metadata.isPublic && (!req.user || object.metadata.author !== req.user.username)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    res.json({
      success: true,
      data: { versionHistory: object.versionHistory }
    });
  } catch (error) {
    logger.error('Error fetching version history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch version history'
    });
  }
});

// Revert to version
router.post('/:id/revert', authenticateToken, validateObjectId, validateVersionRevert, async (req, res) => {
  try {
    const { id } = req.params;
    const { timestamp } = req.body;
    
    const object = await ZLFNObject.findOne({ id });
    
    if (!object) {
      return res.status(404).json({
        success: false,
        error: 'Object not found'
      });
    }
    
    // Check permissions
    if (object.metadata.author !== req.user.username && !req.user.hasRole('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    object.revertToVersion(timestamp);
    await object.save();
    
    logger.info(`Object reverted: ${id} to ${timestamp} by ${req.user.username}`);
    
    res.json({
      success: true,
      data: object
    });
  } catch (error) {
    logger.error('Error reverting object:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to revert object'
    });
  }
});

// Create snapshot (for layout changes, etc.)
router.post('/:id/snapshot', authenticateToken, validateObjectId, async (req, res) => {
  try {
    const { id } = req.params;
    const { description, changeType, layout } = req.body;
    
    const object = await ZLFNObject.findOne({ id });
    
    if (!object) {
      return res.status(404).json({
        success: false,
        error: 'Object not found'
      });
    }
    
    // Check permissions
    if (object.metadata.author !== req.user.username && !req.user.hasRole('admin')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    object.addVersion({
      description: description || 'Snapshot created',
      changeType: changeType || 'update',
      author: req.user.username,
      zlfnJson: object.zlfnJson,
      notes: object.notes,
      layout: layout || new Map()
    });
    
    await object.save();
    
    logger.info(`Snapshot created: ${id} by ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Snapshot created successfully'
    });
  } catch (error) {
    logger.error('Error creating snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create snapshot'
    });
  }
});

export default router;
