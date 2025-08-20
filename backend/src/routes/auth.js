import express from 'express';
import User from '../models/User.js';
import { generateToken, generateRefreshToken, authenticateToken } from '../middleware/auth.js';
import { validateUser, validateLogin } from '../middleware/validation.js';
import { createLogger } from '../config/logger.js';

const router = express.Router();
const logger = createLogger('auth-routes');

// Register new user
router.post('/register', validateUser, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { username: new RegExp(`^${username}$`, 'i') },
        { email: email.toLowerCase() }
      ]
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Username or email already exists'
      });
    }
    
    const user = new User({
      username,
      email: email.toLowerCase(),
      password
    });
    
    await user.save();
    
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    
    logger.info(`User registered: ${username}`);
    
    res.status(201).json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

// Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: new RegExp(`^${username}$`, 'i') },
        { email: username.toLowerCase() }
      ]
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    if (user.settings.accountLocked) {
      return res.status(423).json({
        success: false,
        error: 'Account is locked'
      });
    }
    
    const isValidPassword = await user.comparePassword(password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }
    
    // Update login activity
    user.activity.lastLogin = new Date();
    user.activity.lastActive = new Date();
    user.activity.loginCount += 1;
    await user.save();
    
    const token = generateToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    
    logger.info(`User logged in: ${user.username}`);
    
    res.json({
      success: true,
      data: {
        user: user.toPublicJSON(),
        token,
        refreshToken
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// Refresh token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required'
      });
    }
    
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }
    
    const user = await User.findById(decoded.userId);
    
    if (!user || user.settings.accountLocked) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }
    
    const newToken = generateToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    
    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: { user: req.user.toPublicJSON() }
    });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

// Update user profile
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const { profile, settings } = req.body;
    const user = req.user;
    
    if (profile) {
      if (profile.firstName) user.profile.firstName = profile.firstName;
      if (profile.lastName) user.profile.lastName = profile.lastName;
      if (profile.bio) user.profile.bio = profile.bio;
      if (profile.preferences) {
        user.profile.preferences = { ...user.profile.preferences, ...profile.preferences };
      }
    }
    
    if (settings && settings.notifications !== undefined) {
      user.profile.preferences.notifications = settings.notifications;
    }
    
    await user.save();
    
    logger.info(`Profile updated: ${user.username}`);
    
    res.json({
      success: true,
      data: { user: user.toPublicJSON() }
    });
  } catch (error) {
    logger.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current and new password required'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters'
      });
    }
    
    const user = await User.findById(req.user._id);
    const isValidPassword = await user.comparePassword(currentPassword);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }
    
    user.password = newPassword;
    await user.save();
    
    logger.info(`Password changed: ${user.username}`);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Password change error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

// Logout (client-side token invalidation)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Update last active time
    req.user.activity.lastActive = new Date();
    await req.user.save();
    
    logger.info(`User logged out: ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

export default router;
