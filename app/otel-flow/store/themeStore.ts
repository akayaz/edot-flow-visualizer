import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeStore {
  // State
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  
  // Actions
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setResolvedTheme: (resolved: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: 'dark', // Default to dark mode
      resolvedTheme: 'dark',
      
      setTheme: (theme) => {
        set({ theme });
      },
      
      toggleTheme: () => {
        const current = get().resolvedTheme;
        const newTheme = current === 'dark' ? 'light' : 'dark';
        set({ theme: newTheme, resolvedTheme: newTheme });
      },
      
      setResolvedTheme: (resolved) => {
        set({ resolvedTheme: resolved });
      },
    }),
    {
      name: 'edot-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);
