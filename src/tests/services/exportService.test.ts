import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportService } from '../../services/exportService';
import type { ZLFNObject } from '../../types/zlfn';

// Mock data
const mockZLFNObject: ZLFNObject = {
  id: 'test-object-1',
  zflnJson: {
    arguments: [
      {
        core: {
          name: 'Test Argument',
          summary: 'A test argument for unit testing',
          layoutMode: 'network' as const,
          variables: {},
          metadata: {
            confidence: 0.8,
            uncertain: [],
            domain: 'testing'
          }
        },
        zones: [
          {
            name: 'premises',
            range: { xMin: 0, xMax: 100 },
            color: '#blue',
            nodes: [
              {
                id: 'node-1',
                name: 'Test Node',
                symbolic: 'P1',
                translation: 'Premise 1',
                type: 'premise' as const,
                vennRelevant: true,
                timelineRelevant: false,
                facets: ['logic']
              }
            ]
          }
        ],
        dependencies: [
          {
            id: 'dep-1',
            source: 'node-1',
            target: 'node-2',
            rule: 'modus ponens',
            context: 'test context',
            priority: 1
          }
        ],
        modes: {
          venn: { enabled: true, sets: [] },
          truthTable: { enabled: true, variables: [] },
          timeline: { enabled: false, events: [] }
        },
        counterarguments: [],
        subarguments: [],
        validation: {
          isValid: true,
          errors: [],
          warnings: []
        },
        pagination: {
          currentPage: 1,
          totalPages: 1,
          itemsPerPage: 10
        }
      }
    ]
  },
  notes: {
    'node-1': 'This is a test note'
  },
  versionHistory: [
    {
      timestamp: '2024-01-01T00:00:00Z',
      markdown: '# Test',
      zflnJson: {
        arguments: []
      },
      notes: {},
      author: 'test-user'
    }
  ],
  collaboration: {
    isCollaborating: false,
    activeUsers: [],
    userPresence: new Map(),
    editLocks: new Map(),
    pendingChanges: []
  },
  metadata: {
    created: '2024-01-01T00:00:00Z',
    modified: '2024-01-01T00:00:00Z',
    fileReferences: [],
    author: 'test-user'
  }
};

describe('ExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock DOM methods
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'a') {
        return {
          href: '',
          download: '',
          click: vi.fn(),
          style: {},
        };
      }
      if (tagName === 'canvas') {
        return {
          width: 800,
          height: 600,
          getContext: vi.fn().mockReturnValue({
            fillStyle: '',
            fillRect: vi.fn(),
            drawImage: vi.fn(),
          }),
          toBlob: vi.fn((callback) => {
            callback(new Blob(['test'], { type: 'image/png' }));
          }),
        };
      }
      return {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        setAttribute: vi.fn(),
        cloneNode: vi.fn().mockReturnValue({}),
      };
    });

    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
  });

  describe('exportObject', () => {
    it('should export JSON format correctly', async () => {
      const mockBlob = new Blob(['test'], { type: 'application/json' });
      global.Blob = vi.fn().mockReturnValue(mockBlob);

      await exportService.exportObject(
        { object: mockZLFNObject },
        {
          format: 'json',
          includeNotes: true,
          includeVersionHistory: true,
          includeLayout: false,
          includeMetadata: true
        }
      );

      expect(global.Blob).toHaveBeenCalledWith(
        [expect.stringContaining('"id": "test-object-1"')],
        { type: 'application/json' }
      );
    });

    it('should export markdown format correctly', async () => {
      const mockBlob = new Blob(['test'], { type: 'text/markdown' });
      global.Blob = vi.fn().mockReturnValue(mockBlob);

      await exportService.exportObject(
        { object: mockZLFNObject },
        {
          format: 'markdown',
          includeNotes: true,
          includeVersionHistory: false,
          includeLayout: false,
          includeMetadata: true
        }
      );

      expect(global.Blob).toHaveBeenCalledWith(
        [expect.stringContaining('# test-object-1')],
        { type: 'text/markdown' }
      );
    });

    it('should handle SVG export with valid element', async () => {
      const mockSvgElement = {
        cloneNode: vi.fn().mockReturnValue({
          setAttribute: vi.fn(),
        }),
        setAttribute: vi.fn(),
      } as any;

      global.XMLSerializer = vi.fn().mockImplementation(() => ({
        serializeToString: vi.fn().mockReturnValue('<svg></svg>'),
      }));

      const mockBlob = new Blob(['<svg></svg>'], { type: 'image/svg+xml' });
      global.Blob = vi.fn().mockReturnValue(mockBlob);

      await exportService.exportObject(
        { object: mockZLFNObject, svgElement: mockSvgElement },
        {
          format: 'svg',
          includeNotes: false,
          includeVersionHistory: false,
          includeLayout: true,
          includeMetadata: false
        }
      );

      expect(global.Blob).toHaveBeenCalledWith(
        ['<svg></svg>'],
        { type: 'image/svg+xml' }
      );
    });

    it('should throw error for SVG export without element', async () => {
      await expect(
        exportService.exportObject(
          { object: mockZLFNObject },
          {
            format: 'svg',
            includeNotes: false,
            includeVersionHistory: false,
            includeLayout: false,
            includeMetadata: false
          }
        )
      ).rejects.toThrow('SVG element is required for SVG export');
    });

    it('should handle PNG export correctly', async () => {
      const mockSvgElement = {
        cloneNode: vi.fn().mockReturnValue({
          setAttribute: vi.fn(),
        }),
        setAttribute: vi.fn(),
        getBBox: vi.fn().mockReturnValue({
          width: 800,
          height: 600,
        }),
      } as any;

      global.XMLSerializer = vi.fn().mockImplementation(() => ({
        serializeToString: vi.fn().mockReturnValue('<svg></svg>'),
      }));

      // Mock URL.createObjectURL and revokeObjectURL
      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();

      // Mock canvas and context
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn().mockImplementation((callback) => {
          callback(new Blob(['mock-png'], { type: 'image/png' }));
        }),
      };
      global.HTMLCanvasElement.prototype.getContext = mockCanvas.getContext;
      global.HTMLCanvasElement.prototype.toBlob = mockCanvas.toBlob;
      Object.defineProperty(global.HTMLCanvasElement.prototype, 'width', {
        set: function(value) { mockCanvas.width = value; },
        get: function() { return mockCanvas.width; }
      });
      Object.defineProperty(global.HTMLCanvasElement.prototype, 'height', {
        set: function(value) { mockCanvas.height = value; },
        get: function() { return mockCanvas.height; }
      });

      global.Image = vi.fn().mockImplementation(() => {
        const img = {
          onload: null,
          onerror: null,
          src: '',
        };
        // Automatically trigger onload when src is set
        Object.defineProperty(img, 'src', {
          set: function(value) {
            setTimeout(() => {
              if (this.onload) {
                this.onload();
              }
            }, 0);
          }
        });
        return img;
      });

      await exportService.exportObject(
        { object: mockZLFNObject, svgElement: mockSvgElement },
        {
          format: 'png',
          includeNotes: false,
          includeVersionHistory: false,
          includeLayout: true,
          includeMetadata: false,
          quality: 'high'
        }
      );

      // Verify canvas was created
      expect(document.createElement).toHaveBeenCalledWith('canvas');
    });

    it('should throw error for unsupported format', async () => {
      await expect(
        exportService.exportObject(
          { object: mockZLFNObject },
          {
            format: 'unsupported' as any,
            includeNotes: false,
            includeVersionHistory: false,
            includeLayout: false,
            includeMetadata: false
          }
        )
      ).rejects.toThrow('Unsupported export format: unsupported');
    });
  });

  describe('export options', () => {
    it('should include notes when option is enabled', async () => {
      global.Blob = vi.fn();

      await exportService.exportObject(
        { object: mockZLFNObject },
        {
          format: 'json',
          includeNotes: true,
          includeVersionHistory: false,
          includeLayout: false,
          includeMetadata: false
        }
      );

      const blobCall = (global.Blob as any).mock.calls[0];
      const jsonString = blobCall[0][0];
      expect(jsonString).toContain('"notes"');
      expect(jsonString).toContain('This is a test note');
    });

    it('should exclude notes when option is disabled', async () => {
      global.Blob = vi.fn();

      await exportService.exportObject(
        { object: mockZLFNObject },
        {
          format: 'json',
          includeNotes: false,
          includeVersionHistory: false,
          includeLayout: false,
          includeMetadata: false
        }
      );

      const blobCall = (global.Blob as any).mock.calls[0];
      const jsonString = blobCall[0][0];
      expect(jsonString).not.toContain('"notes"');
    });

    it('should include version history when option is enabled', async () => {
      global.Blob = vi.fn();

      await exportService.exportObject(
        { object: mockZLFNObject },
        {
          format: 'json',
          includeNotes: false,
          includeVersionHistory: true,
          includeLayout: false,
          includeMetadata: false
        }
      );

      const blobCall = (global.Blob as any).mock.calls[0];
      const jsonString = blobCall[0][0];
      expect(jsonString).toContain('"versionHistory"');
    });

    it('should include metadata when option is enabled', async () => {
      global.Blob = vi.fn();

      await exportService.exportObject(
        { object: mockZLFNObject },
        {
          format: 'json',
          includeNotes: false,
          includeVersionHistory: false,
          includeLayout: false,
          includeMetadata: true
        }
      );

      const blobCall = (global.Blob as any).mock.calls[0];
      const jsonString = blobCall[0][0];
      expect(jsonString).toContain('"metadata"');
    });
  });
});
