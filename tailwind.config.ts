import type { Config } from 'tailwindcss';

/**
 * Milk & Honey Wigs aesthetic: neutral, luxury but operational.
 * Soft beige/cream accents, lots of white space, clear status colours.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBF8F3',
        sand: '#F3EDE3',
        beige: '#E9DFCE',
        honey: '#C9A15C',
        ink: '#2B2622',
        muted: '#8A8178',
        // status colours
        status: {
          new: '#3B82F6',
          production: '#8B5CF6',
          payment: '#D97706',
          balance: '#B45309',
          blocked: '#DC2626',
          risk: '#DC2626',
          qc: '#0891B2',
          ready: '#059669',
          done: '#4B5563',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(43, 38, 34, 0.06), 0 1px 2px rgba(43, 38, 34, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
