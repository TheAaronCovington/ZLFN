import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ObjectForm from '../../components/InputForm/ObjectForm'
import { vi } from 'vitest'

vi.mock('../../services/apiConfig', () => ({
  getCurrentAPI: () => ({
    createObject: async (_markdown?: string, _json?: any) => ({ success: true, data: null, error: null }),
    updateObject: async (_id: string, _updates: any) => ({ success: true, data: null, error: null }),
    getObject: async (_id: string) => ({ success: false, data: null, error: 'not found' })
  }),
  apiConfig: { getConfig: () => ({ useRealBackend: false }) }
}))

describe('ObjectForm', () => {
  it('renders and submits new object', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/create' }] as any}>
        <ObjectForm onClose={() => {}} />
      </MemoryRouter>
    )

    const title = await screen.findByLabelText('Title')
    fireEvent.change(title, { target: { value: 'Test Title' } })

    const submit = await screen.findByText('Submit')
    fireEvent.click(submit)

    // No throw; basic smoke
    expect(submit).toBeInTheDocument()
  })

  it('preserves markdown content when importing JSON', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={[{ pathname: '/create' }] as any}>
        <ObjectForm onClose={() => {}} />
      </MemoryRouter>
    )

    // Switch to Markdown tab and enter content
    fireEvent.click(screen.getByRole('tab', { name: /markdown/i }))
    const markdownField = await screen.findByLabelText('Markdown Content')
    fireEvent.change(markdownField, { target: { value: 'Original markdown' } })

    // Switch to Arguments tab to import JSON
    fireEvent.click(screen.getByRole('tab', { name: /arguments/i }))

    const jsonInput = container.querySelector('#arguments-json-file-input') as HTMLInputElement
    const jsonContent = {
      arguments: [
        {
          core: { name: 'Arg1', summary: '' },
          zones: [],
          dependencies: [],
          modes: {},
          counterarguments: [],
          subarguments: [],
          validation: { isValid: true, errors: [], warnings: [] },
          pagination: { currentPage: 1, totalPages: 1 }
        }
      ]
    }
    const file = new File([JSON.stringify(jsonContent)], 'test.json', { type: 'application/json' })

    const fileReaderMock = {
      onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null,
      readAsText(this: any, _file: Blob) {
        this.onload?.({ target: { result: JSON.stringify(jsonContent) } })
      }
    }
    const frSpy = vi.spyOn(window, 'FileReader').mockImplementation(() => fileReaderMock as any)

    await act(async () => {
      fireEvent.change(jsonInput, { target: { files: [file] } })
    })

    // Return to Markdown tab and ensure content is unchanged
    fireEvent.click(screen.getByRole('tab', { name: /markdown/i }))
    const markdownFieldAfter = await screen.findByLabelText('Markdown Content')
    expect((markdownFieldAfter as HTMLInputElement).value).toBe('Original markdown')
    frSpy.mockRestore()
  })

  it('loads markdown content from initialData into textarea', async () => {
    const initialData = { markdownContent: '# Imported\n\nContent', arguments: [] }

    render(
      <MemoryRouter initialEntries={[{ pathname: '/create' }] as any}>
        <ObjectForm onClose={() => {}} initialData={initialData} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('tab', { name: /markdown/i }))
    const markdownField = await screen.findByLabelText('Markdown Content')
    expect((markdownField as HTMLInputElement).value).toBe('# Imported\n\nContent')
  })

  it('does not overwrite markdown when reinitialized with JSON data', async () => {
    const markdownData = { markdownContent: 'Original markdown', arguments: [] }
    const jsonData = {
      arguments: [
        {
          core: { name: 'Arg1', summary: '' },
          zones: [],
          dependencies: [],
          modes: {},
          counterarguments: [],
          subarguments: [],
          validation: { isValid: true, errors: [], warnings: [] },
          pagination: { currentPage: 1, totalPages: 1 }
        }
      ]
    }

    const Wrapper = ({ data }: { data: any }) => (
      <MemoryRouter initialEntries={[{ pathname: '/create' }] as any}>
        <ObjectForm onClose={() => {}} initialData={data} />
      </MemoryRouter>
    )

    const { rerender } = render(<Wrapper data={markdownData} />)

    fireEvent.click(screen.getByRole('tab', { name: /markdown/i }))
    const mdField = await screen.findByLabelText('Markdown Content')
    expect((mdField as HTMLInputElement).value).toBe('Original markdown')

    await act(async () => {
      rerender(<Wrapper data={jsonData} />)
    })

    fireEvent.click(screen.getByRole('tab', { name: /markdown/i }))
    const mdFieldAfter = await screen.findByLabelText('Markdown Content')
    expect((mdFieldAfter as HTMLInputElement).value).toBe('Original markdown')
  })
})


