import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Toolbar,
  Typography,
  Divider,
  Switch,
  FormControlLabel,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Visibility as PreviewIcon,
  ViewColumn as SplitIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Sync as SyncIcon
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
// Note: react-syntax-highlighter would need to be installed
// For now, using a simple code component
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownPreviewProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: number | string;
  readOnly?: boolean;
  showToolbar?: boolean;
  enableSync?: boolean;
  className?: string;
}

type ViewMode = 'edit' | 'preview' | 'split';

export default function MarkdownPreview({
  value,
  onChange,
  placeholder = 'Enter markdown content...',
  height = 400,
  readOnly = false,
  showToolbar = true,
  enableSync = true,
  className
}: MarkdownPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [syncScroll, setSyncScroll] = useState(true);
  // Scroll tracking for sync (currently unused but kept for future enhancement)
  // const [editScrollTop, setEditScrollTop] = useState(0);
  // const [previewScrollTop, setPreviewScrollTop] = useState(0);

  const editorRef = React.useRef<HTMLTextAreaElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);

  const handleViewModeChange = (_: React.SyntheticEvent, newMode: ViewMode) => {
    setViewMode(newMode);
  };

  const handleFullscreenToggle = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleEditorScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    if (!syncScroll || !enableSync) return;
    
    const editor = event.currentTarget;
    const scrollPercentage = editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    
    if (previewRef.current) {
      const previewScrollTop = scrollPercentage * (previewRef.current.scrollHeight - previewRef.current.clientHeight);
      previewRef.current.scrollTop = previewScrollTop;
    }
    
    // setEditScrollTop(editor.scrollTop);
  };

  const handlePreviewScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll || !enableSync) return;
    
    const preview = event.currentTarget;
    const scrollPercentage = preview.scrollTop / (preview.scrollHeight - preview.clientHeight);
    
    if (editorRef.current) {
      const editorScrollTop = scrollPercentage * (editorRef.current.scrollHeight - editorRef.current.clientHeight);
      editorRef.current.scrollTop = editorScrollTop;
    }
    
    // setPreviewScrollTop(preview.scrollTop);
  };

  const markdownComponents = useMemo(() => ({
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <Box
          component="pre"
          sx={{
            bgcolor: 'rgba(0, 0, 0, 0.3)',
            p: 2,
            borderRadius: 1,
            overflow: 'auto',
            border: '1px solid rgba(64, 196, 255, 0.2)'
          }}
          {...props}
        >
          <code className={className} style={{ color: '#e0f2ff' }}>
            {String(children).replace(/\n$/, '')}
          </code>
        </Box>
      ) : (
        <code 
          className={className} 
          style={{ 
            bgcolor: 'rgba(64, 196, 255, 0.1)', 
            padding: '2px 4px', 
            borderRadius: '3px',
            color: '#40c4ff'
          }} 
          {...props}
        >
          {children}
        </code>
      );
    },
    h1: ({ children, ...props }: any) => (
      <Typography variant="h3" component="h1" sx={{ color: '#40c4ff', mb: 2, mt: 3 }} {...props}>
        {children}
      </Typography>
    ),
    h2: ({ children, ...props }: any) => (
      <Typography variant="h4" component="h2" sx={{ color: '#8ad7ff', mb: 1.5, mt: 2.5 }} {...props}>
        {children}
      </Typography>
    ),
    h3: ({ children, ...props }: any) => (
      <Typography variant="h5" component="h3" sx={{ color: '#b3e5fc', mb: 1, mt: 2 }} {...props}>
        {children}
      </Typography>
    ),
    p: ({ children, ...props }: any) => (
      <Typography variant="body1" sx={{ color: '#e0f2ff', mb: 1.5, lineHeight: 1.7 }} {...props}>
        {children}
      </Typography>
    ),
    blockquote: ({ children, ...props }: any) => (
      <Box
        component="blockquote"
        sx={{
          borderLeft: '4px solid #40c4ff',
          pl: 2,
          py: 1,
          my: 2,
          bgcolor: 'rgba(64, 196, 255, 0.05)',
          fontStyle: 'italic',
          color: '#b3e5fc'
        }}
        {...props}
      >
        {children}
      </Box>
    ),
    ul: ({ children, ...props }: any) => (
      <Box component="ul" sx={{ color: '#e0f2ff', pl: 2, mb: 1.5 }} {...props}>
        {children}
      </Box>
    ),
    ol: ({ children, ...props }: any) => (
      <Box component="ol" sx={{ color: '#e0f2ff', pl: 2, mb: 1.5 }} {...props}>
        {children}
      </Box>
    ),
    li: ({ children, ...props }: any) => (
      <Box component="li" sx={{ mb: 0.5 }} {...props}>
        {children}
      </Box>
    ),
    table: ({ children, ...props }: any) => (
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid rgba(64, 196, 255, 0.3)',
          mb: 2,
          '& th, & td': {
            border: '1px solid rgba(64, 196, 255, 0.2)',
            p: 1,
            textAlign: 'left'
          },
          '& th': {
            bgcolor: 'rgba(64, 196, 255, 0.1)',
            color: '#40c4ff',
            fontWeight: 'bold'
          },
          '& td': {
            color: '#e0f2ff'
          }
        }}
        {...props}
      >
        {children}
      </Box>
    ),
    a: ({ children, href, ...props }: any) => (
      <Box
        component="a"
        href={href}
        sx={{
          color: '#40c4ff',
          textDecoration: 'none',
          '&:hover': {
            textDecoration: 'underline',
            color: '#29b6f6'
          }
        }}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </Box>
    )
  }), []);

  const containerHeight = isFullscreen ? '100vh' : height;
  const contentHeight = showToolbar ? `calc(${containerHeight}px - 48px)` : `${containerHeight}px`;

  return (
    <Paper
      className={className}
      sx={{
        height: containerHeight,
        bgcolor: 'rgba(25, 25, 35, 0.95)',
        border: '1px solid rgba(64, 196, 255, 0.3)',
        borderRadius: isFullscreen ? 0 : 2,
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 'auto',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {showToolbar && (
        <>
          <Toolbar
            variant="dense"
            sx={{
              minHeight: 48,
              bgcolor: 'rgba(64, 196, 255, 0.1)',
              borderBottom: '1px solid rgba(64, 196, 255, 0.2)'
            }}
          >
            <Tabs
              value={viewMode}
              onChange={handleViewModeChange}
              sx={{
                minHeight: 32,
                '& .MuiTab-root': {
                  minHeight: 32,
                  color: '#b0bec5',
                  '&.Mui-selected': {
                    color: '#40c4ff'
                  }
                }
              }}
            >
              <Tab
                value="edit"
                icon={<EditIcon />}
                label="Edit"
                iconPosition="start"
                disabled={readOnly}
              />
              <Tab
                value="split"
                icon={<SplitIcon />}
                label="Split"
                iconPosition="start"
              />
              <Tab
                value="preview"
                icon={<PreviewIcon />}
                label="Preview"
                iconPosition="start"
              />
            </Tabs>

            <Box sx={{ flexGrow: 1 }} />

            {enableSync && viewMode === 'split' && (
              <FormControlLabel
                control={
                  <Switch
                    checked={syncScroll}
                    onChange={(e) => setSyncScroll(e.target.checked)}
                    size="small"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#40c4ff'
                      }
                    }}
                  />
                }
                label={
                  <Tooltip title="Synchronize scrolling between editor and preview">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <SyncIcon fontSize="small" />
                      <Typography variant="caption" sx={{ color: '#b0bec5' }}>
                        Sync
                      </Typography>
                    </Box>
                  </Tooltip>
                }
                sx={{ mr: 1 }}
              />
            )}

            <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
              <IconButton
                size="small"
                onClick={handleFullscreenToggle}
                sx={{ color: '#b0bec5' }}
              >
                {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Tooltip>
          </Toolbar>
          <Divider sx={{ borderColor: 'rgba(64, 196, 255, 0.2)' }} />
        </>
      )}

      <Box
        sx={{
          height: contentHeight,
          display: 'flex',
          overflow: 'hidden'
        }}
      >
        {/* Editor */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <Box
            sx={{
              width: viewMode === 'split' ? '50%' : '100%',
              height: '100%',
              borderRight: viewMode === 'split' ? '1px solid rgba(64, 196, 255, 0.2)' : 'none'
            }}
          >
            <Box
              component="textarea"
              ref={editorRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onScroll={handleEditorScroll}
              placeholder={placeholder}
              readOnly={readOnly}
              sx={{
                width: '100%',
                height: '100%',
                border: 'none',
                outline: 'none',
                resize: 'none',
                p: 2,
                bgcolor: 'transparent',
                color: '#e0f2ff',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: 14,
                lineHeight: 1.5,
                '&::placeholder': {
                  color: '#666'
                },
                '&::-webkit-scrollbar': {
                  width: 8
                },
                '&::-webkit-scrollbar-track': {
                  bgcolor: 'rgba(64, 196, 255, 0.1)'
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: 'rgba(64, 196, 255, 0.3)',
                  borderRadius: 4,
                  '&:hover': {
                    bgcolor: 'rgba(64, 196, 255, 0.5)'
                  }
                }
              }}
            />
          </Box>
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <Box
            ref={previewRef}
            onScroll={handlePreviewScroll}
            sx={{
              width: viewMode === 'split' ? '50%' : '100%',
              height: '100%',
              overflow: 'auto',
              p: 2,
              '&::-webkit-scrollbar': {
                width: 8
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'rgba(64, 196, 255, 0.1)'
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'rgba(64, 196, 255, 0.3)',
                borderRadius: 4,
                '&:hover': {
                  bgcolor: 'rgba(64, 196, 255, 0.5)'
                }
              }
            }}
          >
            {value ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex, rehypeHighlight, rehypeRaw]}
                components={markdownComponents}
              >
                {value}
              </ReactMarkdown>
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: '#666',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  mt: 4
                }}
              >
                Nothing to preview
              </Typography>
            )}
          </Box>
        )}
      </Box>
    </Paper>
  );
}
