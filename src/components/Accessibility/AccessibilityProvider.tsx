import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAccessibility, type AccessibilityOptions, type AccessibilityState } from '../../hooks/useAccessibility';

interface AccessibilityContextValue {
  // State
  accessibilityState: AccessibilityState;
  
  // Focus management
  manageFocus: (elementId: string, options?: { preventScroll?: boolean; selectText?: boolean }) => boolean;
  trapFocus: (containerId: string) => () => void;
  skipToContent: (contentId?: string) => void;
  
  // Announcements
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  
  // Keyboard handling
  handleKeyboardShortcuts: (
    shortcuts: Record<string, () => void>,
    options?: { preventDefault?: boolean; stopPropagation?: boolean }
  ) => () => void;
  
  // ARIA helpers
  addAriaAttributes: (elementId: string, attributes: Record<string, string | boolean | number>) => boolean;
  createDescription: (elementId: string, description: string, options?: { replace?: boolean }) => string | null;
  
  // Utilities
  isKeyboardUser: () => boolean;
  getFocusHistory: () => string[];
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

export function useAccessibilityContext() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibilityContext must be used within AccessibilityProvider');
  }
  return context;
}

interface AccessibilityProviderProps {
  children: React.ReactNode;
  options?: AccessibilityOptions;
}

export function AccessibilityProvider({ children, options }: AccessibilityProviderProps) {
  const accessibility = useAccessibility(options);
  const [accessibilityState, setAccessibilityState] = useState<AccessibilityState>(() => {
    // Initialize state lazily to prevent multiple calls during render
    return {
      isKeyboardUser: false,
      isScreenReaderActive: false,
      prefersHighContrast: false,
      prefersReducedMotion: false,
      currentFocus: null
    };
  });

  // Update accessibility state periodically
  useEffect(() => {
    const updateState = () => {
      const newState = accessibility.getAccessibilityState();
      setAccessibilityState(prevState => {
        // Only update if state actually changed
        if (
          prevState.isKeyboardUser !== newState.isKeyboardUser ||
          prevState.isScreenReaderActive !== newState.isScreenReaderActive ||
          prevState.prefersHighContrast !== newState.prefersHighContrast ||
          prevState.prefersReducedMotion !== newState.prefersReducedMotion ||
          prevState.currentFocus !== newState.currentFocus
        ) {
          return newState;
        }
        return prevState;
      });
    };

    // Update on focus changes
    const handleFocusChange = () => {
      updateState();
    };

    // Update on media query changes
    const highContrastQuery = window.matchMedia('(prefers-contrast: high)');
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleMediaChange = () => {
      updateState();
    };

    document.addEventListener('focusin', handleFocusChange);
    document.addEventListener('focusout', handleFocusChange);
    highContrastQuery.addEventListener('change', handleMediaChange);
    reducedMotionQuery.addEventListener('change', handleMediaChange);

    // Initial update
    updateState();

    return () => {
      document.removeEventListener('focusin', handleFocusChange);
      document.removeEventListener('focusout', handleFocusChange);
      highContrastQuery.removeEventListener('change', handleMediaChange);
      reducedMotionQuery.removeEventListener('change', handleMediaChange);
    };
  }, []); // Remove accessibility dependency to prevent infinite loop

  const contextValue: AccessibilityContextValue = {
    accessibilityState,
    manageFocus: accessibility.manageFocus,
    trapFocus: accessibility.trapFocus,
    skipToContent: accessibility.skipToContent,
    announce: accessibility.announce,
    handleKeyboardShortcuts: accessibility.handleKeyboardShortcuts,
    addAriaAttributes: accessibility.addAriaAttributes,
    createDescription: accessibility.createDescription,
    isKeyboardUser: accessibility.isKeyboardUser,
    getFocusHistory: accessibility.getFocusHistory,
  };

  return (
    <AccessibilityContext.Provider value={contextValue}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export default AccessibilityProvider;
