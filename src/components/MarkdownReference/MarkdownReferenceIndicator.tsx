import { useState, useEffect } from 'react';
import {
  Tooltip,
  Box,
  Typography,
  Chip,
  Button
} from '@mui/material';
import {
  Description as DocumentIcon,
  Link as LinkIcon,
  Launch as LaunchIcon
} from '@mui/icons-material';
import { markdownReferenceService, type MarkdownReference } from '../../services/markdownReferenceService';

interface MarkdownReferenceIndicatorProps {
  reference: string;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  onNavigate?: (reference: MarkdownReference) => void;
  className?: string;
}

export default function MarkdownReferenceIndicator({
  reference,
  size = 'medium',
  showLabel = false,
  onNavigate,
  className
}: MarkdownReferenceIndicatorProps) {
  const [resolvedRef, setResolvedRef] = useState<MarkdownReference | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [excerpt, setExcerpt] = useState<string>('');

  useEffect(() => {
    if (reference) {
      loadReference();
    }
  }, [reference]);

  const loadReference = async () => {
    try {
      setLoading(true);
      setError('');
      
      const resolved = await markdownReferenceService.resolveReference(reference);
      if (resolved) {
        setResolvedRef(resolved);
        
        // Load content excerpt
        const contentExcerpt = await markdownReferenceService.getContentExcerpt(reference, 150);
        setExcerpt(contentExcerpt || '');
      } else {
        setError('Reference not found');
      }
    } catch (err) {
      setError('Failed to load reference');
      console.error('Error loading reference:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = () => {
    if (resolvedRef && onNavigate) {
      onNavigate(resolvedRef);
    }
  };

  const getIconSize = () => {
    switch (size) {
      case 'small': return 16;
      case 'large': return 24;
      default: return 20;
    }
  };

  const getTooltipContent = () => {
    if (loading) {
      return <Typography variant="body2">Loading reference...</Typography>;
    }

    if (error) {
      return (
        <Box>
          <Typography variant="body2" color="error" sx={{ mb: 1 }}>
            {error}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Reference: {reference}
          </Typography>
        </Box>
      );
    }

    if (!resolvedRef) {
      return <Typography variant="body2">No reference information</Typography>;
    }

    return (
      <Box sx={{ maxWidth: 300 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <DocumentIcon sx={{ fontSize: 16, color: '#00ffff' }} />
          <Typography variant="subtitle2" sx={{ color: '#00ffff' }}>
            {resolvedRef.documentTitle}
          </Typography>
        </Box>
        
        <Typography variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>
          {resolvedRef.sectionPath}
        </Typography>
        
        {excerpt && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {excerpt}
          </Typography>
        )}
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip 
            label={`Section ${resolvedRef.sectionId}`} 
            size="small" 
            variant="outlined"
            sx={{ fontSize: '0.7rem', height: 20 }}
          />
          {resolvedRef.lineRange && (
            <Chip 
              label={`Lines ${resolvedRef.lineRange.start}-${resolvedRef.lineRange.end}`} 
              size="small" 
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
          )}
        </Box>
        
        {onNavigate && (
          <Button
            size="small"
            startIcon={<LaunchIcon sx={{ fontSize: 14 }} />}
            onClick={handleNavigate}
            sx={{ 
              mt: 1, 
              fontSize: '0.75rem',
              color: '#00ffff',
              '&:hover': {
                backgroundColor: 'rgba(0, 255, 255, 0.1)'
              }
            }}
          >
            View in Document
          </Button>
        )}
      </Box>
    );
  };

  if (!reference) {
    return null;
  }

  const iconColor = error ? '#ff6b6b' : loading ? '#ffaa00' : '#00ffff';

  return (
    <Tooltip
      title={getTooltipContent()}
      placement="top"
      arrow
      componentsProps={{
        tooltip: {
          sx: {
            backgroundColor: 'rgba(26, 26, 46, 0.95)',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            borderRadius: 2,
            backdropFilter: 'blur(10px)',
            maxWidth: 'none'
          }
        },
        arrow: {
          sx: {
            color: 'rgba(26, 26, 46, 0.95)'
          }
        }
      }}
    >
      <Box
        className={className}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: showLabel ? 1 : 0,
          cursor: onNavigate ? 'pointer' : 'default',
          '&:hover': onNavigate ? {
            '& .reference-icon': {
              transform: 'scale(1.1)',
              color: '#00ccff'
            }
          } : {}
        }}
        onClick={onNavigate ? handleNavigate : undefined}
      >
        <Box
          className="reference-icon"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: getIconSize() + 4,
            height: getIconSize() + 4,
            borderRadius: '50%',
            backgroundColor: `${iconColor}20`,
            border: `1px solid ${iconColor}60`,
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <LinkIcon 
            sx={{ 
              fontSize: getIconSize(), 
              color: iconColor,
              transition: 'all 0.2s ease'
            }} 
          />
          
          {loading && (
            <Box
              sx={{
                position: 'absolute',
                top: -2,
                left: -2,
                right: -2,
                bottom: -2,
                borderRadius: '50%',
                border: `2px solid ${iconColor}40`,
                borderTop: `2px solid ${iconColor}`,
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' }
                }
              }}
            />
          )}
        </Box>
        
        {showLabel && resolvedRef && (
          <Typography 
            variant="caption" 
            sx={{ 
              color: iconColor,
              fontSize: size === 'small' ? '0.7rem' : '0.75rem',
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {resolvedRef.sectionTitle}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

// Utility component for displaying multiple references
interface MarkdownReferenceListProps {
  references: string[];
  onNavigate?: (reference: MarkdownReference) => void;
  maxVisible?: number;
}

export function MarkdownReferenceList({
  references,
  onNavigate,
  maxVisible = 3
}: MarkdownReferenceListProps) {
  const [showAll, setShowAll] = useState(false);
  
  if (!references || references.length === 0) {
    return null;
  }

  const visibleRefs = showAll ? references : references.slice(0, maxVisible);
  const hasMore = references.length > maxVisible;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {visibleRefs.map((ref, index) => (
        <MarkdownReferenceIndicator
          key={`${ref}-${index}`}
          reference={ref}
          size="small"
          onNavigate={onNavigate}
        />
      ))}
      
      {hasMore && !showAll && (
        <Button
          size="small"
          onClick={() => setShowAll(true)}
          sx={{ 
            minWidth: 'auto',
            fontSize: '0.7rem',
            color: '#00ffff',
            '&:hover': {
              backgroundColor: 'rgba(0, 255, 255, 0.1)'
            }
          }}
        >
          +{references.length - maxVisible} more
        </Button>
      )}
      
      {showAll && hasMore && (
        <Button
          size="small"
          onClick={() => setShowAll(false)}
          sx={{ 
            minWidth: 'auto',
            fontSize: '0.7rem',
            color: '#00ffff',
            '&:hover': {
              backgroundColor: 'rgba(0, 255, 255, 0.1)'
            }
          }}
        >
          Show less
        </Button>
      )}
    </Box>
  );
}
