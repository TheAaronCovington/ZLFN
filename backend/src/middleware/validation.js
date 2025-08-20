import { body, param, query, validationResult } from 'express-validator';
import sanitizeHtml from 'sanitize-html';
import { createLogger } from '../config/logger.js';

const logger = createLogger('validation');

// Validation error handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Sanitize HTML content
export const sanitizeMarkdown = (content) => {
  return sanitizeHtml(content, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'strong', 'em', 'u', 'del',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span'
    ],
    allowedAttributes: {
      'a': ['href', 'title'],
      'img': ['src', 'alt', 'title', 'width', 'height'],
      'div': ['class'],
      'span': ['class'],
      'pre': ['class'],
      'code': ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data']
    }
  });
};

// ZLFN Object validation rules
export const validateZLFNObject = [
  body('id')
    .isString()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('ID must be alphanumeric with underscores and hyphens only'),
  
  body('title')
    .isString()
    .isLength({ min: 1, max: 200 })
    .trim()
    .withMessage('Title must be between 1 and 200 characters'),
  
  body('markdownContent')
    .optional()
    .isString()
    .isLength({ max: 1000000 })
    .customSanitizer(sanitizeMarkdown)
    .withMessage('Markdown content too large (max 1MB)'),
  
  body('zlfnJson')
    .isObject()
    .withMessage('ZLFN JSON must be an object'),
  
  body('zlfnJson.nodes')
    .isArray()
    .withMessage('Nodes must be an array'),
  
  body('zlfnJson.edges')
    .isArray()
    .withMessage('Edges must be an array'),
  
  body('notes')
    .optional()
    .isObject()
    .withMessage('Notes must be an object'),

  handleValidationErrors
];

export const validateZLFNObjectUpdate = [
  body('title')
    .optional()
    .isString()
    .isLength({ min: 1, max: 200 })
    .trim(),
  
  body('markdownContent')
    .optional()
    .isString()
    .isLength({ max: 1000000 })
    .customSanitizer(sanitizeMarkdown),
  
  body('zlfnJson')
    .optional()
    .isObject(),
  
  body('notes')
    .optional()
    .isObject(),

  handleValidationErrors
];

export const validateObjectId = [
  param('id')
    .isString()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid object ID format'),

  handleValidationErrors
];

export const validateNote = [
  body('content')
    .isString()
    .isLength({ max: 10000 })
    .customSanitizer(sanitizeMarkdown)
    .withMessage('Note content too large (max 10KB)'),

  handleValidationErrors
];

export const validateSearch = [
  query('q')
    .optional()
    .isString()
    .isLength({ min: 1, max: 200 })
    .trim()
    .withMessage('Search query must be between 1 and 200 characters'),
  
  query('tags')
    .optional()
    .isString()
    .customSanitizer(value => value.split(',').map(tag => tag.trim()).filter(Boolean)),
  
  query('author')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .trim(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .toInt()
    .withMessage('Offset must be non-negative'),

  handleValidationErrors
];

export const validateUser = [
  body('username')
    .isString()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username must be 3-30 characters, alphanumeric with underscores and hyphens'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email required'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),

  handleValidationErrors
];

export const validateLogin = [
  body('username')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Username or email required'),
  
  body('password')
    .isString()
    .isLength({ min: 1 })
    .withMessage('Password required'),

  handleValidationErrors
];

export const validateVersionRevert = [
  body('timestamp')
    .isISO8601()
    .toDate()
    .withMessage('Valid timestamp required'),

  handleValidationErrors
];

export const validateFileUpload = [
  body('mergeStrategy')
    .optional()
    .isIn(['replace', 'merge', 'append'])
    .withMessage('Invalid merge strategy'),

  handleValidationErrors
];
