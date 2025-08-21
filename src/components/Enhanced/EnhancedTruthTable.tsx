import React, { useState, useMemo } from 'react'
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
  Stack,
  Paper,
  Chip,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  Card,
  CardContent
} from '@mui/material'
import {
  FilterList as FilterIcon,
  GetApp as ExportIcon,
  Search as SearchIcon
} from '@mui/icons-material'
import { DataGrid, type GridColDef } from '@mui/x-data-grid'
import type { AstNodeRec } from '../../services/logic'
import { evalAst } from '../../services/eval'

interface EnhancedTruthTableProps {
  ast: AstNodeRec
  expression?: string
  onExport?: () => void
}

// Helper function to collect variables from AST
function collectVars(node: AstNodeRec, acc: Set<string>) {
  const kids = node.children || []
  if (!kids.length) {
    const name = node.label.trim()
    if (/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) acc.add(name)
    return
  }
  kids.forEach(k => collectVars(k, acc))
}

// Helper function to evaluate step by step
function evaluateStepByStep(ast: AstNodeRec, env: Record<string, boolean>) {
  const steps: Array<{ expression: string; value: boolean; explanation: string }> = []
  
  function evalWithSteps(node: AstNodeRec): boolean {
    const label = node.label
    const children = node.children || []
    
    if (!children.length && !('∧∨⊻→↔¬∀∃'.includes(label))) {
      const value = !!env[label]
      steps.push({
        expression: label,
        value,
        explanation: `Variable ${label} = ${value ? 'T' : 'F'}`
      })
      return value
    }
    
    if (label === '¬') {
      const childValue = evalWithSteps(children[0])
      const result = !childValue
      steps.push({
        expression: `¬${children[0].label}`,
        value: result,
        explanation: `Negation: ¬${childValue ? 'T' : 'F'} = ${result ? 'T' : 'F'}`
      })
      return result
    }
    
    if (label === '∧') {
      const values = children.map(c => evalWithSteps(c))
      const result = values.every(v => v)
      steps.push({
        expression: children.map(c => c.label).join(' ∧ '),
        value: result,
        explanation: `Conjunction: ${values.map(v => v ? 'T' : 'F').join(' ∧ ')} = ${result ? 'T' : 'F'}`
      })
      return result
    }
    
    if (label === '∨') {
      const values = children.map(c => evalWithSteps(c))
      const result = values.some(v => v)
      steps.push({
        expression: children.map(c => c.label).join(' ∨ '),
        value: result,
        explanation: `Disjunction: ${values.map(v => v ? 'T' : 'F').join(' ∨ ')} = ${result ? 'T' : 'F'}`
      })
      return result
    }
    
    if (label === '→') {
      const antecedent = evalWithSteps(children[0])
      const consequent = evalWithSteps(children[1])
      const result = !antecedent || consequent
      steps.push({
        expression: `${children[0].label} → ${children[1].label}`,
        value: result,
        explanation: `Implication: ${antecedent ? 'T' : 'F'} → ${consequent ? 'T' : 'F'} = ${result ? 'T' : 'F'}`
      })
      return result
    }
    
    if (label === '↔') {
      const left = evalWithSteps(children[0])
      const right = evalWithSteps(children[1])
      const result = left === right
      steps.push({
        expression: `${children[0].label} ↔ ${children[1].label}`,
        value: result,
        explanation: `Biconditional: ${left ? 'T' : 'F'} ↔ ${right ? 'T' : 'F'} = ${result ? 'T' : 'F'}`
      })
      return result
    }
    
    return false
  }
  
  const finalValue = evalWithSteps(ast)
  return { steps, finalValue }
}

export const EnhancedTruthTable: React.FC<EnhancedTruthTableProps> = ({
  ast,
  expression = '',
  onExport
}) => {
  const [stepMode, setStepMode] = useState(false)
  const [highlightMode, setHighlightMode] = useState(false)
  const [filterValue, setFilterValue] = useState<'all' | 'true' | 'false'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Extract variables and generate truth table data
  const { vars, rows, columns } = useMemo(() => {
    const variableSet = new Set<string>()
    collectVars(ast, variableSet)
    const variables = Array.from(variableSet).sort()
    
    const numRows = 1 << variables.length
    const tableRows: any[] = []
    
    for (let i = 0; i < numRows; i++) {
      const env: Record<string, boolean> = {}
      variables.forEach((v, idx) => {
        env[v] = !!((i >> (variables.length - idx - 1)) & 1)
      })
      
      const finalValue = evalAst(ast, env)
      const stepByStep = stepMode ? evaluateStepByStep(ast, env) : null
      
      const row: any = {
        id: i,
        ...env,
        result: finalValue,
        resultText: finalValue ? 'T' : 'F',
        steps: stepByStep?.steps || [],
        rowType: finalValue ? 'true' : 'false'
      }
      
      tableRows.push(row)
    }
    
    // Create columns
    const cols: GridColDef[] = [
      ...variables.map((variable): GridColDef => ({
        field: variable,
        headerName: variable,
        width: 80,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: any) => (
          <Chip
            label={params.value ? 'T' : 'F'}
            size="small"
            sx={{
              backgroundColor: params.value ? 'rgba(0, 230, 118, 0.2)' : 'rgba(244, 67, 54, 0.2)',
              color: params.value ? '#00e676' : '#f44336',
              border: `1px solid ${params.value ? '#00e676' : '#f44336'}`,
              fontWeight: 600,
              minWidth: 40
            }}
          />
        )
      })),
      {
        field: 'result',
        headerName: 'Result',
        width: 100,
        align: 'center',
        headerAlign: 'center',
        renderCell: (params: any) => (
          <Chip
            label={params.row.resultText}
            size="small"
            variant="filled"
            sx={{
              backgroundColor: params.value ? '#00e676' : '#f44336',
              color: params.value ? '#000' : '#fff',
              fontWeight: 700,
              fontSize: '0.9rem',
              boxShadow: params.value 
                ? '0 0 10px rgba(0, 230, 118, 0.4)' 
                : '0 0 10px rgba(244, 67, 54, 0.4)'
            }}
          />
        )
      }
    ]
    
    return { vars: variables, rows: tableRows, columns: cols }
  }, [ast, stepMode])

  // Filter rows based on current filter
  const filteredRows = useMemo(() => {
    let filtered = rows
    
    if (filterValue !== 'all') {
      filtered = filtered.filter((row: any) => row.rowType === filterValue)
    }
    
    if (searchTerm) {
      filtered = filtered.filter((row: any) => 
        vars.some(v => row[v].toString().toLowerCase().includes(searchTerm.toLowerCase())) ||
        row.resultText.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    return filtered
  }, [rows, filterValue, searchTerm, vars])

  // Calculate statistics
  const stats = useMemo(() => {
    const totalRows = rows.length
    const trueRows = rows.filter((row: any) => row.result).length
    const falseRows = totalRows - trueRows
    const satisfiability = totalRows > 0 ? (trueRows / totalRows) * 100 : 0
    const isTautology = trueRows === totalRows
    const isContradiction = trueRows === 0
    const isContingent = trueRows > 0 && trueRows < totalRows
    
    return {
      totalRows,
      trueRows,
      falseRows,
      satisfiability,
      isTautology,
      isContradiction,
      isContingent
    }
  }, [rows])

  const handleExport = () => {
    // Export as CSV
    const headers = [...vars, 'Result']
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => [
        ...vars.map(v => row[v] ? 'T' : 'F'),
        row.resultText
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = 'truth-table.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    onExport?.()
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Controls Row */}
      <Box sx={{ p: 3, borderBottom: '1px solid rgba(64, 196, 255, 0.2)' }}>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" sx={{ color: '#ffffff', fontFamily: 'monospace' }}>
              {expression || 'Truth Table Analysis'}
            </Typography>
          </Box>
          
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  checked={stepMode}
                  onChange={(e) => setStepMode(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#00e676' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#00e676' }
                  }}
                />
              }
              label="Step Mode"
              sx={{ color: '#ffffff' }}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={highlightMode}
                  onChange={(e) => setHighlightMode(e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#40c4ff' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#40c4ff' }
                  }}
                />
              }
              label="Highlight"
              sx={{ color: '#ffffff' }}
            />
            
            <ButtonGroup variant="outlined" size="small">
              <Button
                startIcon={<FilterIcon />}
                onClick={() => setFilterValue(filterValue === 'all' ? 'true' : filterValue === 'true' ? 'false' : 'all')}
                sx={{ 
                  color: filterValue !== 'all' ? '#00e676' : '#40c4ff', 
                  borderColor: filterValue !== 'all' ? '#00e676' : '#40c4ff' 
                }}
              >
                Filter: {filterValue}
              </Button>
              <Button
                startIcon={<ExportIcon />}
                onClick={handleExport}
                sx={{ color: '#ff9800', borderColor: '#ff9800' }}
              >
                Export CSV
              </Button>
            </ButtonGroup>
          </Stack>
        </Stack>
        
        {/* Search Bar */}
        <Box sx={{ mt: 2 }}>
          <TextField
            size="small"
            placeholder="Search truth table..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#40c4ff' }} />
                </InputAdornment>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#ffffff',
                '& fieldset': { borderColor: 'rgba(64, 196, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(64, 196, 255, 0.5)' },
                '&.Mui-focused fieldset': { borderColor: '#40c4ff' }
              }
            }}
          />
        </Box>
      </Box>

      {/* Main Truth Table */}
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Paper
          sx={{
            height: '100%',
            backgroundColor: 'rgba(25, 25, 35, 0.8)',
            border: '1px solid rgba(64, 196, 255, 0.2)',
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <DataGrid
            rows={filteredRows}
            columns={columns}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } }
            }}
            pageSizeOptions={[10, 25, 50]}
            disableRowSelectionOnClick
            onRowClick={(params: any) => console.log('Row clicked:', params.id)}
            sx={{
              border: 'none',
              '& .MuiDataGrid-main': {
                backgroundColor: 'transparent'
              },
              '& .MuiDataGrid-columnHeaders': {
                backgroundColor: 'rgba(64, 196, 255, 0.1)',
                borderBottom: '1px solid rgba(64, 196, 255, 0.3)',
                '& .MuiDataGrid-columnHeader': {
                  color: '#40c4ff',
                  fontWeight: 600
                }
              },
              '& .MuiDataGrid-row': {
                backgroundColor: 'rgba(25, 25, 35, 0.5)',
                borderBottom: '1px solid rgba(64, 196, 255, 0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(64, 196, 255, 0.1)'
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(156, 39, 176, 0.2)'
                }
              },
              '& .MuiDataGrid-cell': {
                color: '#ffffff',
                borderRight: '1px solid rgba(64, 196, 255, 0.1)'
              },
              '& .MuiDataGrid-footerContainer': {
                backgroundColor: 'rgba(64, 196, 255, 0.05)',
                borderTop: '1px solid rgba(64, 196, 255, 0.2)',
                '& .MuiTablePagination-root': {
                  color: '#ffffff'
                }
              }
            }}
          />
        </Paper>
      </Box>

      {/* Analysis Row */}
      <Box sx={{ p: 3, borderTop: '1px solid rgba(64, 196, 255, 0.2)' }}>
        <Card sx={{ backgroundColor: 'rgba(64, 196, 255, 0.05)', border: '1px solid rgba(64, 196, 255, 0.2)' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#40c4ff', mb: 2 }}>
              Logical Analysis & Insights
            </Typography>
            <Stack direction="row" spacing={4} alignItems="center">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  📊 Satisfiability:
                </Typography>
                <Chip
                  label={`${stats.satisfiability.toFixed(1)}%`}
                  size="small"
                  sx={{
                    backgroundColor: stats.satisfiability > 50 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                    color: stats.satisfiability > 50 ? '#00e676' : '#f44336'
                  }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  ⚡ Type:
                </Typography>
                <Chip
                  label={
                    stats.isTautology ? 'Tautology' :
                    stats.isContradiction ? 'Contradiction' :
                    'Contingent'
                  }
                  size="small"
                  sx={{
                    backgroundColor: 
                      stats.isTautology ? 'rgba(0, 230, 118, 0.2)' :
                      stats.isContradiction ? 'rgba(244, 67, 54, 0.2)' :
                      'rgba(255, 152, 0, 0.2)',
                    color: 
                      stats.isTautology ? '#00e676' :
                      stats.isContradiction ? '#f44336' :
                      '#ff9800'
                  }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  🎯 True Cases:
                </Typography>
                <Typography variant="body2" sx={{ color: '#00e676', fontWeight: 500 }}>
                  {stats.trueRows}/{stats.totalRows}
                </Typography>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  )
}

export default EnhancedTruthTable
