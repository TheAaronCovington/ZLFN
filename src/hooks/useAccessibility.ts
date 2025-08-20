import { useEffect, useCallback, useRef } from 'react';

export interface AccessibilityOptions {
  enableKeyboardNavigation?: boolean;
  enableScreenReaderSupport?: boolean;
  enableHighContrast?: boolean;
  enableReducedMotion?: boolean;
  announceChanges?: boolean;
}

export interface AccessibilityState {
  isKeyboardUser: boolean;
  isScreenReaderActive: boolean;
  prefersHighContrast: boolean;
  prefersReducedMotion: boolean;
  currentFocus: string | null;
}

export function useAccessibility(options: AccessibilityOptions = {}) {
  const {
    enableKeyboardNavigation = true,
    enableScreenReaderSupport = true,
    enableHighContrast = true,
    enableReducedMotion = true,
    announceChanges = true
  } = options;

  const announcementRef = useRef<HTMLDivElement | null>(null);
  const focusHistoryRef = useRef<string[]>([]);
  const keyboardUserRef = useRef(false);

  // Create live region for announcements
  useEffect(() => {
    if (!announceChanges || !enableScreenReaderSupport) return;

    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    
    document.body.appendChild(liveRegion);
    announcementRef.current = liveRegion;

    return () => {
      if (liveRegion.parentNode) {
        liveRegion.parentNode.removeChild(liveRegion);
      }
    };
  }, [announceChanges, enableScreenReaderSupport]);

  // Detect keyboard usage
  useEffect(() => {
    if (!enableKeyboardNavigation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        keyboardUserRef.current = true;
        document.body.classList.add('keyboard-user');
      }
    };

    const handleMouseDown = () => {
      keyboardUserRef.current = false;
      document.body.classList.remove('keyboard-user');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [enableKeyboardNavigation]);

  // Focus management
  const manageFocus = useCallback((elementId: string, options?: { 
    preventScroll?: boolean;
    selectText?: boolean;
  }) => {
    const element = document.getElementById(elementId);
    if (!element) return false;

    // Add to focus history
    focusHistoryRef.current.push(elementId);
    if (focusHistoryRef.current.length > 10) {
      focusHistoryRef.current.shift();
    }

    // Focus the element
    element.focus({ preventScroll: options?.preventScroll });

    // Select text if it's an input
    if (options?.selectText && (element as HTMLInputElement).select) {
      (element as HTMLInputElement).select();
    }

    return true;
  }, []);

  // Announce to screen readers
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!announceChanges || !enableScreenReaderSupport || !announcementRef.current) return;

    announcementRef.current.setAttribute('aria-live', priority);
    announcementRef.current.textContent = message;

    // Clear after announcement
    setTimeout(() => {
      if (announcementRef.current) {
        announcementRef.current.textContent = '';
      }
    }, 1000);
  }, [announceChanges, enableScreenReaderSupport]);

  // Skip to content
  const skipToContent = useCallback((contentId: string = 'main-content') => {
    const content = document.getElementById(contentId);
    if (content) {
      content.focus();
      content.scrollIntoView({ behavior: 'smooth', block: 'start' });
      announce('Skipped to main content');
    }
  }, [announce]);

  // Trap focus within an element
  const trapFocus = useCallback((containerId: string) => {
    const container = document.getElementById(containerId);
    if (!container) return () => {};

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    
    // Focus first element
    if (firstElement) {
      firstElement.focus();
    }

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Get accessibility state
  const getAccessibilityState = useCallback((): AccessibilityState => {
    return {
      isKeyboardUser: keyboardUserRef.current,
      isScreenReaderActive: !!window.navigator.userAgent.match(/NVDA|JAWS|VoiceOver|TalkBack/i),
      prefersHighContrast: window.matchMedia('(prefers-contrast: high)').matches,
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      currentFocus: document.activeElement?.id || null
    };
  }, []);

  // Keyboard shortcuts handler
  const handleKeyboardShortcuts = useCallback((
    shortcuts: Record<string, () => void>,
    options?: { preventDefault?: boolean; stopPropagation?: boolean }
  ) => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when focus is in form elements
      const activeElement = document.activeElement;
      if (activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        (activeElement as HTMLElement).contentEditable === 'true'
      )) {
        return;
      }

      const key = e.key.toLowerCase();
      const modifiers = [];
      
      if (e.ctrlKey) modifiers.push('ctrl');
      if (e.altKey) modifiers.push('alt');
      if (e.shiftKey) modifiers.push('shift');
      if (e.metaKey) modifiers.push('meta');

      const shortcutKey = modifiers.length > 0 
        ? `${modifiers.join('+')}+${key}`
        : key;

      if (shortcuts[shortcutKey]) {
        if (options?.preventDefault) e.preventDefault();
        if (options?.stopPropagation) e.stopPropagation();
        shortcuts[shortcutKey]();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Add ARIA attributes to element
  const addAriaAttributes = useCallback((
    elementId: string,
    attributes: Record<string, string | boolean | number>
  ) => {
    const element = document.getElementById(elementId);
    if (!element) return false;

    Object.entries(attributes).forEach(([key, value]) => {
      const ariaKey = key.startsWith('aria-') ? key : `aria-${key}`;
      element.setAttribute(ariaKey, String(value));
    });

    return true;
  }, []);

  // Create accessible description
  const createDescription = useCallback((
    elementId: string,
    description: string,
    options?: { replace?: boolean }
  ) => {
    const element = document.getElementById(elementId);
    if (!element) return null;

    const descId = `${elementId}-description`;
    let descElement = document.getElementById(descId);

    if (!descElement) {
      descElement = document.createElement('div');
      descElement.id = descId;
      descElement.className = 'sr-only';
      descElement.style.position = 'absolute';
      descElement.style.left = '-10000px';
      descElement.style.width = '1px';
      descElement.style.height = '1px';
      descElement.style.overflow = 'hidden';
      
      document.body.appendChild(descElement);
    }

    if (options?.replace) {
      descElement.textContent = description;
    } else {
      descElement.textContent += (descElement.textContent ? ' ' : '') + description;
    }

    // Link to element
    const existingDescribedBy = element.getAttribute('aria-describedby');
    if (!existingDescribedBy?.includes(descId)) {
      element.setAttribute(
        'aria-describedby',
        existingDescribedBy ? `${existingDescribedBy} ${descId}` : descId
      );
    }

    return descId;
  }, []);

  // High contrast mode detection and handling
  useEffect(() => {
    if (!enableHighContrast) return;

    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    
    const handleContrastChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.body.classList.add('high-contrast');
        announce('High contrast mode enabled');
      } else {
        document.body.classList.remove('high-contrast');
      }
    };

    // Initial check
    if (mediaQuery.matches) {
      document.body.classList.add('high-contrast');
    }

    mediaQuery.addEventListener('change', handleContrastChange);
    return () => mediaQuery.removeEventListener('change', handleContrastChange);
  }, [enableHighContrast, announce]);

  // Reduced motion detection and handling
  useEffect(() => {
    if (!enableReducedMotion) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.body.classList.add('reduced-motion');
        announce('Reduced motion enabled');
      } else {
        document.body.classList.remove('reduced-motion');
      }
    };

    // Initial check
    if (mediaQuery.matches) {
      document.body.classList.add('reduced-motion');
    }

    mediaQuery.addEventListener('change', handleMotionChange);
    return () => mediaQuery.removeEventListener('change', handleMotionChange);
  }, [enableReducedMotion, announce]);

  return {
    // State
    getAccessibilityState,
    
    // Focus management
    manageFocus,
    trapFocus,
    skipToContent,
    
    // Announcements
    announce,
    
    // Keyboard handling
    handleKeyboardShortcuts,
    
    // ARIA helpers
    addAriaAttributes,
    createDescription,
    
    // Utilities
    isKeyboardUser: () => keyboardUserRef.current,
    getFocusHistory: () => [...focusHistoryRef.current]
  };
}
