import { useState, useEffect, useCallback } from 'react';

export interface BreakpointConfig {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export type Breakpoint = keyof BreakpointConfig;

export interface ResponsiveLayoutState {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  isTouch: boolean;
}

const defaultBreakpoints: BreakpointConfig = {
  xs: 0,
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1536
};

// Helper function to determine breakpoint (defined outside hook to avoid circular dependency)
const getBreakpointHelper = (width: number, bp: BreakpointConfig): Breakpoint => {
  if (width >= bp.xl) return 'xl';
  if (width >= bp.lg) return 'lg';
  if (width >= bp.md) return 'md';
  if (width >= bp.sm) return 'sm';
  return 'xs';
};

export const useResponsiveLayout = (breakpoints: BreakpointConfig = defaultBreakpoints) => {
  const [layoutState, setLayoutState] = useState<ResponsiveLayoutState>(() => {
    // Initialize with safe defaults for SSR
    if (typeof window === 'undefined') {
      return {
        width: 1200,
        height: 800,
        breakpoint: 'lg' as Breakpoint,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        orientation: 'landscape' as const,
        isTouch: false
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    
    return {
      width,
      height,
      breakpoint: getBreakpointHelper(width, breakpoints),
      isMobile: width < breakpoints.md,
      isTablet: width >= breakpoints.md && width < breakpoints.lg,
      isDesktop: width >= breakpoints.lg,
      orientation: width > height ? 'landscape' : 'portrait',
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0
    };
  });

  const getBreakpoint = useCallback((width: number, bp: BreakpointConfig): Breakpoint => {
    if (width >= bp.xl) return 'xl';
    if (width >= bp.lg) return 'lg';
    if (width >= bp.md) return 'md';
    if (width >= bp.sm) return 'sm';
    return 'xs';
  }, []);

  const updateLayout = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const breakpoint = getBreakpointHelper(width, breakpoints);
    
    setLayoutState({
      width,
      height,
      breakpoint,
      isMobile: width < breakpoints.md,
      isTablet: width >= breakpoints.md && width < breakpoints.lg,
      isDesktop: width >= breakpoints.lg,
      orientation: width > height ? 'landscape' : 'portrait',
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0
    });
  }, [breakpoints, getBreakpoint]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initial update
    updateLayout();

    // Debounced resize handler
    let timeoutId: NodeJS.Timeout;
    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateLayout, 150);
    };

    // Listen for resize and orientation change
    window.addEventListener('resize', debouncedUpdate);
    window.addEventListener('orientationchange', debouncedUpdate);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedUpdate);
      window.removeEventListener('orientationchange', debouncedUpdate);
    };
  }, [updateLayout]);

  // Helper functions for responsive behavior
  const getResponsiveValue = useCallback(<T,>(values: Partial<Record<Breakpoint, T>>, fallback: T): T => {
    const { breakpoint } = layoutState;
    
    // Try current breakpoint first, then fall back to smaller ones
    const breakpointOrder: Breakpoint[] = ['xl', 'lg', 'md', 'sm', 'xs'];
    const currentIndex = breakpointOrder.indexOf(breakpoint);
    
    for (let i = currentIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (values[bp] !== undefined) {
        return values[bp]!;
      }
    }
    
    return fallback;
  }, [layoutState]);

  const isBreakpoint = useCallback((bp: Breakpoint | Breakpoint[]): boolean => {
    const bps = Array.isArray(bp) ? bp : [bp];
    return bps.includes(layoutState.breakpoint);
  }, [layoutState.breakpoint]);

  const isBreakpointUp = useCallback((bp: Breakpoint): boolean => {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];
    const currentIndex = breakpointOrder.indexOf(layoutState.breakpoint);
    const targetIndex = breakpointOrder.indexOf(bp);
    return currentIndex >= targetIndex;
  }, [layoutState.breakpoint]);

  const isBreakpointDown = useCallback((bp: Breakpoint): boolean => {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];
    const currentIndex = breakpointOrder.indexOf(layoutState.breakpoint);
    const targetIndex = breakpointOrder.indexOf(bp);
    return currentIndex <= targetIndex;
  }, [layoutState.breakpoint]);

  // Mobile-specific helpers
  const getMobileLayoutConfig = useCallback(() => {
    const { isMobile, isTablet, width } = layoutState;
    
    return {
      // Toolbar configuration
      toolbarCollapsed: isMobile,
      toolbarPosition: isMobile ? 'bottom' : 'top',
      
      // Graph configuration
      graphPadding: isMobile ? 10 : 20,
      nodeMinSize: isMobile ? 30 : 20,
      nodeMaxSize: isMobile ? 80 : 120,
      
      // Touch targets
      minTouchTarget: 44, // iOS HIG recommendation
      
      // Layout adjustments
      sidebarWidth: isTablet ? 300 : isMobile ? width * 0.8 : 400,
      headerHeight: isMobile ? 56 : 64,
      
      // Performance settings
      maxNodes: isMobile ? 50 : isTablet ? 100 : 200,
      animationDuration: isMobile ? 200 : 300,
      
      // Gesture settings
      panSensitivity: isMobile ? 1.5 : 1.0,
      zoomSensitivity: isMobile ? 1.2 : 1.0,
      
      // Typography
      baseFontSize: isMobile ? 14 : 16,
      
      // Spacing
      spacing: {
        xs: isMobile ? 4 : 8,
        sm: isMobile ? 8 : 16,
        md: isMobile ? 12 : 24,
        lg: isMobile ? 16 : 32,
        xl: isMobile ? 20 : 40
      }
    };
  }, [layoutState]);

  return {
    ...layoutState,
    getResponsiveValue,
    isBreakpoint,
    isBreakpointUp,
    isBreakpointDown,
    getMobileLayoutConfig,
    updateLayout
  };
};
