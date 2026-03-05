'use client';

import { useEffect } from 'react';
import { EuiProvider } from '@elastic/eui';
import createCache from '@emotion/cache';
import { useThemeStore } from './otel-flow/store/themeStore';

// Pre-cache EUI icons to avoid dynamic import failures in Next.js
import './icon-cache';

// Create Emotion cache for Next.js compatibility
// This ensures EUI's Emotion styles are injected properly
const isServer = typeof document === 'undefined';
const euiCache = createCache({
  key: 'eui',
  container: isServer ? undefined : document.head,
});
euiCache.compat = true;

/**
 * EuiClientProvider
 *
 * Wraps the application with EuiProvider for:
 * - EUI component theming (dark/light mode)
 * - Global reset and utility styles
 * - Emotion CSS-in-JS injection
 *
 * Also keeps the html class in sync for Tailwind dark: variants
 * used by canvas-zone components (React Flow nodes/edges).
 */
export function EuiClientProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const { theme, resolvedTheme, setResolvedTheme } = useThemeStore();

  // Keep html class in sync for Tailwind dark: variants on canvas nodes
  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (resolved: 'light' | 'dark'): void => {
      root.classList.remove('light', 'dark');
      root.classList.add(resolved);
      setResolvedTheme(resolved);
    };

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      applyTheme(systemTheme);
    } else {
      applyTheme(theme);
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent): void => {
      if (theme === 'system') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, setResolvedTheme]);

  return (
    <EuiProvider colorMode={resolvedTheme} cache={euiCache}>
      {children}
    </EuiProvider>
  );
}
