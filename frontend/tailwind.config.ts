import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#14181F',
        paper: '#FAF9F6',
        signal: {
          DEFAULT: '#2B5D4F',
          dark: '#1E4238',
          light: '#3D7A68',
        },
        brick: {
          DEFAULT: '#C1432E',
          light: '#E0654E',
        },
        line: '#E4E1D8',
        muted: '#6B6459',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'ui-serif', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
      },
    },
  },
  plugins: [],
};
export default config;
