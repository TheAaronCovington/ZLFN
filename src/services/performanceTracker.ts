import React from 'react';

/**
 * Frontend Performance Tracking Service
 * Phase 6.3: Frontend performance monitoring and optimization
 */

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface ComponentMetric {
  componentName: string;
  renderTime: number;
  propsSize: number;
  timestamp: number;
}

interface NetworkMetric {
  url: string;
  method: string;
  duration: number;
  size: number;
  status: number;
  timestamp: number;
}

class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private componentMetrics: ComponentMetric[] = [];
  private networkMetrics: NetworkMetric[] = [];
  private observers: PerformanceObserver[] = [];
  private isEnabled: boolean = true;

  constructor() {
    this.initializeObservers();
    this.trackPageLoad();
  }

  /**
   * Initialize performance observers
   */
  private initializeObservers() {
    if (typeof window === 'undefined') return;

    try {
      // Long Task Observer
      if ('PerformanceObserver' in window) {
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('long-task', entry.duration, {
              startTime: entry.startTime,
              name: entry.name
            });
          }
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });
        this.observers.push(longTaskObserver);

        // Layout Shift Observer
        const layoutShiftObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('layout-shift', (entry as any).value, {
              hadRecentInput: (entry as any).hadRecentInput,
              sources: (entry as any).sources
            });
          }
        });
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(layoutShiftObserver);

        // Largest Contentful Paint Observer
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          this.recordMetric('largest-contentful-paint', lastEntry.startTime, {
            element: (lastEntry as any).element?.tagName,
            url: (lastEntry as any).url
          });
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);

        // First Input Delay Observer
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordMetric('first-input-delay', (entry as any).processingStart - entry.startTime, {
              name: entry.name,
              startTime: entry.startTime
            });
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      }
    } catch (error) {
      console.warn('Performance observers not supported:', error);
    }
  }

  /**
   * Track page load performance
   */
  private trackPageLoad() {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          this.recordMetric('page-load-time', navigation.loadEventEnd - navigation.fetchStart);
          this.recordMetric('dom-content-loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
          this.recordMetric('first-byte', navigation.responseStart - navigation.fetchStart);
          this.recordMetric('dom-interactive', navigation.domInteractive - navigation.fetchStart);
        }

        // Core Web Vitals
        this.measureCoreWebVitals();
      }, 0);
    });
  }

  /**
   * Measure Core Web Vitals
   */
  private measureCoreWebVitals() {
    // First Contentful Paint
    const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
    if (fcpEntry) {
      this.recordMetric('first-contentful-paint', fcpEntry.startTime);
    }

    // Time to Interactive (approximation)
    const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigationEntry) {
      const tti = navigationEntry.domInteractive - navigationEntry.fetchStart;
      this.recordMetric('time-to-interactive', tti);
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    if (!this.isEnabled) return;

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };

    this.metrics.push(metric);

    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.splice(0, this.metrics.length - 1000);
    }

    // Log slow operations
    if (this.isSlowMetric(name, value)) {
      console.warn(`Slow performance detected: ${name} = ${value.toFixed(2)}ms`, metadata);
    }
  }

  /**
   * Track React component render performance
   */
  trackComponentRender(componentName: string, renderTime: number, propsSize: number = 0) {
    if (!this.isEnabled) return;

    const metric: ComponentMetric = {
      componentName,
      renderTime,
      propsSize,
      timestamp: Date.now()
    };

    this.componentMetrics.push(metric);

    // Keep only last 500 component metrics
    if (this.componentMetrics.length > 500) {
      this.componentMetrics.splice(0, this.componentMetrics.length - 500);
    }

    // Warn about slow renders
    if (renderTime > 16) { // 60fps threshold
      console.warn(`Slow component render: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }
  }

  /**
   * Track network requests
   */
  trackNetworkRequest(url: string, method: string, duration: number, size: number, status: number) {
    if (!this.isEnabled) return;

    const metric: NetworkMetric = {
      url,
      method,
      duration,
      size,
      status,
      timestamp: Date.now()
    };

    this.networkMetrics.push(metric);

    // Keep only last 200 network metrics
    if (this.networkMetrics.length > 200) {
      this.networkMetrics.splice(0, this.networkMetrics.length - 200);
    }

    // Warn about slow requests
    if (duration > 1000) {
      console.warn(`Slow network request: ${method} ${url} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Start timing an operation
   */
  startTiming(operationName: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(operationName, duration);
    };
  }

  /**
   * Measure function execution time
   */
  measureFunction<T>(name: string, fn: () => T): T {
    const startTime = performance.now();
    const result = fn();
    const duration = performance.now() - startTime;
    
    this.recordMetric(`function-${name}`, duration);
    return result;
  }

  /**
   * Measure async function execution time
   */
  async measureAsyncFunction<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now();
    const result = await fn();
    const duration = performance.now() - startTime;
    
    this.recordMetric(`async-function-${name}`, duration);
    return result;
  }

  /**
   * Get performance statistics
   */
  getStats(timeWindow: number = 5 * 60 * 1000) { // Default 5 minutes
    const now = Date.now();
    const cutoff = now - timeWindow;

    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    const recentComponents = this.componentMetrics.filter(m => m.timestamp > cutoff);
    const recentNetwork = this.networkMetrics.filter(m => m.timestamp > cutoff);

    return {
      general: this.analyzeMetrics(recentMetrics),
      components: this.analyzeComponentMetrics(recentComponents),
      network: this.analyzeNetworkMetrics(recentNetwork),
      coreWebVitals: this.getCoreWebVitals(),
      memoryUsage: this.getMemoryUsage(),
      timeWindow
    };
  }

  /**
   * Analyze general performance metrics
   */
  private analyzeMetrics(metrics: PerformanceMetric[]) {
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    const analysis: Record<string, any> = {};

    for (const [name, values] of Object.entries(grouped)) {
      if (values.length > 0) {
        analysis[name] = {
          count: values.length,
          average: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          p95: this.percentile(values, 95),
          p99: this.percentile(values, 99)
        };
      }
    }

    return analysis;
  }

  /**
   * Analyze component render metrics
   */
  private analyzeComponentMetrics(metrics: ComponentMetric[]) {
    const grouped = metrics.reduce((acc, metric) => {
      if (!acc[metric.componentName]) {
        acc[metric.componentName] = [];
      }
      acc[metric.componentName].push(metric.renderTime);
      return acc;
    }, {} as Record<string, number[]>);

    const analysis: Record<string, any> = {};

    for (const [name, renderTimes] of Object.entries(grouped)) {
      if (renderTimes.length > 0) {
        analysis[name] = {
          renders: renderTimes.length,
          averageRenderTime: renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length,
          slowRenders: renderTimes.filter(t => t > 16).length,
          maxRenderTime: Math.max(...renderTimes)
        };
      }
    }

    return analysis;
  }

  /**
   * Analyze network request metrics
   */
  private analyzeNetworkMetrics(metrics: NetworkMetric[]) {
    const totalRequests = metrics.length;
    const totalSize = metrics.reduce((sum, m) => sum + m.size, 0);
    const averageDuration = metrics.length > 0 
      ? metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length 
      : 0;

    const statusCodes = metrics.reduce((acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      totalRequests,
      totalSize,
      averageDuration,
      slowRequests: metrics.filter(m => m.duration > 1000).length,
      statusCodes
    };
  }

  /**
   * Get Core Web Vitals
   */
  private getCoreWebVitals() {
    const cwv: Record<string, number | undefined> = {};

    // Get latest values for each CWV metric
    const lcpMetrics = this.metrics.filter(m => m.name === 'largest-contentful-paint');
    if (lcpMetrics.length > 0) {
      cwv.lcp = lcpMetrics[lcpMetrics.length - 1].value;
    }

    const fidMetrics = this.metrics.filter(m => m.name === 'first-input-delay');
    if (fidMetrics.length > 0) {
      cwv.fid = Math.max(...fidMetrics.map(m => m.value));
    }

    const clsMetrics = this.metrics.filter(m => m.name === 'layout-shift');
    if (clsMetrics.length > 0) {
      cwv.cls = clsMetrics.reduce((sum, m) => sum + m.value, 0);
    }

    return cwv;
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage() {
    if (typeof window === 'undefined' || !(performance as any).memory) {
      return null;
    }

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usedPercent: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Check if a metric indicates slow performance
   */
  private isSlowMetric(name: string, value: number): boolean {
    const thresholds: Record<string, number> = {
      'page-load-time': 3000,
      'first-contentful-paint': 1800,
      'largest-contentful-paint': 2500,
      'first-input-delay': 100,
      'long-task': 50,
      'layout-shift': 0.1
    };

    return thresholds[name] ? value > thresholds[name] : false;
  }

  /**
   * Enable or disable tracking
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = [];
    this.componentMetrics = [];
    this.networkMetrics = [];
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics() {
    return {
      metrics: this.metrics,
      componentMetrics: this.componentMetrics,
      networkMetrics: this.networkMetrics,
      timestamp: Date.now()
    };
  }

  /**
   * Clean up observers
   */
  destroy() {
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Error disconnecting performance observer:', error);
      }
    });
    this.observers = [];
  }
}

// Singleton instance
export const performanceTracker = new PerformanceTracker();

/**
 * React Hook for component performance tracking
 */
export function usePerformanceTracking(componentName: string) {
  const startTime = performance.now();

  React.useEffect(() => {
    const renderTime = performance.now() - startTime;
    performanceTracker.trackComponentRender(componentName, renderTime);
  });

  return {
    trackRender: (customName?: string) => {
      const renderTime = performance.now() - startTime;
      performanceTracker.trackComponentRender(customName || componentName, renderTime);
    }
  };
}

/**
 * Higher-order component for performance tracking
 */
export function withPerformanceTracking<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const displayName = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';

  const TrackedComponent = React.forwardRef<any, P>((props, ref) => {
    const startTime = performance.now();

    React.useEffect(() => {
      const renderTime = performance.now() - startTime;
      performanceTracker.trackComponentRender(displayName, renderTime, JSON.stringify(props).length);
    });

    const componentProps = { ...props } as any;
    if (ref) {
      componentProps.ref = ref;
    }
    
    return React.createElement(WrappedComponent, componentProps);
  });

  TrackedComponent.displayName = `withPerformanceTracking(${displayName})`;
  return TrackedComponent;
}

export default performanceTracker;
