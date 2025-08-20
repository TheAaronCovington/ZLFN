import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  Box,
  Typography,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Alert,
  IconButton,
  Collapse
} from '@mui/material';
import {
  Description as DocumentIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Link as LinkIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { parseMarkdownStructure, type MarkdownSection } from '../../services/markdownParser';

interface MarkdownReference {
  documentId: string;
  documentTitle: string;
  sectionId: string;
  sectionTitle: string;
  sectionPath: string; // Full path like "Introduction > Core Concepts > Logic"
}

interface MarkdownReferenceSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (reference: MarkdownReference | null) => void;
  currentReference?: string; // Format: "documentId#sectionId"
  nodeId?: string;
}

export default function MarkdownReferenceSelector({
  open,
  onClose,
  onSelect,
  currentReference,
  nodeId
}: MarkdownReferenceSelectorProps) {
  const [documents, setDocuments] = useState<Array<{ id: string; title: string; content: string }>>([])
  const [selectedDocument, setSelectedDocument] = useState<string>('')
  const [sections, setSections] = useState<MarkdownSection[]>([])
  const [selectedSection, setSelectedSection] = useState<string>('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Load available documents
  useEffect(() => {
    if (open) {
      loadDocuments()
    }
  }, [open])

  // Parse current reference
  useEffect(() => {
    if (currentReference && documents.length > 0) {
      const [docId, sectionId] = currentReference.split('#')
      if (docId && sectionId) {
        setSelectedDocument(docId)
        setSelectedSection(sectionId)
      }
    }
  }, [currentReference, documents])

  // Load sections when document changes
  useEffect(() => {
    if (selectedDocument) {
      loadSections(selectedDocument)
    } else {
      setSections([])
      setSelectedSection('')
    }
  }, [selectedDocument])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError('')
      
      // Mock documents for now - in real implementation, this would fetch from API
      const mockDocuments = [
        {
          id: 'logic_demo',
          title: 'Logic Demo Document',
          content: `# Logic Fundamentals

## Introduction
This document covers the basic principles of logical reasoning.

### Core Concepts
Logic is the systematic study of valid inference and correct reasoning.

#### Premises and Conclusions
Arguments consist of premises that support conclusions.

## Advanced Topics

### Formal Logic
Mathematical approach to logical reasoning.

### Informal Logic
Natural language reasoning and argumentation.`
        },
        {
          id: 'argument_analysis',
          title: 'Argument Analysis Guide',
          content: `# Argument Analysis

## Structure Analysis
Breaking down arguments into components.

### Premise Identification
How to identify supporting statements.

### Conclusion Recognition
Finding the main claim being argued.

## Validity Assessment

### Logical Validity
When conclusions follow from premises.

### Soundness
Valid arguments with true premises.`
        }
      ]
      
      setDocuments(mockDocuments)
    } catch (err) {
      setError('Failed to load documents')
      console.error('Error loading documents:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadSections = (documentId: string) => {
    const document = documents.find(doc => doc.id === documentId)
    if (document) {
      const structure = parseMarkdownStructure(document.content)
      setSections(structure.sections)
      
      // Auto-expand sections with logic content
      const toExpand = new Set<string>()
      const expandLogicSections = (sections: MarkdownSection[]) => {
        sections.forEach(section => {
          if (section.hasLogicContent || section.expressionCount > 0) {
            toExpand.add(section.id)
          }
          if (section.children.length > 0) {
            expandLogicSections(section.children)
          }
        })
      }
      expandLogicSections(structure.sections)
      setExpandedSections(toExpand)
    }
  }

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId)
    } else {
      newExpanded.add(sectionId)
    }
    setExpandedSections(newExpanded)
  }

  const getSectionPath = (sectionId: string, sections: MarkdownSection[], path: string[] = []): string[] | null => {
    for (const section of sections) {
      const currentPath = [...path, section.title]
      if (section.id === sectionId) {
        return currentPath
      }
      if (section.children.length > 0) {
        const childPath = getSectionPath(sectionId, section.children, currentPath)
        if (childPath) {
          return childPath
        }
      }
    }
    return null
  }

  const renderSection = (section: MarkdownSection, depth: number = 0) => {
    const isExpanded = expandedSections.has(section.id)
    const isSelected = selectedSection === section.id
    const hasChildren = section.children.length > 0

    return (
      <Box key={section.id}>
        <ListItemButton
          selected={isSelected}
          onClick={() => setSelectedSection(section.id)}
          sx={{ 
            pl: 2 + depth * 2,
            borderLeft: depth > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
            '&.Mui-selected': {
              backgroundColor: 'rgba(0, 255, 255, 0.1)',
              borderLeft: '3px solid #00ffff'
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
            <ListItemText
              primary={section.title}
              secondary={
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Level {section.level}
                  </Typography>
                  {section.hasLogicContent && (
                    <Chip 
                      label="Logic" 
                      size="small" 
                      color="primary" 
                      variant="outlined"
                      sx={{ height: 16, fontSize: '0.6rem' }}
                    />
                  )}
                  {section.expressionCount > 0 && (
                    <Chip 
                      label={`${section.expressionCount} expr`} 
                      size="small" 
                      color="secondary" 
                      variant="outlined"
                      sx={{ height: 16, fontSize: '0.6rem' }}
                    />
                  )}
                </Box>
              }
            />
            {hasChildren && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleSection(section.id)
                }}
              >
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            )}
          </Box>
        </ListItemButton>
        
        {hasChildren && (
          <Collapse in={isExpanded}>
            {section.children.map(child => renderSection(child, depth + 1))}
          </Collapse>
        )}
      </Box>
    )
  }

  const handleSelect = () => {
    if (selectedDocument && selectedSection) {
      const document = documents.find(doc => doc.id === selectedDocument)
      const sectionPath = getSectionPath(selectedSection, sections)
      const section = findSectionById(selectedSection, sections)
      
      if (document && section && sectionPath) {
        const reference: MarkdownReference = {
          documentId: selectedDocument,
          documentTitle: document.title,
          sectionId: selectedSection,
          sectionTitle: section.title,
          sectionPath: sectionPath.join(' > ')
        }
        onSelect(reference)
      }
    }
    onClose()
  }

  const handleClear = () => {
    onSelect(null)
    onClose()
  }

  const findSectionById = (id: string, sections: MarkdownSection[]): MarkdownSection | null => {
    for (const section of sections) {
      if (section.id === id) {
        return section
      }
      if (section.children.length > 0) {
        const found = findSectionById(id, section.children)
        if (found) return found
      }
    }
    return null
  }

  const selectedSectionInfo = selectedSection ? findSectionById(selectedSection, sections) : null
  const selectedDocumentInfo = documents.find(doc => doc.id === selectedDocument)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(0, 255, 255, 0.3)',
          minHeight: '70vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1,
        borderBottom: '1px solid rgba(0, 255, 255, 0.2)'
      }}>
        <LinkIcon sx={{ color: '#00ffff' }} />
        <Typography variant="h6" sx={{ color: '#00ffff' }}>
          Link to Markdown Section
        </Typography>
        {nodeId && (
          <Chip 
            label={`Node: ${nodeId}`} 
            size="small" 
            sx={{ ml: 'auto', backgroundColor: 'rgba(0, 255, 255, 0.1)' }}
          />
        )}
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}

        {/* Document Selection */}
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <Autocomplete
            value={selectedDocumentInfo || null}
            onChange={(_, value) => setSelectedDocument(value?.id || '')}
            options={documents}
            getOptionLabel={(option) => option.title}
            loading={loading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Document"
                variant="outlined"
                InputProps={{
                  ...params.InputProps,
                  startAdornment: <DocumentIcon sx={{ mr: 1, color: '#00ffff' }} />
                }}
              />
            )}
            renderOption={(props, option) => (
              <Box component="li" {...props}>
                <DocumentIcon sx={{ mr: 1, color: '#00ffff' }} />
                <Box>
                  <Typography variant="body2">{option.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    ID: {option.id}
                  </Typography>
                </Box>
              </Box>
            )}
          />
        </Box>

        {/* Section Selection */}
        {selectedDocument && (
          <Box sx={{ flexGrow: 1 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <Typography variant="subtitle2" sx={{ color: '#00ffff', mb: 1 }}>
                Select Section
              </Typography>
              {selectedSectionInfo && (
                <Alert 
                  severity="info" 
                  sx={{ 
                    backgroundColor: 'rgba(0, 255, 255, 0.1)',
                    border: '1px solid rgba(0, 255, 255, 0.3)'
                  }}
                >
                  <Typography variant="body2">
                    <strong>Selected:</strong> {getSectionPath(selectedSection, sections)?.join(' > ')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Level {selectedSectionInfo.level} • {selectedSectionInfo.content.length} chars
                    {selectedSectionInfo.hasLogicContent && ' • Contains logic content'}
                  </Typography>
                </Alert>
              )}
            </Box>

            <List sx={{ maxHeight: '400px', overflow: 'auto' }}>
              {sections.map(section => renderSection(section))}
            </List>
          </Box>
        )}

        {/* Current Reference Display */}
        {currentReference && (
          <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
            <Typography variant="subtitle2" sx={{ color: '#ffaa00', mb: 1 }}>
              Current Reference
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentReference}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ borderTop: '1px solid rgba(0, 255, 255, 0.2)', p: 2 }}>
        <Button onClick={onClose} color="secondary">
          Cancel
        </Button>
        {currentReference && (
          <Button 
            onClick={handleClear} 
            color="warning"
            startIcon={<ClearIcon />}
          >
            Clear Reference
          </Button>
        )}
        <Button
          onClick={handleSelect}
          variant="contained"
          disabled={!selectedDocument || !selectedSection}
          startIcon={<LinkIcon />}
          sx={{
            background: 'linear-gradient(45deg, #00ffff, #0080ff)',
            '&:hover': {
              background: 'linear-gradient(45deg, #00cccc, #0066cc)'
            }
          }}
        >
          Link Section
        </Button>
      </DialogActions>
    </Dialog>
  )
}
