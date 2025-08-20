/**
 * Performance Monitoring Hook
 * Tracks rendering performance, memory usage, and optimization metrics
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  memoryUsage: number;
  nodeCount: number;
  edgeCount: number;
  renderTime: number;
  simulationTime: number;
  optimizationLevel: string;
  reductionRatio: number;
}

export interface PerformanceConfig {
  enabled: boolean;
  sampleInterval: number;
  maxSamples: number;
  showOverlay: boolean;
  alertThresholds: {
    lowFPS: number;
    highFrameTime: number;
    highMemoryUsage: number;
  };
}

export function usePerformanceMonitor(config: Partial<PerformanceConfig> = {}) {
  const defaultConfig: PerformanceConfig = {
    enabled: true,
    sampleInterval: 1000, // 1 second
    maxSamples: 60, // Keep 1 minute of data
    showOverlay: false,
    alertThresholds: {
      lowFPS: 30,
      highFrameTime: 33, // ms
      highMemoryUsage: 100 * 1024 * 1024 // 100MB
    }
  };

  // Memoize merged config so identity is stable unless specific config values change
  const finalConfig = useMemo(() => ({
    ...defaultConfig,
    ...config,
    alertThresholds: {
      ...defaultConfig.alertThresholds,
      ...(config.alertThresholds || {})
    }
  }), [
    config.enabled,
    config.sampleInterval,
    config.maxSamples,
    config.showOverlay,
    config.alertThresholds?.lowFPS,
    config.alertThresholds?.highFrameTime,
    config.alertThresholds?.highMemoryUsage
  ]);

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    nodeCount: 0,
    edgeCount: 0,
    renderTime: 0,
    simulationTime: 0,
    optimizationLevel: 'none',
    reductionRatio: 0
  });

  // Keep a synchronous mirror of metrics to compare and avoid redundant state updates
  const metricsMirrorRef = useRef<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    memoryUsage: 0,
    nodeCount: 0,
    edgeCount: 0,
    renderTime: 0,
    simulationTime: 0,
    optimizationLevel: 'none',
    reductionRatio: 0
  })
  useEffect(() => { metricsMirrorRef.current = metrics }, [metrics])

  const updateMetrics = useCallback((partial: Partial<PerformanceMetrics>) => {
    // Only apply updates if something actually changed
    let changed = false
    const current = metricsMirrorRef.current
    for (const k in partial) {
      const key = k as keyof PerformanceMetrics
      if (partial[key] !== current[key]) { changed = true; break }
    }
    if (!changed) return
    setMetrics(prev => ({ ...prev, ...partial }))
  }, [])

  const [history, setHistory] = useState<PerformanceMetrics[]>([]);

  const frameCountRef = useRef(0);
  // Tracks the start of the current FPS sampling window
  const lastSampleTimeRef = useRef(performance.now());
  // Tracks timestamp of the previous animation frame to compute per-frame time
  const lastFrameTsRef = useRef(performance.now());
  const frameTimesRef = useRef<number[]>([]);
  const renderStartTimeRef = useRef(0);
  const simulationStartTimeRef = useRef(0);

  // FPS calculation
  const updateFPS = useCallback(() => {
    const now = performance.now();
    const delta = now - lastSampleTimeRef.current;
    
    if (delta >= finalConfig.sampleInterval) {
      const fps = Math.round((frameCountRef.current * 1000) / delta);
      const avgFrameTime = frameTimesRef.current.length > 0
        ? frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length
        : 0;

      updateMetrics({ fps, frameTime: avgFrameTime });

      // Reset counters
      frameCountRef.current = 0;
      lastSampleTimeRef.current = now;
      frameTimesRef.current = [];
    }
  }, [finalConfig.sampleInterval]);

  // Frame tracking
  const onFrame = useCallback(() => {
    if (!finalConfig.enabled) return;

    const now = performance.now();
    frameCountRef.current++;

    // Compute frame time against the previous frame timestamp, then update
    const frameTime = now - lastFrameTsRef.current;
    lastFrameTsRef.current = now;
    frameTimesRef.current.push(frameTime);
    // Keep only recent frame times
    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }

    updateFPS();
  }, [finalConfig.enabled, updateFPS]);

  // Memory usage tracking
  const updateMemoryUsage = useCallback(() => {
    if (!finalConfig.enabled) return;

    // Use Performance API if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      updateMetrics({ memoryUsage: memory.usedJSHeapSize || 0 });
    }
  }, [finalConfig.enabled]);

  // Render time tracking
  const startRenderTiming = useCallback(() => {
    if (!finalConfig.enabled) return;
    renderStartTimeRef.current = performance.now();
  }, [finalConfig.enabled]);

  const endRenderTiming = useCallback(() => {
    if (!finalConfig.enabled) return;
    const renderTime = performance.now() - renderStartTimeRef.current;
    updateMetrics({ renderTime });
  }, [finalConfig.enabled]);

  // Simulation time tracking
  const startSimulationTiming = useCallback(() => {
    if (!finalConfig.enabled) return;
    simulationStartTimeRef.current = performance.now();
  }, [finalConfig.enabled]);

  const endSimulationTiming = useCallback(() => {
    if (!finalConfig.enabled) return;
    const simulationTime = performance.now() - simulationStartTimeRef.current;
    updateMetrics({ simulationTime });
  }, [finalConfig.enabled]);

  // Update graph metrics
  const updateGraphMetrics = useCallback((
    nodeCount: number,
    edgeCount: number,
    optimizationLevel: string,
    reductionRatio: number
  ) => {
    if (!finalConfig.enabled) return;
    
    updateMetrics({ nodeCount, edgeCount, optimizationLevel, reductionRatio });
  }, [finalConfig.enabled]);

  // Compute alerts from metrics and thresholds (no state updates)
  const alerts = useMemo(() => {
    if (!finalConfig.enabled) return [] as string[];
    const list: string[] = [];
    if (metrics.fps > 0 && metrics.fps < finalConfig.alertThresholds.lowFPS) {
      list.push(`Low FPS: ${metrics.fps}`);
    }
    if (metrics.frameTime > finalConfig.alertThresholds.highFrameTime) {
      list.push(`High frame time: ${metrics.frameTime.toFixed(1)}ms`);
    }
    if (metrics.memoryUsage > finalConfig.alertThresholds.highMemoryUsage) {
      list.push(`High memory usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB`);
    }
    return list;
  }, [finalConfig.enabled, finalConfig.alertThresholds.lowFPS, finalConfig.alertThresholds.highFrameTime, finalConfig.alertThresholds.highMemoryUsage, metrics.fps, metrics.frameTime, metrics.memoryUsage]);

  // Keep latest metrics in a ref so history interval doesn't recreate on every metrics change
  const metricsRef = useRef(metrics);
  useEffect(() => { metricsRef.current = metrics; }, [metrics]);

  // History tracking (depend on config and updater only)
  useEffect(() => {
    if (!finalConfig.enabled) return;

    const interval = setInterval(() => {
      setHistory(prev => {
        const newHistory = [...prev, { ...metricsRef.current }];
        return newHistory.slice(-finalConfig.maxSamples);
      });
      updateMemoryUsage();
    }, finalConfig.sampleInterval);

    return () => clearInterval(interval);
  }, [finalConfig.enabled, finalConfig.sampleInterval, finalConfig.maxSamples, updateMemoryUsage]);

  // Animation frame tracking
  useEffect(() => {
    if (!finalConfig.enabled) return;

    let animationId: number;
    
    const tick = () => {
      onFrame();
      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [finalConfig.enabled, onFrame]);

  // Performance summary
  const getPerformanceSummary = useCallback(() => {
    const avgFPS = history.length > 0
      ? history.reduce((sum, m) => sum + m.fps, 0) / history.length
      : metrics.fps;

    const avgFrameTime = history.length > 0
      ? history.reduce((sum, m) => sum + m.frameTime, 0) / history.length
      : metrics.frameTime;

    const maxMemoryUsage = history.length > 0
      ? Math.max(...history.map(m => m.memoryUsage))
      : metrics.memoryUsage;

    return {
      current: metrics,
      averages: {
        fps: Math.round(avgFPS),
        frameTime: Math.round(avgFrameTime * 100) / 100,
        memoryUsage: maxMemoryUsage
      },
      alerts: alerts.length,
      isPerformant: avgFPS >= finalConfig.alertThresholds.lowFPS && 
                   avgFrameTime <= finalConfig.alertThresholds.highFrameTime
    };
  }, [metrics, history, alerts, finalConfig]);

  // Reset metrics
  const reset = useCallback(() => {
    setMetrics({
      fps: 0,
      frameTime: 0,
      memoryUsage: 0,
      nodeCount: 0,
      edgeCount: 0,
      renderTime: 0,
      simulationTime: 0,
      optimizationLevel: 'none',
      reductionRatio: 0
    });
    setHistory([]);
    // alerts are computed via useMemo
    frameCountRef.current = 0;
    lastSampleTimeRef.current = performance.now();
    lastFrameTsRef.current = performance.now();
    frameTimesRef.current = [];
  }, []);

  return {
    metrics,
    history,
    alerts,
    summary: getPerformanceSummary(),
    
    // Timing functions
    startRenderTiming,
    endRenderTiming,
    startSimulationTiming,
    endSimulationTiming,
    
    // Update functions
    updateGraphMetrics,
    
    // Utility functions
    reset,
    
    // Configuration
    config: finalConfig
  };
}
