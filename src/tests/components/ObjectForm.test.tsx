import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ObjectForm from '../../components/InputForm/ObjectForm'

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
})


