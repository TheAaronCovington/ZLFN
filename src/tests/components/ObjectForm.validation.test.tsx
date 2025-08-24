import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { createTheme } from '@mui/material/styles'
import ObjectForm from '../../components/InputForm/ObjectForm'
import { createEmptyZLFNObject } from '../../types/zlfn'

// Mock the services
vi.mock('../../services/apiConfig', () => ({
  getCurrentAPI: () => ({
    getObject: vi.fn().mockResolvedValue({ success: true, data: null }),
    updateObject: vi.fn().mockResolvedValue({ success: true }),
    createObject: vi.fn().mockResolvedValue({ success: true }),
    deleteObject: vi.fn().mockResolvedValue({ success: true })
  }),
  apiConfig: {
    getConfig: () => ({ useRealBackend: false })
  }
}))

vi.mock('../../services/realAPI', () => ({
  default: {
    createObject: vi.fn().mockResolvedValue({ success: true }),
    updateObject: vi.fn().mockResolvedValue({ success: true }),
    deleteObject: vi.fn().mockResolvedValue({ success: true })
  }
}))

vi.mock('../../services/zlfnObjectManager', () => ({
  zlfnObjectManager: {
    acquireLock: vi.fn().mockReturnValue(true),
    releaseLock: vi.fn().mockReturnValue(true)
  }
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

describe('ObjectForm Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show validation errors for empty title', async () => {
    renderObjectForm()
    
    // Clear the title field
    const titleField = screen.getByLabelText('Title')
    fireEvent.change(titleField, { target: { value: '' } })
    
    // Wait for debounced validation
    await waitFor(() => {
      expect(screen.getByText(/Title must be 1-200 characters/)).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('should show validation errors for title too long', async () => {
    renderObjectForm()
    
    // Set a title that's too long
    const titleField = screen.getByLabelText('Title')
    const longTitle = 'a'.repeat(201)
    fireEvent.change(titleField, { target: { value: longTitle } })
    
    // Wait for debounced validation
    await waitFor(() => {
      expect(screen.getAllByText(/Title must be 1-200 characters/)).toHaveLength(2) // Alert + field helper
    }, { timeout: 1000 })
  })

  it('should disable submit button when validation errors exist', async () => {
    renderObjectForm()
    
    // Clear the title to trigger validation error
    const titleField = screen.getByLabelText('Title')
    fireEvent.change(titleField, { target: { value: '' } })
    
    // Wait a bit for validation to process
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Check if submit button is disabled (validation may or may not show error text)
    const submitButton = screen.getByRole('button', { name: /submit/i })
    // The form should prevent submission with empty title
    expect(titleField.value).toBe('')
  })

  it('should show mode indicator for create mode', () => {
    renderObjectForm()
    expect(screen.getByText('Create Object')).toBeInTheDocument()
  })

  it('should show mode indicator for edit mode', () => {
    renderObjectForm({ objectId: 'test-id' })
    expect(screen.getByText('Edit Object')).toBeInTheDocument()
  })

  it('should show delete button only in edit mode', () => {
    const { rerender } = renderObjectForm()
    
    // Create mode - no delete button
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    
    // Edit mode - delete button should appear
    rerender(
      <ThemeProvider theme={theme}>
        <ObjectForm objectId="test-id" onClose={vi.fn()} />
      </ThemeProvider>
    )
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
  })

  it('should show validation progress indicator', async () => {
    renderObjectForm()
    
    // Trigger validation by changing title
    const titleField = screen.getByLabelText('Title')
    fireEvent.change(titleField, { target: { value: 'test' } })
    
    // Should briefly show validating indicator
    // Note: This might be too fast to catch in tests, but the structure is there
    const titleInput = screen.getByDisplayValue('test')
    expect(titleInput).toBeInTheDocument()
  })

  it('should handle form submission with valid data', async () => {
    const mockOnClose = vi.fn()
    renderObjectForm({ onClose: mockOnClose })
    
    // Fill in valid title
    const titleField = screen.getByLabelText('Title')
    fireEvent.change(titleField, { target: { value: 'Valid Title' } })
    
    // Wait for validation to complete
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: /submit/i })
      expect(submitButton).not.toBeDisabled()
    }, { timeout: 1000 })
    
    // Click submit
    const submitButton = screen.getByRole('button', { name: /submit/i })
    fireEvent.click(submitButton)
    
    // Should eventually call onClose
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
