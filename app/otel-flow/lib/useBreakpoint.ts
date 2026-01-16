'use client';

import { useState, useEffect } from 'react';

export type Breakpoint = 'sm' | 'md' | 'lg';

interface BreakpointConfig {
  sm: number;
  md: number;
  lg: number;
}

const BREAKPOINTS: BreakpointConfig = {
  sm: 1366,
  md: 1920,
  lg: 2560,
};

/**
 * Custom hook to detect current viewport breakpoint
 * 
 * @returns Current breakpoint and helper booleans
 */
export function useBreakpoint(): {
  breakpoint: Breakpoint;
  isSmall: boolean;
  isMedium: boolean;
  isLarge: boolean;
  width: number;
} {
  const [width, setWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : BREAKPOINTS.md
  );

  useEffect(() => {
    const handleResize = (): void => {
      setWidth(window.innerWidth);
    };

    // Set initial width
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const breakpoint: Breakpoint = 
    width < BREAKPOINTS.sm ? 'sm' : 
    width < BREAKPOINTS.md ? 'md' : 
    'lg';

  return {
    breakpoint,
    isSmall: width < BREAKPOINTS.sm,
    isMedium: width >= BREAKPOINTS.sm && width < BREAKPOINTS.md,
    isLarge: width >= BREAKPOINTS.md,
    width,
  };
}
