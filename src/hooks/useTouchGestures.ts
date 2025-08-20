import { useRef, useCallback, useEffect } from 'react';

interface TouchGestureOptions {
  onPinch?: (scale: number, center: { x: number; y: number }) => void;
  onPan?: (delta: { x: number; y: number }, center: { x: number; y: number }) => void;
  onTap?: (point: { x: number; y: number }) => void;
  onDoubleTap?: (point: { x: number; y: number }) => void;
  onLongPress?: (point: { x: number; y: number }) => void;
  onTouchStart?: (touches: TouchList) => void;
  onTouchEnd?: (touches: TouchList) => void;
  longPressDelay?: number;
  doubleTapDelay?: number;
  panThreshold?: number;
  pinchThreshold?: number;
}

interface TouchState {
  touches: Touch[];
  initialDistance: number;
  initialCenter: { x: number; y: number };
  lastCenter: { x: number; y: number };
  startTime: number;
  lastTapTime: number;
  longPressTimer: NodeJS.Timeout | null;
  isPinching: boolean;
  isPanning: boolean;
}

export const useTouchGestures = (options: TouchGestureOptions = {}) => {
  const {
    onPinch,
    onPan,
    onTap,
    onDoubleTap,
    onLongPress,
    onTouchStart,
    onTouchEnd,
    longPressDelay = 500,
    doubleTapDelay = 300,
    panThreshold = 10,
    pinchThreshold = 0.1
  } = options;

  const stateRef = useRef<TouchState>({
    touches: [],
    initialDistance: 0,
    initialCenter: { x: 0, y: 0 },
    lastCenter: { x: 0, y: 0 },
    startTime: 0,
    lastTapTime: 0,
    longPressTimer: null,
    isPinching: false,
    isPanning: false
  });

  const getDistance = useCallback((touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getCenter = useCallback((touches: TouchList): { x: number; y: number } => {
    let x = 0;
    let y = 0;
    for (let i = 0; i < touches.length; i++) {
      x += touches[i].clientX;
      y += touches[i].clientY;
    }
    return {
      x: x / touches.length,
      y: y / touches.length
    };
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (stateRef.current.longPressTimer) {
      clearTimeout(stateRef.current.longPressTimer);
      stateRef.current.longPressTimer = null;
    }
  }, []);

  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touches = event.touches;
    const state = stateRef.current;
    
    // Clear any existing long press timer
    clearLongPressTimer();
    
    // Update state
    state.touches = Array.from(touches);
    state.startTime = Date.now();
    state.isPinching = false;
    state.isPanning = false;
    
    if (touches.length === 1) {
      // Single touch - potential tap, long press, or pan start
      const touch = touches[0];
      state.initialCenter = { x: touch.clientX, y: touch.clientY };
      state.lastCenter = { x: touch.clientX, y: touch.clientY };
      
      // Start long press timer
      state.longPressTimer = setTimeout(() => {
        if (onLongPress && !state.isPanning) {
          onLongPress({ x: touch.clientX, y: touch.clientY });
        }
      }, longPressDelay);
      
    } else if (touches.length === 2) {
      // Two touches - potential pinch
      const center = getCenter(touches);
      const distance = getDistance(touches[0], touches[1]);
      
      state.initialCenter = center;
      state.lastCenter = center;
      state.initialDistance = distance;
      state.isPinching = true;
    }
    
    onTouchStart?.(touches);
  }, [onTouchStart, onLongPress, longPressDelay, getCenter, getDistance, clearLongPressTimer]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    event.preventDefault(); // Prevent scrolling
    
    const touches = event.touches;
    const state = stateRef.current;
    
    if (touches.length === 1 && !state.isPinching) {
      // Single touch movement - panning
      const touch = touches[0];
      const currentCenter = { x: touch.clientX, y: touch.clientY };
      
      const dx = currentCenter.x - state.initialCenter.x;
      const dy = currentCenter.y - state.initialCenter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > panThreshold && !state.isPanning) {
        // Start panning
        state.isPanning = true;
        clearLongPressTimer();
      }
      
      if (state.isPanning && onPan) {
        const delta = {
          x: currentCenter.x - state.lastCenter.x,
          y: currentCenter.y - state.lastCenter.y
        };
        onPan(delta, currentCenter);
      }
      
      state.lastCenter = currentCenter;
      
    } else if (touches.length === 2 && state.isPinching) {
      // Two touch movement - pinching
      const center = getCenter(touches);
      const distance = getDistance(touches[0], touches[1]);
      
      if (state.initialDistance > 0) {
        const scale = distance / state.initialDistance;
        const scaleChange = Math.abs(scale - 1);
        
        if (scaleChange > pinchThreshold && onPinch) {
          onPinch(scale, center);
        }
      }
      
      // Update for panning during pinch
      if (onPan) {
        const delta = {
          x: center.x - state.lastCenter.x,
          y: center.y - state.lastCenter.y
        };
        onPan(delta, center);
      }
      
      state.lastCenter = center;
    }
  }, [onPan, onPinch, panThreshold, pinchThreshold, getCenter, getDistance, clearLongPressTimer]);

  const handleTouchEnd = useCallback((event: TouchEvent) => {
    const touches = event.touches;
    const state = stateRef.current;
    const endTime = Date.now();
    const duration = endTime - state.startTime;
    
    // Clear long press timer
    clearLongPressTimer();
    
    if (touches.length === 0) {
      // All touches ended
      if (!state.isPanning && !state.isPinching && duration < 300) {
        // Quick tap
        const timeSinceLastTap = endTime - state.lastTapTime;
        
        if (timeSinceLastTap < doubleTapDelay && onDoubleTap) {
          // Double tap
          onDoubleTap(state.initialCenter);
          state.lastTapTime = 0; // Reset to prevent triple tap
        } else {
          // Single tap
          if (onTap) {
            onTap(state.initialCenter);
          }
          state.lastTapTime = endTime;
        }
      }
      
      // Reset state
      state.isPinching = false;
      state.isPanning = false;
      state.touches = [];
    }
    
    onTouchEnd?.(touches);
  }, [onTap, onDoubleTap, onTouchEnd, doubleTapDelay, clearLongPressTimer]);

  const attachToElement = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    
    // Add touch event listeners
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    
    // Return cleanup function
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  return {
    attachToElement,
    isGesturing: stateRef.current.isPanning || stateRef.current.isPinching
  };
};
