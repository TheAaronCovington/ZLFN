import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema } = mongoose;

const UserSchema = new Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_-]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profile: {
    firstName: String,
    lastName: String,
    avatar: String,
    bio: { type: String, maxlength: 500 },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
      notifications: { type: Boolean, default: true },
      language: { type: String, default: 'en' }
    }
  },
  roles: [{
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  }],
  permissions: {
    canCreateObjects: { type: Boolean, default: true },
    canEditObjects: { type: Boolean, default: true },
    canDeleteObjects: { type: Boolean, default: false },
    canManageUsers: { type: Boolean, default: false },
    maxObjectsPerUser: { type: Number, default: 100 }
  },
  activity: {
    lastLogin: Date,
    lastActive: Date,
    loginCount: { type: Number, default: 0 },
    objectsCreated: { type: Number, default: 0 },
    objectsModified: { type: Number, default: 0 }
  },
  settings: {
    emailVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    accountLocked: { type: Boolean, default: false },
    passwordResetRequired: { type: Boolean, default: false }
  }
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes
UserSchema.index({ username: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ 'activity.lastActive': -1 });

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    this.password = await bcrypt.hash(this.password, rounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance methods
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.updateActivity = function() {
  this.activity.lastActive = new Date();
  this.activity.loginCount += 1;
  return this.save();
};

UserSchema.methods.hasRole = function(role) {
  return this.roles.includes(role);
};

UserSchema.methods.hasPermission = function(permission) {
  return this.permissions[permission] === true;
};

UserSchema.methods.toPublicJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.settings.twoFactorEnabled;
  return obj;
};

// Static methods
UserSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: new RegExp(`^${username}$`, 'i') });
};

UserSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.getActiveUsers = function(since = new Date(Date.now() - 24 * 60 * 60 * 1000)) {
  return this.find({ 'activity.lastActive': { $gte: since } })
    .select('username profile.firstName profile.lastName activity.lastActive')
    .sort({ 'activity.lastActive': -1 });
};

export default mongoose.model('User', UserSchema);
