import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Elastic EUI Brand Colors (Dark Theme)
        // @see https://eui.elastic.co/#/theming/color-mode
        'eui': {
          primary: '#0077CC',      // EUI primary blue
          accent: '#00BFB3',       // Elastic teal/accent
          success: '#7DE2B8',      // Success green (dark mode)
          warning: '#FEC514',      // Warning yellow
          danger: '#F66',          // Error red
          text: '#DFE5EF',         // Primary text (dark mode)
          subtext: '#98A2B3',      // Secondary text
          'bg-dark': '#1D1E24',    // Dark background
          'bg-darker': '#141519',  // Darker background
          'bg-subdued': '#25262E', // Subdued background
          border: '#343741',       // Border color (dark mode)
        },
        // EDOT Component Colors
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
        // Telemetry type colors
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
