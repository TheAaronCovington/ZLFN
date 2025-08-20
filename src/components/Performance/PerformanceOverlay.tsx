import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  Chip,
  LinearProgress,
  Tooltip
} from '@mui/material';
import {
  Speed as PerformanceIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Memory as MemoryIcon,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import type { PerformanceMetrics } from '../../hooks/usePerformanceMonitor';

interface PerformanceOverlayProps {
  metrics: PerformanceMetrics;
  alerts: string[];
  summary: {
    current: PerformanceMetrics;
    averages: {
      fps: number;
      frameTime: number;
      memoryUsage: number;
    };
    alerts: number;
    isPerformant: boolean;
  };
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
}

export default function PerformanceOverlay({
  metrics,
  alerts,
  summary,
  position = 'top-right',
  compact = false
}: PerformanceOverlayProps) {
  const [expanded, setExpanded] = useState(false);

  const getPositionStyles = () => {
    const base = {
      position: 'fixed' as const,
      zIndex: 9999,
      minWidth: compact ? 200 : 280
    };

    switch (position) {
      case 'top-left':
        return { ...base, top: 16, left: 16 };
      case 'top-right':
        return { ...base, top: 16, right: 16 };
      case 'bottom-left':
        return { ...base, bottom: 16, left: 16 };
      case 'bottom-right':
        return { ...base, bottom: 16, right: 16 };
      default:
        return { ...base, top: 16, right: 16 };
    }
  };

  const getFPSColor = (fps: number) => {
    if (fps >= 50) return '#4caf50';
    if (fps >= 30) return '#ff9800';
    return '#f44336';
  };

  const getMemoryColor = (usage: number) => {
    const mb = usage / (1024 * 1024);
    if (mb < 50) return '#4caf50';
    if (mb < 100) return '#ff9800';
    return '#f44336';
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const formatTime = (ms: number) => {
    return `${ms.toFixed(1)}ms`;
  };

  return (
    <Paper
      sx={{
        ...getPositionStyles(),
        background: 'linear-gradient(135deg, rgba(26, 26, 46, 0.95) 0%, rgba(22, 33, 62, 0.95) 100%)',
        border: '1px solid rgba(0, 255, 255, 0.3)',
        borderRadius: 2,
        backdropFilter: 'blur(10px)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          borderBottom: expanded ? '1px solid rgba(0, 255, 255, 0.2)' : 'none',
          cursor: 'pointer'
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PerformanceIcon sx={{ color: '#00ffff', fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ color: '#00ffff', fontWeight: 'bold' }}>
            Performance
          </Typography>
          {summary.isPerformant ? (
            <CheckIcon sx={{ color: '#4caf50', fontSize: 16 }} />
          ) : (
            <WarningIcon sx={{ color: '#ff9800', fontSize: 16 }} />
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={`${metrics.fps} FPS`}
            size="small"
            sx={{
              backgroundColor: `${getFPSColor(metrics.fps)}20`,
              color: getFPSColor(metrics.fps),
              border: `1px solid ${getFPSColor(metrics.fps)}60`,
              fontSize: '0.7rem',
              height: 20
            }}
          />
          <IconButton size="small" sx={{ color: '#00ffff' }}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Expanded Content */}
      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          {/* Alerts */}
          {alerts.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ color: '#ff9800', fontWeight: 'bold', mb: 1, display: 'block' }}>
                Performance Alerts
              </Typography>
              {alerts.map((alert, index) => (
                <Chip
                  key={index}
                  label={alert}
                  size="small"
                  icon={<WarningIcon />}
                  sx={{
                    backgroundColor: 'rgba(255, 152, 0, 0.2)',
                    color: '#ff9800',
                    border: '1px solid rgba(255, 152, 0, 0.6)',
                    fontSize: '0.7rem',
                    height: 24,
                    mb: 0.5,
                    mr: 0.5
                  }}
                />
              ))}
            </Box>
          )}

          {/* Metrics Layout */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Top Row - FPS and Memory */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* FPS & Frame Time */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#00ffff', fontWeight: 'bold' }}>
                  Frame Rate
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Typography variant="h6" sx={{ color: getFPSColor(metrics.fps), fontWeight: 'bold' }}>
                    {metrics.fps}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    FPS
                  </Typography>
                </Box>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {formatTime(metrics.frameTime)} frame time
                </Typography>
              </Box>

              {/* Memory Usage */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#00ffff', fontWeight: 'bold' }}>
                  Memory
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <MemoryIcon sx={{ color: getMemoryColor(metrics.memoryUsage), fontSize: 16 }} />
                  <Typography variant="body2" sx={{ color: getMemoryColor(metrics.memoryUsage), fontWeight: 'bold' }}>
                    {formatBytes(metrics.memoryUsage)}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Second Row - Graph Size and Optimization */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              {/* Graph Metrics */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#00ffff', fontWeight: 'bold' }}>
                  Graph Size
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.primary', mt: 0.5 }}>
                  {metrics.nodeCount} nodes
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {metrics.edgeCount} edges
                </Typography>
              </Box>

              {/* Optimization */}
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: '#00ffff', fontWeight: 'bold' }}>
                  Optimization
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={metrics.optimizationLevel}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(0, 255, 255, 0.2)',
                      color: '#00ffff',
                      border: '1px solid rgba(0, 255, 255, 0.6)',
                      fontSize: '0.7rem',
                      height: 20,
                      mb: 0.5
                    }}
                  />
                  {metrics.reductionRatio > 0 && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                      {(metrics.reductionRatio * 100).toFixed(1)}% reduced
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Render Performance */}
            <Box>
              <Typography variant="caption" sx={{ color: '#00ffff', fontWeight: 'bold', mb: 1, display: 'block' }}>
                Render Performance
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Tooltip title="Time spent rendering each frame">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TimelineIcon sx={{ fontSize: 14, color: '#4caf50' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Render: {formatTime(metrics.renderTime)}
                    </Typography>
                  </Box>
                </Tooltip>
                <Tooltip title="Time spent in physics simulation">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TimelineIcon sx={{ fontSize: 14, color: '#ff9800' }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      Sim: {formatTime(metrics.simulationTime)}
                    </Typography>
                  </Box>
                </Tooltip>
              </Box>
            </Box>

            {/* Performance Bar */}
            <Box>
              <Typography variant="caption" sx={{ color: '#00ffff', fontWeight: 'bold', mb: 1, display: 'block' }}>
                Overall Performance
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (metrics.fps / 60) * 100)}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: getFPSColor(metrics.fps),
                    borderRadius: 3
                  }
                }}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                {summary.isPerformant ? 'Optimal performance' : 'Performance issues detected'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
}
