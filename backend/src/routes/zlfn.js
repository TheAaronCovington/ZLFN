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
    const { q, tags, author, limit = 20, offset = 0 } = req.query;
    let query = {};
    
    // Build search query
    if (q) {
      const searchResults = await ZLFNObject.searchContent(q, { tags, author, limit, offset });
      return res.json({
        success: true,
        data: searchResults,
        pagination: { limit, offset, hasMore: searchResults.length === limit }
      });
    }
    
    // Filter by tags
    if (tags && tags.length > 0) {
      query['metadata.tags'] = { $in: tags };
    }
    
    // Filter by author
    if (author) {
      query['metadata.author'] = author;
    }
    
    // Only show public objects if not authenticated
    if (!req.user) {
      query['metadata.isPublic'] = true;
    }
    
    const objects = await ZLFNObject.find(query)
      .select('id title metadata.created metadata.modified metadata.author metadata.tags')
      .sort({ 'metadata.modified': -1 })
      .skip(offset)
      .limit(limit);
    
    const total = await ZLFNObject.countDocuments(query);
    
    res.json({
      success: true,
      data: objects,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total
      }
    });
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
