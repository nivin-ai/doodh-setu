import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1F5FA8', light: '#E6EEF8' },
        ink: '#2C2C2A', muted: '#6B6A65', line: '#B9B7AE',
        fill: '#F1EFE8', alt: '#FAFAF8',
        good: { DEFAULT: '#2E7D4F', light: '#E3F2E8' },
        warn: { DEFAULT: '#B26B00', light: '#FDF1DC' },
        bad: { DEFAULT: '#B3261E', light: '#FCE8E6' },
        console: '#1F3A5F',
      },
      fontFamily: { sans: ['var(--font-latin)', 'var(--font-gu)', 'var(--font-hi)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
