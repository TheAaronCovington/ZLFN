import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  FormGroup,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import CodeIcon from '@mui/icons-material/Code';
import ImageIcon from '@mui/icons-material/Image';

export interface ExportOptions {
  format: 'json' | 'pdf' | 'docx' | 'svg' | 'png' | 'markdown';
  includeNotes: boolean;
  includeVersionHistory: boolean;
  includeLayout: boolean;
  includeMetadata: boolean;
  quality?: 'low' | 'medium' | 'high';
  pageSize?: 'A4' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
}

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => Promise<void>;
  objectTitle?: string;
  loading?: boolean;
}

const formatOptions = [
  { value: 'json', label: 'JSON', icon: <CodeIcon />, description: 'Complete data structure' },
  { value: 'pdf', label: 'PDF', icon: <PictureAsPdfIcon />, description: 'Printable document' },
  { value: 'docx', label: 'Word Document', icon: <DescriptionIcon />, description: 'Microsoft Word format' },
  { value: 'svg', label: 'SVG', icon: <ImageIcon />, description: 'Scalable vector graphics' },
  { value: 'png', label: 'PNG Image', icon: <ImageIcon />, description: 'High-quality image' },
  { value: 'markdown', label: 'Markdown', icon: <DescriptionIcon />, description: 'Text-based format' }
];

export default function ExportDialog({ open, onClose, onExport, objectTitle, loading = false }: ExportDialogProps) {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'json',
    includeNotes: true,
    includeVersionHistory: false,
    includeLayout: true,
    includeMetadata: true,
    quality: 'high',
    pageSize: 'A4',
    orientation: 'landscape'
  });

  const handleFormatChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setOptions(prev => ({ ...prev, format: event.target.value as ExportOptions['format'] }));
  };

  const handleOptionChange = (key: keyof ExportOptions) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setOptions(prev => ({ ...prev, [key]: event.target.checked }));
  };

  const handleSelectChange = (key: keyof ExportOptions) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setOptions(prev => ({ ...prev, [key]: event.target.value }));
  };

  const handleExport = async () => {
    try {
      await onExport(options);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const isImageFormat = options.format === 'svg' || options.format === 'png';
  const isPrintFormat = options.format === 'pdf' || options.format === 'docx';

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'rgba(25, 25, 35, 0.95)',
          border: '1px solid rgba(64, 196, 255, 0.3)',
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ color: '#40c4ff', borderBottom: '1px solid rgba(64, 196, 255, 0.2)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon />
          Export {objectTitle || 'Object'}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Format Selection */}
        <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
          <FormLabel component="legend" sx={{ color: '#8ad7ff', mb: 1 }}>
            Export Format
          </FormLabel>
          <RadioGroup
            value={options.format}
            onChange={handleFormatChange}
            sx={{ gap: 1 }}
          >
            {formatOptions.map((format) => (
              <FormControlLabel
                key={format.value}
                value={format.value}
                control={<Radio sx={{ color: '#40c4ff' }} />}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {format.icon}
                    <Box>
                      <Typography variant="body2" sx={{ color: '#e0f2ff' }}>
                        {format.label}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#b0bec5' }}>
                        {format.description}
                      </Typography>
                    </Box>
                  </Box>
                }
                sx={{ 
                  border: '1px solid rgba(64, 196, 255, 0.2)',
                  borderRadius: 1,
                  m: 0,
                  p: 1,
                  '&:hover': {
                    bgcolor: 'rgba(64, 196, 255, 0.05)'
                  }
                }}
              />
            ))}
          </RadioGroup>
        </FormControl>

        <Divider sx={{ my: 2, borderColor: 'rgba(64, 196, 255, 0.2)' }} />

        {/* Content Options */}
        <FormControl component="fieldset" fullWidth sx={{ mb: 3 }}>
          <FormLabel component="legend" sx={{ color: '#8ad7ff', mb: 1 }}>
            Include Content
          </FormLabel>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.includeNotes}
                  onChange={handleOptionChange('includeNotes')}
                  sx={{ color: '#40c4ff' }}
                />
              }
              label="Notes and annotations"
              sx={{ color: '#e0f2ff' }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.includeVersionHistory}
                  onChange={handleOptionChange('includeVersionHistory')}
                  sx={{ color: '#40c4ff' }}
                />
              }
              label="Version history"
              sx={{ color: '#e0f2ff' }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.includeLayout}
                  onChange={handleOptionChange('includeLayout')}
                  disabled={options.format === 'markdown'}
                  sx={{ color: '#40c4ff' }}
                />
              }
              label="Layout and positioning"
              sx={{ color: '#e0f2ff' }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.includeMetadata}
                  onChange={handleOptionChange('includeMetadata')}
                  sx={{ color: '#40c4ff' }}
                />
              }
              label="Metadata and timestamps"
              sx={{ color: '#e0f2ff' }}
            />
          </FormGroup>
        </FormControl>

        {/* Format-specific options */}
        {isImageFormat && (
          <>
            <Divider sx={{ my: 2, borderColor: 'rgba(64, 196, 255, 0.2)' }} />
            <FormControl component="fieldset" fullWidth sx={{ mb: 2 }}>
              <FormLabel component="legend" sx={{ color: '#8ad7ff', mb: 1 }}>
                Image Quality
              </FormLabel>
              <RadioGroup
                value={options.quality}
                onChange={handleSelectChange('quality')}
                row
              >
                <FormControlLabel value="low" control={<Radio sx={{ color: '#40c4ff' }} />} label="Low" sx={{ color: '#e0f2ff' }} />
                <FormControlLabel value="medium" control={<Radio sx={{ color: '#40c4ff' }} />} label="Medium" sx={{ color: '#e0f2ff' }} />
                <FormControlLabel value="high" control={<Radio sx={{ color: '#40c4ff' }} />} label="High" sx={{ color: '#e0f2ff' }} />
              </RadioGroup>
            </FormControl>
          </>
        )}

        {isPrintFormat && (
          <>
            <Divider sx={{ my: 2, borderColor: 'rgba(64, 196, 255, 0.2)' }} />
            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
              <FormControl component="fieldset" sx={{ flex: 1 }}>
                <FormLabel component="legend" sx={{ color: '#8ad7ff', mb: 1 }}>
                  Page Size
                </FormLabel>
                <RadioGroup
                  value={options.pageSize}
                  onChange={handleSelectChange('pageSize')}
                >
                  <FormControlLabel value="A4" control={<Radio sx={{ color: '#40c4ff' }} />} label="A4" sx={{ color: '#e0f2ff' }} />
                  <FormControlLabel value="Letter" control={<Radio sx={{ color: '#40c4ff' }} />} label="Letter" sx={{ color: '#e0f2ff' }} />
                  <FormControlLabel value="Legal" control={<Radio sx={{ color: '#40c4ff' }} />} label="Legal" sx={{ color: '#e0f2ff' }} />
                </RadioGroup>
              </FormControl>
              
              <FormControl component="fieldset" sx={{ flex: 1 }}>
                <FormLabel component="legend" sx={{ color: '#8ad7ff', mb: 1 }}>
                  Orientation
                </FormLabel>
                <RadioGroup
                  value={options.orientation}
                  onChange={handleSelectChange('orientation')}
                >
                  <FormControlLabel value="portrait" control={<Radio sx={{ color: '#40c4ff' }} />} label="Portrait" sx={{ color: '#e0f2ff' }} />
                  <FormControlLabel value="landscape" control={<Radio sx={{ color: '#40c4ff' }} />} label="Landscape" sx={{ color: '#e0f2ff' }} />
                </RadioGroup>
              </FormControl>
            </Box>
          </>
        )}

        {loading && (
          <Alert 
            severity="info" 
            icon={<CircularProgress size={20} />}
            sx={{ 
              bgcolor: 'rgba(64, 196, 255, 0.1)',
              border: '1px solid rgba(64, 196, 255, 0.3)',
              color: '#e0f2ff'
            }}
          >
            Preparing export...
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, borderTop: '1px solid rgba(64, 196, 255, 0.2)' }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          sx={{ color: '#b0bec5' }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleExport}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <DownloadIcon />}
          sx={{
            bgcolor: '#40c4ff',
            '&:hover': { bgcolor: '#29b6f6' }
          }}
        >
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
}
