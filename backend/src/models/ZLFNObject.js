import mongoose from 'mongoose';

const { Schema } = mongoose;

// Sub-schemas for nested objects
const ZLFNNodeSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, required: true },
  label: { type: String, required: true },
  zone: String,
  x: Number,
  y: Number,
  width: Number,
  height: Number,
  color: String,
  shape: String,
  metadata: Schema.Types.Mixed
}, { _id: false });

const ZLFNEdgeSchema = new Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  type: String,
  label: String,
  rule: String,
  strength: Number,
  metadata: Schema.Types.Mixed
}, { _id: false });

const ZLFNDependencySchema = new Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  type: String,
  relationship: String,
  metadata: Schema.Types.Mixed
}, { _id: false });

const ZLFNStructureSchema = new Schema({
  nodes: [ZLFNNodeSchema],
  edges: [ZLFNEdgeSchema],
  dependencies: [ZLFNDependencySchema],
  metadata: {
    created: { type: Date, default: Date.now },
    modified: { type: Date, default: Date.now },
    author: String,
    version: { type: String, default: '1.0.0' },
    tags: [String],
    description: String
  }
}, { _id: false });

const ZLFNVersionSchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  description: { type: String, default: 'Version created' },
  changeType: { type: String, enum: ['create', 'update', 'merge', 'import', 'layout', 'note'], default: 'update' },
  author: { type: String, default: 'system' },
  zlfnJson: ZLFNStructureSchema,
  notes: { type: Map, of: String, default: new Map() },
  layout: { type: Map, of: { x: Number, y: Number }, default: new Map() },
  fileReferences: [String],
  changes: [String]
}, { _id: false });

const CollaborationStateSchema = new Schema({
  isCollaborating: { type: Boolean, default: false },
  activeUsers: [String],
  userPresence: { type: Map, of: Schema.Types.Mixed, default: new Map() },
  editLocks: { type: Map, of: String, default: new Map() },
  pendingChanges: [Schema.Types.Mixed]
}, { _id: false });

const ZLFNObjectSchema = new Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  title: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 200
  },
  markdownContent: { 
    type: String, 
    default: '',
    maxlength: 1000000 // 1MB limit
  },
  zlfnJson: {
    type: ZLFNStructureSchema,
    required: true
  },
  notes: { 
    type: Map, 
    of: String, 
    default: new Map(),
    validate: {
      validator: function(notes) {
        // Limit total notes size
        const totalSize = Array.from(notes.values()).join('').length;
        return totalSize <= 500000; // 500KB limit
      },
      message: 'Total notes size exceeds limit'
    }
  },
  versionHistory: {
    type: [ZLFNVersionSchema],
    default: [],
    validate: {
      validator: function(versions) {
        return versions.length <= 20; // Max 20 versions
      },
      message: 'Version history exceeds maximum limit of 20 versions'
    }
  },
  collaboration: {
    type: CollaborationStateSchema,
    default: () => ({
      isCollaborating: false,
      activeUsers: [],
      userPresence: new Map(),
      editLocks: new Map(),
      pendingChanges: []
    })
  },
  metadata: {
    created: { type: Date, default: Date.now },
    modified: { type: Date, default: Date.now },
    lastAccessed: { type: Date, default: Date.now },
    author: { type: String, default: 'system' },
    tags: [String],
    isPublic: { type: Boolean, default: false },
    fileReferences: [String]
  }
}, {
  timestamps: true,
  collection: 'zlfn_objects',
  // Enable text search
  indexes: [
    { 'id': 1 },
    { 'title': 'text', 'markdownContent': 'text', 'notes.$*': 'text' },
    { 'metadata.created': -1 },
    { 'metadata.modified': -1 },
    { 'metadata.tags': 1 }
  ]
});

// Middleware to update modified timestamp
ZLFNObjectSchema.pre('save', function(next) {
  this.metadata.modified = new Date();
  next();
});

ZLFNObjectSchema.pre('findOneAndUpdate', function(next) {
  this.set({ 'metadata.modified': new Date() });
  next();
});

// Instance methods
ZLFNObjectSchema.methods.addVersion = function(versionData) {
  // Remove oldest version if at limit
  if (this.versionHistory.length >= 20) {
    this.versionHistory.shift();
  }
  
  this.versionHistory.push({
    timestamp: new Date(),
    description: versionData.description || 'Version created',
    changeType: versionData.changeType || 'update',
    author: versionData.author || 'system',
    zlfnJson: versionData.zlfnJson || this.zlfnJson,
    notes: versionData.notes || this.notes,
    layout: versionData.layout || new Map(),
    fileReferences: versionData.fileReferences || [],
    changes: versionData.changes || []
  });
  
  return this;
};

ZLFNObjectSchema.methods.revertToVersion = function(timestamp) {
  const version = this.versionHistory.find(v => 
    v.timestamp.getTime() === new Date(timestamp).getTime()
  );
  
  if (!version) {
    throw new Error('Version not found');
  }
  
  // Create backup of current state
  this.addVersion({
    description: `Backup before reverting to ${version.timestamp}`,
    changeType: 'update',
    zlfnJson: this.zlfnJson,
    notes: this.notes,
    layout: new Map()
  });
  
  // Revert to selected version
  this.zlfnJson = version.zlfnJson;
  this.notes = version.notes;
  
  return this;
};

ZLFNObjectSchema.methods.updateLastAccessed = function() {
  this.metadata.lastAccessed = new Date();
  return this.save();
};

// Static methods
ZLFNObjectSchema.statics.findByTag = function(tag) {
  return this.find({ 'metadata.tags': tag });
};

ZLFNObjectSchema.statics.searchContent = function(query, options = {}) {
  const searchQuery = {
    $text: { $search: query }
  };
  
  if (options.tags && options.tags.length > 0) {
    searchQuery['metadata.tags'] = { $in: options.tags };
  }
  
  if (options.author) {
    searchQuery['metadata.author'] = options.author;
  }
  
  if (options.dateFrom || options.dateTo) {
    searchQuery['metadata.created'] = {};
    if (options.dateFrom) {
      searchQuery['metadata.created'].$gte = new Date(options.dateFrom);
    }
    if (options.dateTo) {
      searchQuery['metadata.created'].$lte = new Date(options.dateTo);
    }
  }
  
  return this.find(searchQuery, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } })
    .limit(options.limit || 50);
};

ZLFNObjectSchema.statics.getRecentlyModified = function(limit = 10) {
  return this.find({})
    .sort({ 'metadata.modified': -1 })
    .limit(limit)
    .select('id title metadata.modified metadata.author');
};

export default mongoose.model('ZLFNObject', ZLFNObjectSchema);
 
