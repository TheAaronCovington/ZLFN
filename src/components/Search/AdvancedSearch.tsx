import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Chip,
  Autocomplete,
  FormControl,
  FormLabel,
  FormControlLabel,
  Checkbox,
  FormGroup,
  Typography,
  List,
  ListItemButton,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Collapse
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Description as DocumentIcon,
  StickyNote2 as NoteIcon,
  AccountTree as NodeIcon,
  Person as AuthorIcon
} from '@mui/icons-material';
import { api } from '../../services/zlfnAPI';
import type { ZLFNObject } from '../../types/zlfn';

interface SearchFilters {
  query: string;
  searchIn: ('content' | 'notes' | 'nodes' | 'metadata')[];
  author: string;
  tags: string[];
  dateFrom: string;
  dateTo: string;
  nodeTypes: string[];
  hasNotes: boolean | null;
  hasVersions: boolean | null;
}

interface SearchResult {
  object: ZLFNObject;
  matches: {
    type: 'content' | 'note' | 'node' | 'metadata';
    field: string;
    value: string;
    context: string;
    nodeId?: string;
  }[];
  score: number;
}

interface AdvancedSearchProps {
  open: boolean;
  onClose: () => void;
  onSelectResult?: (objectId: string, nodeId?: string) => void;
  initialQuery?: string;
  // New: search within the currently displayed graph
  currentNodes?: Array<{ id: string; name?: string; type?: string }>;
  currentObjectId?: string;
}

export default function AdvancedSearch({ 
  open, 
  onClose, 
  onSelectResult, 
  initialQuery = '',
  currentNodes,
  currentObjectId
}: AdvancedSearchProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    query: initialQuery,
    searchIn: ['content', 'notes', 'nodes', 'metadata'],
    author: '',
    tags: [],
    dateFrom: '',
    dateTo: '',
    nodeTypes: [],
    hasNotes: null,
    hasVersions: null
  });

  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [availableAuthors, setAvailableAuthors] = useState<string[]>([]);
  const [availableNodeTypes, setAvailableNodeTypes] = useState<string[]>([]);

  // Load available filter options
  useEffect(() => {
    if (open) {
      loadFilterOptions();
    }
  }, [open]);

  // Perform search when filters change
  useEffect(() => {
    if (open && filters.query.trim()) {
      performSearch();
    } else {
      setResults([]);
    }
  }, [filters, open]);

  const loadFilterOptions = async () => {
    try {
      const response = await api.getAllObjects();
      if (response.success && response.data) {
        const objects = response.data;
        const authors = new Set<string>();
        const nodeTypes = new Set<string>();
        objects.forEach(obj => {
          if (obj.metadata?.author) authors.add(obj.metadata.author);
          obj.zflnJson?.arguments?.forEach((arg: any) => {
            if (arg.zones) {
              arg.zones.forEach((zone: any) => {
                if (zone.nodes) {
                  zone.nodes.forEach((node: any) => {
                    if (node.type) nodeTypes.add(node.type);
                  });
                }
              });
            }
          });
        });
        setAvailableAuthors(Array.from(authors).sort());
        setAvailableNodeTypes(Array.from(nodeTypes).sort());
      }
    } catch (error) {
      console.error('Failed to load filter options:', error);
    }
  };

  const performSearch = async () => {
    if (!filters.query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.getAllObjects();
      const objects = response.success && response.data ? response.data : [];
      const globalResults = performClientSideSearch(objects, filters);
      const merged: SearchResult[] = [...globalResults];

      // Augment with current graph node search if provided
      if (currentNodes && filters.searchIn.includes('nodes')) {
        const q = filters.query.toLowerCase();
        const nodeMatches: SearchResult['matches'] = [];
        currentNodes.forEach(node => {
          if (!node || !node.id) return;
          if (node.id.toLowerCase().includes(q) || (node.name && node.name.toLowerCase().includes(q))) {
            nodeMatches.push({
              type: 'node',
              field: node.name ? 'name' : 'id',
              value: node.name || node.id,
              context: node.name || node.id,
              nodeId: node.id
            });
          }
        });
        if (nodeMatches.length > 0) {
          merged.unshift({
            object: { id: currentObjectId || 'current-graph' } as any,
            matches: nodeMatches,
            score: 1000 + nodeMatches.length
          });
        }
      }

      setResults(merged);
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const performClientSideSearch = (objects: ZLFNObject[], filters: SearchFilters): SearchResult[] => {
    const query = filters.query.toLowerCase();
    const results: SearchResult[] = [];

    objects.forEach(obj => {
      const matches: SearchResult['matches'] = [];
      let score = 0;

      if (filters.author && obj.metadata?.author !== filters.author) return;

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        const objDate = new Date(obj.metadata?.created || 0);
        if (objDate < fromDate) return;
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        const objDate = new Date(obj.metadata?.created || 0);
        if (objDate > toDate) return;
      }

      if (filters.hasNotes !== null) {
        const hasNotes = obj.notes && typeof obj.notes === 'object' && Object.keys(obj.notes).length > 0;
        if (filters.hasNotes !== hasNotes) return;
      }

      if (filters.hasVersions !== null) {
        const hasVersions = obj.versionHistory && obj.versionHistory.length > 1;
        if (filters.hasVersions !== hasVersions) return;
      }

      if (filters.searchIn.includes('content')) {
        if (obj.id?.toLowerCase().includes(query)) {
          matches.push({
            type: 'content',
            field: 'id',
            value: obj.id,
            context: obj.id
          });
          score += 10;
        }
      }

      if (filters.searchIn.includes('notes') && obj.notes) {
        Object.entries(obj.notes).forEach(([nodeId, noteContent]) => {
          if (typeof noteContent === 'string' && noteContent.toLowerCase().includes(query)) {
            const context = extractContext(noteContent, query);
            matches.push({
              type: 'note',
              field: 'content',
              value: noteContent,
              context,
              nodeId
            });
            score += 7;
          }
        });
      }

      if (filters.searchIn.includes('nodes') && obj.zflnJson?.arguments) {
        obj.zflnJson.arguments.forEach((arg: any) => {
          if (arg.zones) {
            arg.zones.forEach((zone: any) => {
              if (zone.nodes) {
                zone.nodes.forEach((node: any) => {
                  if (filters.nodeTypes.length > 0 && !filters.nodeTypes.includes(node.type)) {
                    return;
                  }
                  if (node.name?.toLowerCase().includes(query)) {
                    matches.push({
                      type: 'node',
                      field: 'name',
                      value: node.name,
                      context: node.name,
                      nodeId: node.id
                    });
                    score += 8;
                  }
                  if (node.id.toLowerCase().includes(query)) {
                    matches.push({
                      type: 'node',
                      field: 'id',
                      value: node.id,
                      context: node.id,
                      nodeId: node.id
                    });
                    score += 6;
                  }
                });
              }
            });
          }
        });
      }

      if (filters.searchIn.includes('metadata')) {
        if (obj.metadata?.author?.toLowerCase().includes(query)) {
          matches.push({
            type: 'metadata',
            field: 'author',
            value: obj.metadata.author,
            context: obj.metadata.author
          });
          score += 3;
        }
      }

      if (matches.length > 0) {
        results.push({ object: obj, matches, score });
      }
    });

    return results.sort((a, b) => b.score - a.score);
  };

  const extractContext = (text: string, query: string, contextLength = 100): string => {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text.substring(0, contextLength);
    const start = Math.max(0, index - contextLength / 2);
    const end = Math.min(text.length, index + query.length + contextLength / 2);
    let context = text.substring(start, end);
    if (start > 0) context = '...' + context;
    if (end < text.length) context = context + '...';
    return context;
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getMatchIcon = (type: string) => {
    switch (type) {
      case 'content': return <DocumentIcon fontSize="small" />;
      case 'note': return <NoteIcon fontSize="small" />;
      case 'node': return <NodeIcon fontSize="small" />;
      case 'metadata': return <AuthorIcon fontSize="small" />;
      default: return <SearchIcon fontSize="small" />;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(25, 25, 35, 0.95)',
          border: '1px solid rgba(64, 196, 255, 0.3)',
          borderRadius: 2,
          maxHeight: '90vh'
        }
      }}
    >
      <DialogTitle sx={{ color: '#40c4ff', borderBottom: '1px solid rgba(64, 196, 255, 0.2)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SearchIcon />
          Advanced Search
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Search Input */}
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(64, 196, 255, 0.2)' }}>
          <TextField
            fullWidth
            placeholder="Search across content, notes, nodes, and metadata..."
            value={filters.query}
            onChange={(e) => handleFilterChange('query', e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: '#40c4ff', mr: 1 }} />,
              endAdornment: filters.query && (
                <IconButton size="small" onClick={() => handleFilterChange('query', '')}>
                  <ClearIcon />
                </IconButton>
              )
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: 'rgba(64, 196, 255, 0.05)',
                '& fieldset': { borderColor: 'rgba(64, 196, 255, 0.3)' },
                '&:hover fieldset': { borderColor: 'rgba(64, 196, 255, 0.5)' },
                '&.Mui-focused fieldset': { borderColor: '#40c4ff' }
              },
              '& .MuiInputBase-input': { color: '#e0f2ff' }
            }}
          />
        </Box>

        {/* Filters Toggle */}
        <Box sx={{ p: 1, borderBottom: '1px solid rgba(64, 196, 255, 0.2)' }}>
          <Button
            startIcon={<FilterIcon />}
            endIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowFilters(!showFilters)}
            sx={{ color: '#8ad7ff' }}
          >
            Filters
          </Button>
        </Box>

        {/* Filters Panel */}
        <Collapse in={showFilters}>
          <Box sx={{ p: 2, bgcolor: 'rgba(64, 196, 255, 0.02)' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
              {/* Search In */}
              <FormControl>
                <FormLabel sx={{ color: '#8ad7ff', mb: 1 }}>Search In</FormLabel>
                <FormGroup>
                  {[
                    { key: 'content', label: 'Content & Title' },
                    { key: 'notes', label: 'Notes' },
                    { key: 'nodes', label: 'Nodes' },
                    { key: 'metadata', label: 'Metadata' }
                  ].map(({ key, label }) => (
                    <FormControlLabel
                      key={key}
                      control={
                        <Checkbox
                          checked={filters.searchIn.includes(key as any)}
                          onChange={(e) => {
                            const newSearchIn = e.target.checked
                              ? [...filters.searchIn, key as any]
                              : filters.searchIn.filter(item => item !== key);
                            handleFilterChange('searchIn', newSearchIn);
                          }}
                          sx={{ color: '#40c4ff' }}
                        />
                      }
                      label={label}
                      sx={{ color: '#e0f2ff' }}
                    />
                  ))}
                </FormGroup>
              </FormControl>

              {/* Author */}
              <FormControl>
                <FormLabel sx={{ color: '#8ad7ff', mb: 1 }}>Author</FormLabel>
                <Autocomplete
                  options={availableAuthors}
                  value={filters.author}
                  onChange={(_, value) => handleFilterChange('author', value || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select author"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(64, 196, 255, 0.05)',
                          '& fieldset': { borderColor: 'rgba(64, 196, 255, 0.3)' }
                        }
                      }}
                    />
                  )}
                />
              </FormControl>

              {/* Node Types */}
              <FormControl>
                <FormLabel sx={{ color: '#8ad7ff', mb: 1 }}>Node Types</FormLabel>
                <Autocomplete
                  multiple
                  options={availableNodeTypes}
                  value={filters.nodeTypes}
                  onChange={(_, value) => handleFilterChange('nodeTypes', value)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={option}
                        label={option}
                        size="small"
                        sx={{ bgcolor: 'rgba(64, 196, 255, 0.2)' }}
                      />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder="Select node types"
                      size="small"
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'rgba(64, 196, 255, 0.05)',
                          '& fieldset': { borderColor: 'rgba(64, 196, 255, 0.3)' }
                        }
                      }}
                    />
                  )}
                />
              </FormControl>

              {/* Date Range */}
              <Box>
                <FormLabel sx={{ color: '#8ad7ff', mb: 1, display: 'block' }}>Date Range</FormLabel>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    type="date"
                    size="small"
                    label="From"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    type="date"
                    size="small"
                    label="To"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                </Box>
              </Box>

              {/* Has Notes/Versions */}
              <Box>
                <FormLabel sx={{ color: '#8ad7ff', mb: 1, display: 'block' }}>Content Filters</FormLabel>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={filters.hasNotes === true}
                        indeterminate={filters.hasNotes === null}
                        onChange={(e) => {
                          const value = e.target.checked ? true : filters.hasNotes === true ? false : null;
                          handleFilterChange('hasNotes', value);
                        }}
                        sx={{ color: '#40c4ff' }}
                      />
                    }
                    label="Has Notes"
                    sx={{ color: '#e0f2ff' }}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={filters.hasVersions === true}
                        indeterminate={filters.hasVersions === null}
                        onChange={(e) => {
                          const value = e.target.checked ? true : filters.hasVersions === true ? false : null;
                          handleFilterChange('hasVersions', value);
                        }}
                        sx={{ color: '#40c4ff' }}
                      />
                    }
                    label="Has Version History"
                    sx={{ color: '#e0f2ff' }}
                  />
                </FormGroup>
              </Box>
            </Box>
          </Box>
        </Collapse>

        {/* Results */}
        <Box sx={{ minHeight: 300, maxHeight: 400, overflow: 'auto' }}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress sx={{ color: '#40c4ff' }} />
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ m: 2 }}>
              {error}
            </Alert>
          )}

          {!loading && !error && filters.query && results.length === 0 && (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Typography variant="body2" sx={{ color: '#b0bec5' }}>
                No results found for "{filters.query}"
              </Typography>
            </Box>
          )}

          {!loading && results.length > 0 && (
            <List sx={{ p: 0 }}>
              {results.map((result, index) => (
                <React.Fragment key={result.object.id}>
                  <ListItemButton
                    onClick={() => onSelectResult?.(result.object.id)}
                    sx={{
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      p: 2,
                      '&:hover': { bgcolor: 'rgba(64, 196, 255, 0.05)' }
                    }}
                  >
                    <Box sx={{ width: '100%', mb: 1 }}>
                      <Typography variant="subtitle1" sx={{ color: '#40c4ff', fontWeight: 'bold' }}>
                        {result.object.id === (currentObjectId || 'current-graph') ? 'Current Graph' : result.object.id}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#b0bec5' }}>
                        Score: {result.score} • {result.matches.length} matches
                      </Typography>
                    </Box>

                    {result.matches.slice(0, 5).map((match, matchIndex) => (
                      <Box
                        key={matchIndex}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1,
                          width: '100%',
                          mb: 0.5,
                          cursor: match.nodeId ? 'pointer' : 'default'
                        }}
                        onClick={(e) => {
                          if (match.nodeId) {
                            e.stopPropagation();
                            onSelectResult?.(result.object.id, match.nodeId);
                          }
                        }}
                      >
                        <Box sx={{ color: '#8ad7ff', mt: 0.5 }}>
                          {getMatchIcon(match.type)}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="caption" sx={{ color: '#8ad7ff', textTransform: 'capitalize' }}>
                            {match.type} • {match.field}
                            {match.nodeId && ` • Node: ${match.nodeId}`}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#e0f2ff',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {match.context}
                          </Typography>
                        </Box>
                      </Box>
                    ))}

                    {result.matches.length > 5 && (
                      <Typography variant="caption" sx={{ color: '#b0bec5', mt: 0.5 }}>
                        +{result.matches.length - 5} more matches
                      </Typography>
                    )}
                  </ListItemButton>
                  {index < results.length - 1 && <Divider sx={{ borderColor: 'rgba(64, 196, 255, 0.1)' }} />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(64, 196, 255, 0.2)' }}>
        <Typography variant="caption" sx={{ color: '#b0bec5', flex: 1 }}>
          {results.length > 0 && `${results.length} results found`}
        </Typography>
        <Button onClick={onClose} sx={{ color: '#b0bec5' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
