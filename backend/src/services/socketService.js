import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ZLFNObject from '../models/ZLFNObject.js';
import { createLogger } from '../config/logger.js';
import redis from '../config/redis.js';

const logger = createLogger('socket');

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.objectSubscriptions = new Map();
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');

        if (!user || user.settings.accountLocked) {
          return next(new Error('Invalid or locked user'));
        }

        socket.userId = user._id.toString();
        socket.username = user.username;
        socket.user = user;
        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    logger.info('Socket service initialized');
  }

  handleConnection(socket) {
    const userId = socket.userId;
    const username = socket.username;

    logger.info(`User connected: ${username} (${socket.id})`);

    // Store user connection
    this.connectedUsers.set(userId, {
      socketId: socket.id,
      username,
      connectedAt: new Date(),
      activeObjects: new Set()
    });

    // Update user activity
    socket.user.activity.lastActive = new Date();
    socket.user.save().catch(err => logger.error('Error updating user activity:', err));

    // Send initial connection data
    socket.emit('connected', {
      userId,
      username,
      connectedUsers: Array.from(this.connectedUsers.values()).map(u => ({
        username: u.username,
        connectedAt: u.connectedAt
      }))
    });

    // Broadcast user joined to others
    socket.broadcast.emit('user:joined', { username, connectedAt: new Date() });

    // Handle object subscription
    socket.on('object:subscribe', async (data) => {
      await this.handleObjectSubscribe(socket, data);
    });

    socket.on('object:unsubscribe', async (data) => {
      await this.handleObjectUnsubscribe(socket, data);
    });

    // Handle real-time collaboration events
    socket.on('object:cursor', (data) => {
      this.handleCursorUpdate(socket, data);
    });

    socket.on('object:selection', (data) => {
      this.handleSelectionUpdate(socket, data);
    });

    socket.on('object:edit:start', async (data) => {
      await this.handleEditStart(socket, data);
    });

    socket.on('object:edit:end', async (data) => {
      await this.handleEditEnd(socket, data);
    });

    socket.on('object:change', (data) => {
      this.handleObjectChange(socket, data);
    });

    socket.on('note:change', (data) => {
      this.handleNoteChange(socket, data);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  async handleObjectSubscribe(socket, { objectId }) {
    try {
      const userId = socket.userId;
      const username = socket.username;

      // Verify object exists and user has access
      const object = await ZLFNObject.findOne({ id: objectId });
      if (!object) {
        socket.emit('error', { message: 'Object not found' });
        return;
      }

      if (!object.metadata.isPublic && object.metadata.author !== username) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      // Join object room
      socket.join(`object:${objectId}`);

      // Track subscription
      if (!this.objectSubscriptions.has(objectId)) {
        this.objectSubscriptions.set(objectId, new Set());
      }
      this.objectSubscriptions.get(objectId).add(userId);

      // Update user's active objects
      const userConnection = this.connectedUsers.get(userId);
      if (userConnection) {
        userConnection.activeObjects.add(objectId);
      }

      // Get current collaborators
      const collaborators = Array.from(this.objectSubscriptions.get(objectId))
        .map(uid => this.connectedUsers.get(uid))
        .filter(Boolean)
        .map(u => ({ username: u.username, connectedAt: u.connectedAt }));

      // Notify user of successful subscription
      socket.emit('object:subscribed', {
        objectId,
        collaborators
      });

      // Notify other collaborators
      socket.to(`object:${objectId}`).emit('collaborator:joined', {
        objectId,
        username,
        connectedAt: new Date()
      });

      logger.debug(`User ${username} subscribed to object ${objectId}`);
    } catch (error) {
      logger.error('Error handling object subscription:', error);
      socket.emit('error', { message: 'Subscription failed' });
    }
  }

  async handleObjectUnsubscribe(socket, { objectId }) {
    try {
      const userId = socket.userId;
      const username = socket.username;

      // Leave object room
      socket.leave(`object:${objectId}`);

      // Remove from subscriptions
      if (this.objectSubscriptions.has(objectId)) {
        this.objectSubscriptions.get(objectId).delete(userId);
        if (this.objectSubscriptions.get(objectId).size === 0) {
          this.objectSubscriptions.delete(objectId);
        }
      }

      // Update user's active objects
      const userConnection = this.connectedUsers.get(userId);
      if (userConnection) {
        userConnection.activeObjects.delete(objectId);
      }

      // Release any edit locks
      await this.releaseEditLocks(userId, objectId);

      // Notify other collaborators
      socket.to(`object:${objectId}`).emit('collaborator:left', {
        objectId,
        username
      });

      logger.debug(`User ${username} unsubscribed from object ${objectId}`);
    } catch (error) {
      logger.error('Error handling object unsubscription:', error);
    }
  }

  handleCursorUpdate(socket, { objectId, position }) {
    socket.to(`object:${objectId}`).emit('collaborator:cursor', {
      objectId,
      username: socket.username,
      position,
      timestamp: new Date()
    });
  }

  handleSelectionUpdate(socket, { objectId, selection }) {
    socket.to(`object:${objectId}`).emit('collaborator:selection', {
      objectId,
      username: socket.username,
      selection,
      timestamp: new Date()
    });
  }

  async handleEditStart(socket, { objectId, nodeId, type = 'node' }) {
    try {
      const lockKey = `edit:${objectId}:${type}:${nodeId}`;
      const userId = socket.userId;
      const username = socket.username;

      // Try to acquire edit lock
      try {
        const lock = await redis.acquireLock(lockKey, 60000); // 1 minute lock
        
        // Notify collaborators about edit lock
        socket.to(`object:${objectId}`).emit('edit:locked', {
          objectId,
          nodeId,
          type,
          username,
          timestamp: new Date()
        });

        // Confirm lock to user
        socket.emit('edit:lock:acquired', {
          objectId,
          nodeId,
          type,
          lockKey: lock.key,
          lockValue: lock.value
        });

        logger.debug(`Edit lock acquired: ${lockKey} by ${username}`);
      } catch (lockError) {
        socket.emit('edit:lock:failed', {
          objectId,
          nodeId,
          type,
          message: 'Element is currently being edited by another user'
        });
      }
    } catch (error) {
      logger.error('Error handling edit start:', error);
    }
  }

  async handleEditEnd(socket, { objectId, nodeId, type = 'node', lockKey, lockValue }) {
    try {
      const username = socket.username;

      if (lockKey && lockValue) {
        // Release the specific lock
        await redis.releaseLock(lockKey, lockValue);
      } else {
        // Fallback: release by pattern
        const fallbackKey = `edit:${objectId}:${type}:${nodeId}`;
        // Note: This is less secure but handles cases where lock info is lost
      }

      // Notify collaborators about edit unlock
      socket.to(`object:${objectId}`).emit('edit:unlocked', {
        objectId,
        nodeId,
        type,
        username,
        timestamp: new Date()
      });

      logger.debug(`Edit lock released: ${lockKey || 'fallback'} by ${username}`);
    } catch (error) {
      logger.error('Error handling edit end:', error);
    }
  }

  handleObjectChange(socket, { objectId, changes, timestamp }) {
    // Broadcast object changes to other collaborators
    socket.to(`object:${objectId}`).emit('object:changed', {
      objectId,
      changes,
      author: socket.username,
      timestamp: timestamp || new Date()
    });

    logger.debug(`Object change broadcast: ${objectId} by ${socket.username}`);
  }

  handleNoteChange(socket, { objectId, nodeId, content, timestamp }) {
    // Broadcast note changes to other collaborators
    socket.to(`object:${objectId}`).emit('note:changed', {
      objectId,
      nodeId,
      content,
      author: socket.username,
      timestamp: timestamp || new Date()
    });

    logger.debug(`Note change broadcast: ${objectId}/${nodeId} by ${socket.username}`);
  }

  async handleDisconnection(socket) {
    const userId = socket.userId;
    const username = socket.username;

    logger.info(`User disconnected: ${username} (${socket.id})`);

    // Get user's active objects before cleanup
    const userConnection = this.connectedUsers.get(userId);
    const activeObjects = userConnection ? Array.from(userConnection.activeObjects) : [];

    // Release all edit locks for this user
    for (const objectId of activeObjects) {
      await this.releaseEditLocks(userId, objectId);
      
      // Notify collaborators in each object
      socket.to(`object:${objectId}`).emit('collaborator:left', {
        objectId,
        username
      });

      // Remove from object subscriptions
      if (this.objectSubscriptions.has(objectId)) {
        this.objectSubscriptions.get(objectId).delete(userId);
        if (this.objectSubscriptions.get(objectId).size === 0) {
          this.objectSubscriptions.delete(objectId);
        }
      }
    }

    // Remove user connection
    this.connectedUsers.delete(userId);

    // Broadcast user left to all connected users
    socket.broadcast.emit('user:left', { username });

    // Update user activity
    if (socket.user) {
      socket.user.activity.lastActive = new Date();
      socket.user.save().catch(err => logger.error('Error updating user activity:', err));
    }
  }

  async releaseEditLocks(userId, objectId) {
    try {
      // This is a simplified approach - in production, you'd want to track locks more precisely
      const lockPattern = `edit:${objectId}:*`;
      // Redis doesn't have a built-in way to delete by pattern, so we'd need to implement
      // proper lock tracking or use Redis SCAN + DELETE
      logger.debug(`Released edit locks for user ${userId} in object ${objectId}`);
    } catch (error) {
      logger.error('Error releasing edit locks:', error);
    }
  }

  // Public methods for external use
  notifyObjectUpdate(objectId, update, excludeUserId = null) {
    if (this.io) {
      const room = `object:${objectId}`;
      let emission = this.io.to(room);
      
      if (excludeUserId) {
        const excludeConnection = this.connectedUsers.get(excludeUserId);
        if (excludeConnection) {
          emission = emission.except(excludeConnection.socketId);
        }
      }
      
      emission.emit('object:updated', {
        objectId,
        ...update,
        timestamp: new Date()
      });
    }
  }

  notifyVersionCreated(objectId, version, excludeUserId = null) {
    if (this.io) {
      const room = `object:${objectId}`;
      let emission = this.io.to(room);
      
      if (excludeUserId) {
        const excludeConnection = this.connectedUsers.get(excludeUserId);
        if (excludeConnection) {
          emission = emission.except(excludeConnection.socketId);
        }
      }
      
      emission.emit('version:created', {
        objectId,
        version,
        timestamp: new Date()
      });
    }
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.values()).map(u => ({
      username: u.username,
      connectedAt: u.connectedAt,
      activeObjects: Array.from(u.activeObjects)
    }));
  }

  getObjectCollaborators(objectId) {
    const subscribers = this.objectSubscriptions.get(objectId);
    if (!subscribers) return [];
    
    return Array.from(subscribers)
      .map(userId => this.connectedUsers.get(userId))
      .filter(Boolean)
      .map(u => ({
        username: u.username,
        connectedAt: u.connectedAt
      }));
  }
}

export default new SocketService();
