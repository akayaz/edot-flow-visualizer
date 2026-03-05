import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Kept for React Flow node dark: variants
  theme: {
    extend: {
      colors: {
        // EDOT Component Colors — Canvas zone only
        'edot-sdk': {
          nodejs: '#22c55e',
          python: '#eab308',
          java: '#f97316',
          dotnet: '#6366f1',
          go: '#06b6d4',
        },
        'edot-collector': {
          agent: '#06b6d4',
          gateway: '#ec4899',
        },
        'edot-elastic': {
          primary: '#00bfb3',
          secondary: '#0077cc',
        },
        // Telemetry type colors — Canvas zone particles
        telemetry: {
          traces: '#f59e0b',
          metrics: '#3b82f6',
          logs: '#10b981',
        },
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'flow-particle': 'flow-particle 2s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
      },
      backgroundImage: {
        'elastic-gradient': 'linear-gradient(135deg, #00bfb3 0%, #0077cc 100%)',
        'grid-pattern': 'radial-gradient(circle, #374151 1px, transparent 1px)',
      },
    },
  },
  plugins: [],
};

export default config;
