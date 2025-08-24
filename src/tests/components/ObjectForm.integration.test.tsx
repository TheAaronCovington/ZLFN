import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import ObjectForm from '../../components/InputForm/ObjectForm'
import type { ZLFNObject } from '../../types/zlfn'

// Mock the services with enhanced functionality
const mockRealAPI = {
  createObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
  getObject: vi.fn()
}

const mockZlfnObjectManager = {
  acquireLock: vi.fn(),
  releaseLock: vi.fn(),
  deleteObject: vi.fn()
}

vi.mock('../../services/realAPI', () => ({
  realAPI: mockRealAPI
}))

vi.mock('../../services/zlfnObjectManager', () => ({
  zlfnObjectManager: mockZlfnObjectManager
}))

vi.mock('../../services/apiConfig', () => ({
  getCurrentAPI: () => mockRealAPI,
  apiConfig: {
    getConfig: () => ({ useRealBackend: true })
  }
}))

// Mock UUID generation for predictable IDs
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-123'
}))

const theme = createTheme()

const renderObjectForm = (props = {}) => {
  const defaultProps = {
    onClose: vi.fn(),
    ...props
  }
  
  return render(
    <ThemeProvider theme={theme}>
      <ObjectForm {...defaultProps} />
    </ThemeProvider>
  )
}

const mockZLFNObject: ZLFNObject = {
  id: 'test-object-id',
  markdownContent: '# Test Document\n\nThis is a test document.',
  zflnJson: {
    arguments: [{
      id: 'arg1',
      core: {
        name: 'Test Argument',
        summary: 'A test argument',
        layoutMode: 'standard',
        variables: [],
        mode: {}
      },
      zones: [],
      dependencies: [],
      modes: [],
      counterarguments: [],
      subarguments: [],
      validation: { isValid: true, errors: [] },
      pagination: { currentPage: 1, totalPages: 1 }
    }],
    metadata: {
      version: '1.0.0',
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-01T00:00:00Z',
      schema: 'zlfn-1.0'
    }
  },
  notes: {},
  versionHistory: [],
  metadata: {
    created: '2025-01-01T00:00:00Z',
    modified: '2025-01-01T00:00:00Z',
    fileReferences: [],
    title: 'Test Object',
    author: 'Test Author',
    status: 'draft'
  }
}

describe('ObjectForm Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Setup default successful responses
    mockRealAPI.createObject.mockResolvedValue({ success: true, data: mockZLFNObject })
    mockRealAPI.updateObject.mockResolvedValue({ success: true, data: mockZLFNObject })
    mockRealAPI.deleteObject.mockResolvedValue({ success: true })
    mockRealAPI.getObject.mockResolvedValue({ success: false, data: null, error: 'Not found' })
    mockZlfnObjectManager.acquireLock.mockReturnValue(true)
    mockZlfnObjectManager.releaseLock.mockReturnValue(true)
    mockZlfnObjectManager.deleteObject.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Create Mode', () => {
    it('should create new object with generated ID', async () => {
      const mockOnClose = vi.fn()
      renderObjectForm({ onClose: mockOnClose })

      // Fill in the form
      const titleField = screen.getByLabelText('Title')
      fireEvent.change(titleField, { target: { value: 'New Test Object' } })

      // Switch to markdown tab and add content
      const markdownTab = screen.getByRole('tab', { name: /markdown/i })
      fireEvent.click(markdownTab)

      const markdownField = screen.getByLabelText('Markdown Content')
      fireEvent.change(markdownField, { target: { value: '# New Document\n\nContent here.' } })

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /submit/i })
      await waitFor(() => expect(submitButton).not.toBeDisabled())
      fireEvent.click(submitButton)

      // Verify API call
      await waitFor(() => {
        expect(mockRealAPI.createObject).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'test-uuid-123',
            markdownContent: '# New Document\n\nContent here.',
            metadata: expect.objectContaining({
              title: 'New Test Object'
            })
          })
        )
      })

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should handle markdown file import', async () => {
      renderObjectForm()

      // Switch to markdown tab
      const markdownTab = screen.getByRole('tab', { name: /markdown/i })
      fireEvent.click(markdownTab)

      // Create a mock file
      const file = new File(['# Imported Document\n\nImported content.'], 'test.md', {
        type: 'text/markdown'
      })

      // Find and trigger file input
      const fileInput = screen.getByLabelText(/import markdown file/i)
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })
      fireEvent.change(fileInput)

      // Wait for file processing
      await waitFor(() => {
        expect(screen.getByDisplayValue('# Imported Document\n\nImported content.')).toBeInTheDocument()
      })

      // Verify ID was generated from filename
      const idField = screen.getByLabelText('ID')
      expect(idField).toHaveValue('test')
    })

    it('should handle JSON file import', async () => {
      renderObjectForm()

      // Switch to arguments tab
      const argumentsTab = screen.getByRole('tab', { name: /arguments/i })
      fireEvent.click(argumentsTab)

      // Create a mock JSON file
      const jsonData = {
        arguments: [{
          id: 'imported-arg',
          core: {
            name: 'Imported Argument',
            summary: 'An imported argument',
            layoutMode: 'standard',
            variables: [],
            mode: {}
          },
          zones: [],
          dependencies: [],
          modes: [],
          counterarguments: [],
          subarguments: [],
          validation: { isValid: true, errors: [] },
          pagination: { currentPage: 1, totalPages: 1 }
        }]
      }

      const file = new File([JSON.stringify(jsonData)], 'test.json', {
        type: 'application/json'
      })

      // Find and trigger file input
      const fileInput = screen.getByLabelText(/import json file/i)
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })
      fireEvent.change(fileInput)

      // Wait for file processing
      await waitFor(() => {
        expect(screen.getByText('1 arguments loaded')).toBeInTheDocument()
      })
    })

    it('should validate ID format', async () => {
      renderObjectForm()

      const idField = screen.getByLabelText('ID')
      fireEvent.change(idField, { target: { value: 'invalid id with spaces!' } })

      await waitFor(() => {
        expect(screen.getByText(/ID must contain only letters, numbers, underscores, and hyphens/)).toBeInTheDocument()
      })

      const submitButton = screen.getByRole('button', { name: /submit/i })
      expect(submitButton).toBeDisabled()
    })

    it('should validate markdown content size', async () => {
      renderObjectForm()

      // Switch to markdown tab
      const markdownTab = screen.getByRole('tab', { name: /markdown/i })
      fireEvent.click(markdownTab)

      // Create content that's too large (> 1MB)
      const largeContent = 'a'.repeat(1000001)
      const markdownField = screen.getByLabelText('Markdown Content')
      fireEvent.change(markdownField, { target: { value: largeContent } })

      await waitFor(() => {
        expect(screen.getByText(/Markdown content too large/)).toBeInTheDocument()
      })
    })
  })

  describe('Edit Mode', () => {
    beforeEach(() => {
      mockRealAPI.getObject.mockResolvedValue({ success: true, data: mockZLFNObject })
    })

    it('should load existing object for editing', async () => {
      renderObjectForm({ objectId: 'test-object-id' })

      // Wait for object to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Object')).toBeInTheDocument()
      })

      // Verify API call
      expect(mockRealAPI.getObject).toHaveBeenCalledWith('test-object-id')
    })

    it('should update existing object', async () => {
      const mockOnClose = vi.fn()
      renderObjectForm({ objectId: 'test-object-id', onClose: mockOnClose })

      // Wait for object to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Object')).toBeInTheDocument()
      })

      // Modify the title
      const titleField = screen.getByLabelText('Title')
      fireEvent.change(titleField, { target: { value: 'Updated Test Object' } })

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /submit/i })
      await waitFor(() => expect(submitButton).not.toBeDisabled())
      fireEvent.click(submitButton)

      // Verify update API call
      await waitFor(() => {
        expect(mockRealAPI.updateObject).toHaveBeenCalledWith(
          'test-object-id',
          expect.objectContaining({
            metadata: expect.objectContaining({
              title: 'Updated Test Object'
            })
          })
        )
      })

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should delete existing object', async () => {
      const mockOnClose = vi.fn()
      renderObjectForm({ objectId: 'test-object-id', onClose: mockOnClose })

      // Wait for object to load
      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Object')).toBeInTheDocument()
      })

      // Click delete button
      const deleteButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(deleteButton)

      // Confirm deletion in dialog
      const confirmButton = await screen.findByRole('button', { name: /confirm/i })
      fireEvent.click(confirmButton)

      // Verify delete API call
      await waitFor(() => {
        expect(mockZlfnObjectManager.deleteObject).toHaveBeenCalledWith('test-object-id')
      })

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should handle object not found', async () => {
      mockRealAPI.getObject.mockResolvedValue({ success: false, data: null, error: 'Not found' })

      renderObjectForm({ objectId: 'non-existent-id' })

      await waitFor(() => {
        expect(screen.getByText(/Object not found/)).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API creation failure', async () => {
      mockRealAPI.createObject.mockResolvedValue({ 
        success: false, 
        data: null, 
        error: 'Creation failed' 
      })

      renderObjectForm()

      const titleField = screen.getByLabelText('Title')
      fireEvent.change(titleField, { target: { value: 'Test Title' } })

      const submitButton = screen.getByRole('button', { name: /submit/i })
      await waitFor(() => expect(submitButton).not.toBeDisabled())
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to create object/)).toBeInTheDocument()
      })
    })

    it('should handle API update failure', async () => {
      mockRealAPI.getObject.mockResolvedValue({ success: true, data: mockZLFNObject })
      mockRealAPI.updateObject.mockResolvedValue({ 
        success: false, 
        data: null, 
        error: 'Update failed' 
      })

      renderObjectForm({ objectId: 'test-object-id' })

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Object')).toBeInTheDocument()
      })

      const titleField = screen.getByLabelText('Title')
      fireEvent.change(titleField, { target: { value: 'Updated Title' } })

      const submitButton = screen.getByRole('button', { name: /submit/i })
      await waitFor(() => expect(submitButton).not.toBeDisabled())
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to update object/)).toBeInTheDocument()
      })
    })

    it('should handle delete failure', async () => {
      mockRealAPI.getObject.mockResolvedValue({ success: true, data: mockZLFNObject })
      mockZlfnObjectManager.deleteObject.mockResolvedValue(false)

      renderObjectForm({ objectId: 'test-object-id' })

      await waitFor(() => {
        expect(screen.getByDisplayValue('Test Object')).toBeInTheDocument()
      })

      const deleteButton = screen.getByRole('button', { name: /delete/i })
      fireEvent.click(deleteButton)

      const confirmButton = await screen.findByRole('button', { name: /confirm/i })
      fireEvent.click(confirmButton)

      await waitFor(() => {
        expect(screen.getByText(/Failed to delete object/)).toBeInTheDocument()
      })
    })

    it('should handle file import errors', async () => {
      renderObjectForm()

      // Switch to markdown tab
      const markdownTab = screen.getByRole('tab', { name: /markdown/i })
      fireEvent.click(markdownTab)

      // Create an invalid file (not markdown)
      const file = new File(['invalid content'], 'test.txt', {
        type: 'text/plain'
      })

      const fileInput = screen.getByLabelText(/import markdown file/i)
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/Please select a valid markdown file/)).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    it('should validate argument dependencies', async () => {
      renderObjectForm()

      // Switch to arguments tab
      const argumentsTab = screen.getByRole('tab', { name: /arguments/i })
      fireEvent.click(argumentsTab)

      // Add an argument with invalid dependency
      const jsonData = {
        arguments: [{
          id: 'arg1',
          core: {
            name: 'Test Argument',
            summary: 'A test argument',
            layoutMode: 'standard',
            variables: [],
            mode: {}
          },
          zones: [],
          dependencies: [{ target: '' }], // Invalid empty target
          modes: [],
          counterarguments: [],
          subarguments: [],
          validation: { isValid: true, errors: [] },
          pagination: { currentPage: 1, totalPages: 1 }
        }]
      }

      const file = new File([JSON.stringify(jsonData)], 'test.json', {
        type: 'application/json'
      })

      const fileInput = screen.getByLabelText(/import json file/i)
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText(/Dependency target cannot be empty/)).toBeInTheDocument()
      })

      const submitButton = screen.getByRole('button', { name: /submit/i })
      expect(submitButton).toBeDisabled()
    })

    it('should show validation progress', async () => {
      renderObjectForm()

      const titleField = screen.getByLabelText('Title')
      fireEvent.change(titleField, { target: { value: 'Test' } })

      // Should show validating state briefly
      await waitFor(() => {
        const titleContainer = titleField.closest('.MuiFormControl-root')
        expect(titleContainer).toBeInTheDocument()
      })
    })
  })

  describe('Routing Integration', () => {
    it('should update URL after successful creation', async () => {
      // Mock window.history.pushState
      const mockPushState = vi.fn()
      Object.defineProperty(window, 'history', {
        value: { pushState: mockPushState },
        writable: true
      })

      const mockOnClose = vi.fn()
      renderObjectForm({ onClose: mockOnClose })

      const titleField = screen.getByLabelText('Title')
      fireEvent.change(titleField, { target: { value: 'New Object' } })

      const submitButton = screen.getByRole('button', { name: /submit/i })
      await waitFor(() => expect(submitButton).not.toBeDisabled())
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockPushState).toHaveBeenCalledWith({}, '', '/test-uuid-123')
      })
    })
  })
})
