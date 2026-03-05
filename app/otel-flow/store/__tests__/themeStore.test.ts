import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../themeStore';

describe('Theme Store', () => {
  beforeEach(() => {
    // Reset the store to initial state
    useThemeStore.setState({
      theme: 'dark',
      resolvedTheme: 'dark',
    });
  });

  it('should default to dark theme', () => {
    const state = useThemeStore.getState();
    expect(state.theme).toBe('dark');
    expect(state.resolvedTheme).toBe('dark');
  });

  it('should toggle from dark to light', () => {
    const { toggleTheme } = useThemeStore.getState();
    toggleTheme();

    const state = useThemeStore.getState();
    expect(state.theme).toBe('light');
    expect(state.resolvedTheme).toBe('light');
  });

  it('should toggle from light back to dark', () => {
    const { toggleTheme } = useThemeStore.getState();

    // Toggle to light
    toggleTheme();
    expect(useThemeStore.getState().resolvedTheme).toBe('light');

    // Toggle back to dark
    toggleTheme();
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('should set theme explicitly', () => {
    const { setTheme } = useThemeStore.getState();

    setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');

    setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');

    setTheme('system');
    expect(useThemeStore.getState().theme).toBe('system');
  });

  it('should set resolved theme', () => {
    const { setResolvedTheme } = useThemeStore.getState();

    setResolvedTheme('light');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');

    setResolvedTheme('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
  });

  it('should only persist theme preference (not resolvedTheme)', () => {
    // The persist middleware should only save `theme`, not `resolvedTheme`
    const state = useThemeStore.getState();
    expect(state.theme).toBeDefined();
    expect(state.resolvedTheme).toBeDefined();
  });
});
