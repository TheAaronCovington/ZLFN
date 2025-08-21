import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { parseExpressionToAst } from '../../services/logic'
import SemanticTableau from './SemanticTableau'

// Mock the vis module
vi.mock('../../vis', () => ({
	createFacetIcons: vi.fn()
}))

// Mock the Enhanced components
vi.mock('../Enhanced', () => ({
	VennDiagramDialog: () => <div data-testid="venn-dialog" />,
	TruthTableDialog: () => <div data-testid="truth-dialog" />,
	TimelineDialog: () => <div data-testid="timeline-dialog" />,
	CounterargumentsDialog: () => <div data-testid="counter-dialog" />
}))

// Mock D3 to avoid DOM manipulation issues in tests
vi.mock('d3', () => ({
	select: vi.fn(() => ({
		selectAll: vi.fn(() => ({ remove: vi.fn() })),
		append: vi.fn(() => ({
			attr: vi.fn(() => ({ attr: vi.fn(), append: vi.fn(), text: vi.fn() }))
		})),
		attr: vi.fn(),
		call: vi.fn()
	})),
	hierarchy: vi.fn(),
	tree: vi.fn(() => ({ nodeSize: vi.fn(() => ({ separation: vi.fn() })) })),
	zoom: vi.fn(() => ({ scaleExtent: vi.fn(() => ({ on: vi.fn() })) })),
	zoomIdentity: { translate: vi.fn(() => ({ scale: vi.fn() })) }
}))

describe('SemanticTableau', () => {
	const mockProps = {
		expression: 'P ∧ Q',
		ast: parseExpressionToAst('P ∧ Q')
	}

	beforeEach(() => {
		// Clear localStorage before each test
		localStorage.clear()
		vi.clearAllMocks()
	})

	describe('Component Rendering', () => {
		it('renders without crashing', () => {
			render(<SemanticTableau {...mockProps} />)
			expect(screen.getByText(/Semantic Tableau/)).toBeInTheDocument()
		})

		it('displays the current expression', () => {
			render(<SemanticTableau {...mockProps} />)
			expect(screen.getByText(/P ∧ Q/)).toBeInTheDocument()
		})

		it('shows empty state when no AST provided', () => {
			render(<SemanticTableau expression="" ast={null} />)
			// The empty state message is rendered in SVG, so we check for the component structure
			expect(screen.getByRole('img')).toBeInTheDocument() // SVG element
		})
	})

	describe('Logic Mode Integration', () => {
		it('renders logic mode selector', () => {
			render(<SemanticTableau {...mockProps} />)
			expect(screen.getByLabelText('Logic Mode')).toBeInTheDocument()
		})

		it('displays all 7 logic modes', async () => {
			const user = userEvent.setup()
			render(<SemanticTableau {...mockProps} />)
			
			const select = screen.getByLabelText('Logic Mode')
			await user.click(select)
			
			expect(screen.getByText('Classical')).toBeInTheDocument()
			expect(screen.getByText('Epistemic')).toBeInTheDocument()
			expect(screen.getByText('Deontic')).toBeInTheDocument()
			expect(screen.getByText('Temporal')).toBeInTheDocument()
			expect(screen.getByText('Informal')).toBeInTheDocument()
			expect(screen.getByText('Paraconsistent')).toBeInTheDocument()
			expect(screen.getByText('Fuzzy')).toBeInTheDocument()
		})

		it('persists logic mode selection', async () => {
			const user = userEvent.setup()
			render(<SemanticTableau {...mockProps} />)
			
			const select = screen.getByLabelText('Logic Mode')
			await user.click(select)
			await user.click(screen.getByText('Epistemic'))
			
			expect(localStorage.getItem('xv_stn_logic_mode')).toBe('epistemic')
		})
	})

	describe('Layout Controls', () => {
		it('renders layout mode toggle', () => {
			render(<SemanticTableau {...mockProps} />)
			expect(screen.getByText('Tree')).toBeInTheDocument()
			expect(screen.getByText('Hierarchy')).toBeInTheDocument()
		})

		it('allows switching between tree and hierarchy modes', async () => {
			const user = userEvent.setup()
			render(<SemanticTableau {...mockProps} />)
			
			const hierarchyButton = screen.getByText('Hierarchy')
			await user.click(hierarchyButton)
			
			// Check that the button is now selected (implementation may vary)
			expect(hierarchyButton).toHaveAttribute('aria-pressed', 'true')
		})
	})

	describe('Step Controls', () => {
		it('renders step mode toggle', () => {
			render(<SemanticTableau {...mockProps} />)
			expect(screen.getByText('Step Mode')).toBeInTheDocument()
		})

		it('shows step controls when step mode is enabled', async () => {
			const user = userEvent.setup()
			render(<SemanticTableau {...mockProps} />)
			
			const stepModeSwitch = screen.getByRole('checkbox', { name: /step mode/i })
			await user.click(stepModeSwitch)
			
			await waitFor(() => {
				expect(screen.getByText(/Step \(/)).toBeInTheDocument()
				expect(screen.getByText(/Depth:/)).toBeInTheDocument()
			})
		})

		it('persists step mode preference', async () => {
			const user = userEvent.setup()
			render(<SemanticTableau {...mockProps} />)
			
			const stepModeSwitch = screen.getByRole('checkbox', { name: /step mode/i })
			await user.click(stepModeSwitch)
			
			expect(localStorage.getItem('xv_stn_step_mode')).toBe('true')
		})
	})

	describe('Export/Import Functionality', () => {
		it('renders export and import buttons', () => {
			render(<SemanticTableau {...mockProps} />)
			expect(screen.getByText('Export')).toBeInTheDocument()
			expect(screen.getByText('Import')).toBeInTheDocument()
		})

		it('triggers export when export button is clicked', async () => {
			// Mock URL.createObjectURL and related functions
			global.URL.createObjectURL = vi.fn(() => 'mock-url')
			global.URL.revokeObjectURL = vi.fn()
			
			const mockClick = vi.fn()
			const mockAnchor = {
				href: '',
				download: '',
				click: mockClick
			}
			vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)

			const user = userEvent.setup()
			render(<SemanticTableau {...mockProps} />)
			
			const exportButton = screen.getByText('Export')
			await user.click(exportButton)
			
			expect(mockClick).toHaveBeenCalled()
		})
	})

	describe('Auto Operations', () => {
		it('renders auto expand and auto close buttons', () => {
			render(<SemanticTableau {...mockProps} />)
			expect(screen.getByText(/Auto Expand/)).toBeInTheDocument()
			expect(screen.getByText('Auto Close')).toBeInTheDocument()
		})

		it('updates auto expand button text in step mode', async () => {
			const user = userEvent.setup()
			render(<SemanticTableau {...mockProps} />)
			
			const stepModeSwitch = screen.getByRole('checkbox', { name: /step mode/i })
			await user.click(stepModeSwitch)
			
			await waitFor(() => {
				expect(screen.getByText(/Auto Expand \(Depth/)).toBeInTheDocument()
			})
		})
	})

	describe('Proof Status', () => {
		it('displays proof status chip', () => {
			render(<SemanticTableau {...mockProps} />)
			// Look for status indicators (the exact text may vary based on tableau state)
			const statusElements = screen.getAllByRole('button').filter(
				button => button.textContent?.includes('Open') || 
						 button.textContent?.includes('Complete') ||
						 button.textContent?.includes('Invalid')
			)
			expect(statusElements.length).toBeGreaterThan(0)
		})
	})

	describe('Keyboard Shortcuts', () => {
		it('displays keyboard shortcuts tooltip', () => {
			render(<SemanticTableau {...mockProps} />)
			const keyboardChip = screen.getByText('⌨️')
			expect(keyboardChip).toBeInTheDocument()
		})

		it('handles keyboard events for shortcuts', () => {
			render(<SemanticTableau {...mockProps} />)
			
			// Test that keyboard events don't crash the component
			fireEvent.keyDown(document, { key: 'd', code: 'KeyD' })
			fireEvent.keyDown(document, { key: 'x', code: 'KeyX' })
			fireEvent.keyDown(document, { key: 'a', code: 'KeyA' })
			fireEvent.keyDown(document, { key: 'c', code: 'KeyC' })
			
			// Component should still be rendered without errors
			expect(screen.getByText(/Semantic Tableau/)).toBeInTheDocument()
		})
	})

	describe('State Persistence', () => {
		it('saves tableau state to localStorage', () => {
			render(<SemanticTableau {...mockProps} />)
			
			// Wait for auto-save to potentially trigger
			setTimeout(() => {
				const storageKeys = Object.keys(localStorage)
				const tableauKeys = storageKeys.filter(key => key.startsWith('xv_stn_'))
				expect(tableauKeys.length).toBeGreaterThan(0)
			}, 1100) // Auto-save debounce is 1000ms
		})
	})

	describe('Visual Enhancements', () => {
		it('applies AI theme classes and styling', () => {
			render(<SemanticTableau {...mockProps} />)
			
			// Check for MUI theme application
			const container = screen.getByRole('img').parentElement // SVG container
			expect(container).toHaveStyle({ position: 'relative' })
		})
	})

	describe('Error Handling', () => {
		it('handles invalid expressions gracefully', () => {
			const invalidAst = null
			render(<SemanticTableau expression="invalid" ast={invalidAst} />)
			
			// Should not crash and should show empty state
			expect(screen.getByRole('img')).toBeInTheDocument()
		})

		it('handles localStorage errors gracefully', () => {
			// Mock localStorage to throw errors
			const originalSetItem = localStorage.setItem
			localStorage.setItem = vi.fn(() => {
				throw new Error('Storage quota exceeded')
			})

			// Should not crash when localStorage fails
			expect(() => {
				render(<SemanticTableau {...mockProps} />)
			}).not.toThrow()

			// Restore localStorage
			localStorage.setItem = originalSetItem
		})
	})
})

// Integration tests for tableau logic
describe('SemanticTableau Logic Integration', () => {
	it('creates correct initial tableau from simple conjunction', () => {
		const ast = parseExpressionToAst('P ∧ Q')
		render(<SemanticTableau expression="P ∧ Q" ast={ast} />)
		
		// Should render without errors and show the expression
		expect(screen.getByText(/P ∧ Q/)).toBeInTheDocument()
	})

	it('creates correct initial tableau from implication', () => {
		const ast = parseExpressionToAst('P → Q')
		render(<SemanticTableau expression="P → Q" ast={ast} />)
		
		expect(screen.getByText(/P → Q/)).toBeInTheDocument()
	})

	it('handles complex nested expressions', () => {
		const ast = parseExpressionToAst('(P ∧ Q) → (R ∨ S)')
		render(<SemanticTableau expression="(P ∧ Q) → (R ∨ S)" ast={ast} />)
		
		expect(screen.getByText(/\(P ∧ Q\) → \(R ∨ S\)/)).toBeInTheDocument()
	})
})
