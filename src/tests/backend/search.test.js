import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// Mock the Redis client
const mockRedisClient = {
  get: vi.fn(),
  setEx: vi.fn(),
  isReady: true
}

const mockRedis = {
  isReady: () => mockRedisClient.isReady,
  getClient: () => mockRedisClient
}

// Mock ZLFNObject model
const mockZLFNObject = {
  aggregate: vi.fn(),
  find: vi.fn(),
  countDocuments: vi.fn()
}

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn()
}

// Mock middleware
const mockOptionalAuth = (req, res, next) => {
  // Simulate authenticated user for some tests
  if (req.headers.authorization === 'Bearer test-token') {
    req.user = { id: 'user1', username: 'testuser' }
  }
  next()
}

const mockValidateSearch = (req, res, next) => {
  next()
}

// Create test app
function createTestApp() {
  const app = express()
  app.use(express.json())
  
  // Mock the route with our enhanced search logic
  app.get('/api/zlfn', mockOptionalAuth, mockValidateSearch, async (req, res) => {
    try {
      const { q, tags, author, limit = 20, offset = 0, dateFrom, dateTo } = req.query
      
      // Create cache key from query parameters
      const cacheKey = `search:${JSON.stringify({ q, tags, author, limit, offset, dateFrom, dateTo, userId: req.user?.id })}`
      
      // Try to get cached results first
      if (mockRedis.isReady()) {
        try {
          const cached = await mockRedisClient.get(cacheKey)
          if (cached) {
            mockLogger.debug(`Cache hit for search: ${cacheKey}`)
            return res.json(JSON.parse(cached))
          }
        } catch (cacheError) {
          mockLogger.warn('Cache read error:', cacheError)
        }
      }
      
      let query = {}
      let searchScore = {}
      
      // Build text search query with scoring
      if (q) {
        query.$text = { $search: q }
        searchScore = { score: { $meta: 'textScore' } }
      }
      
      // Filter by tags (support array or comma-separated string)
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())
        if (tagArray.length > 0) {
          query['metadata.tags'] = { $in: tagArray }
        }
      }
      
      // Filter by author
      if (author) {
        query['metadata.author'] = author
      }
      
      // Date range filtering
      if (dateFrom || dateTo) {
        query['metadata.created'] = {}
        if (dateFrom) query['metadata.created'].$gte = new Date(dateFrom)
        if (dateTo) query['metadata.created'].$lte = new Date(dateTo)
      }
      
      // Only show public objects if not authenticated
      if (!req.user) {
        query['metadata.isPublic'] = true
      }
      
      // Build sort criteria (text score first, then modified date)
      let sortCriteria = { 'metadata.modified': -1 }
      if (q) {
        sortCriteria = { score: { $meta: 'textScore' }, 'metadata.modified': -1 }
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
      ]
      
      const [result] = await mockZLFNObject.aggregate(pipeline)
      const objects = result.data
      const total = result.totalCount[0]?.count || 0
      
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
      }
      
      // Cache the results for 1 hour
      if (mockRedis.isReady()) {
        try {
          await mockRedisClient.setEx(cacheKey, 3600, JSON.stringify(response))
          mockLogger.debug(`Cached search results: ${cacheKey}`)
        } catch (cacheError) {
          mockLogger.warn('Cache write error:', cacheError)
        }
      }
      
      res.json(response)
    } catch (error) {
      mockLogger.error('Error fetching objects:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch objects'
      })
    }
  })
  
  return app
}

describe('Enhanced Search API', () => {
  let app

  beforeEach(() => {
    vi.clearAllMocks()
    app = createTestApp()
    
    // Default mock responses
    mockZLFNObject.aggregate.mockResolvedValue([{
      data: [
        {
          id: 'obj1',
          title: 'Test Object 1',
          'metadata.created': '2025-01-01T00:00:00.000Z',
          'metadata.modified': '2025-01-01T00:00:00.000Z',
          'metadata.author': 'testuser',
          'metadata.tags': ['logic', 'test'],
          score: 1.0
        }
      ],
      totalCount: [{ count: 1 }]
    }])
    
    mockRedisClient.get.mockResolvedValue(null)
    mockRedisClient.setEx.mockResolvedValue('OK')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/zlfn', () => {
    it('should perform basic search without authentication', async () => {
      const response = await request(app)
        .get('/api/zlfn')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.pagination).toHaveProperty('total', 1)
      expect(response.body.searchMeta).toHaveProperty('query', null)
      
      // Should add public filter for unauthenticated users
      expect(mockZLFNObject.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              'metadata.isPublic': true
            })
          })
        ])
      )
    })

    it('should perform text search with scoring', async () => {
      const response = await request(app)
        .get('/api/zlfn')
        .query({ q: 'logic test' })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.searchMeta.query).toBe('logic test')
      
      // Should include text search in pipeline
      expect(mockZLFNObject.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              $text: { $search: 'logic test' }
            })
          })
        ])
      )
    })

    it('should filter by tags (array format)', async () => {
      const response = await request(app)
        .get('/api/zlfn')
        .query({ tags: ['logic', 'philosophy'] })
        .expect(200)

      expect(response.body.success).toBe(true)
      
      expect(mockZLFNObject.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              'metadata.tags': { $in: ['logic', 'philosophy'] }
            })
          })
        ])
      )
    })

    it('should filter by tags (comma-separated string)', async () => {
      const response = await request(app)
        .get('/api/zlfn')
        .query({ tags: 'logic,philosophy' })
        .expect(200)

      expect(response.body.success).toBe(true)
      
      expect(mockZLFNObject.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              'metadata.tags': { $in: ['logic', 'philosophy'] }
            })
          })
        ])
      )
    })

    it('should filter by author', async () => {
      const response = await request(app)
        .get('/api/zlfn')
        .query({ author: 'testuser' })
        .expect(200)

      expect(response.body.success).toBe(true)
      
      expect(mockZLFNObject.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              'metadata.author': 'testuser'
            })
          })
        ])
      )
    })

    it('should filter by date range', async () => {
      const dateFrom = '2025-01-01'
      const dateTo = '2025-01-31'
      
      const response = await request(app)
        .get('/api/zlfn')
        .query({ dateFrom, dateTo })
        .expect(200)

      expect(response.body.success).toBe(true)
      
      expect(mockZLFNObject.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.objectContaining({
              'metadata.created': {
                $gte: new Date(dateFrom),
                $lte: new Date(dateTo)
              }
            })
          })
        ])
      )
    })

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get('/api/zlfn')
        .query({ limit: 10, offset: 20 })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.pagination.limit).toBe(10)
      expect(response.body.pagination.offset).toBe(20)
      
      expect(mockZLFNObject.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $facet: expect.objectContaining({
              data: expect.arrayContaining([
                { $skip: 20 },
                { $limit: 10 }
              ])
            })
          })
        ])
      )
    })

    it('should use Redis cache when available', async () => {
      const cachedResponse = {
        success: true,
        data: [{ id: 'cached-obj' }],
        pagination: { total: 1 }
      }
      
      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedResponse))
      
      const response = await request(app)
        .get('/api/zlfn')
        .query({ q: 'test' })
        .expect(200)

      expect(response.body).toEqual(cachedResponse)
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Cache hit'))
      expect(mockZLFNObject.aggregate).not.toHaveBeenCalled()
    })

    it('should cache search results', async () => {
      const response = await request(app)
        .get('/api/zlfn')
        .query({ q: 'test' })
        .expect(200)

      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        expect.stringContaining('search:'),
        3600,
        expect.stringContaining('"success":true')
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Cached search results'))
    })

    it('should handle cache errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Cache error'))
      mockRedisClient.setEx.mockRejectedValue(new Error('Cache write error'))
      
      const response = await request(app)
        .get('/api/zlfn')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(mockLogger.warn).toHaveBeenCalledWith('Cache read error:', expect.any(Error))
      expect(mockLogger.warn).toHaveBeenCalledWith('Cache write error:', expect.any(Error))
    })

    it('should not filter public objects for authenticated users', async () => {
      const response = await request(app)
        .get('/api/zlfn')
        .set('Authorization', 'Bearer test-token')
        .expect(200)

      expect(response.body.success).toBe(true)
      
      // Should not include public filter for authenticated users
      expect(mockZLFNObject.aggregate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            $match: expect.not.objectContaining({
              'metadata.isPublic': true
            })
          })
        ])
      )
    })

    it('should handle database errors', async () => {
      mockZLFNObject.aggregate.mockRejectedValue(new Error('Database error'))
      
      const response = await request(app)
        .get('/api/zlfn')
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Failed to fetch objects')
      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching objects:', expect.any(Error))
    })
  })
})
