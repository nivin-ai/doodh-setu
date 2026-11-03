import type { Config } from 'tailwindcss';

// Doodh Setu tokens: dairy blue + butter yellow on milk-white, with pasture green for good news.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0B5CAD', dark: '#084785', light: '#E6F0FA' },
        marigold: { DEFAULT: '#F2BE2C', deep: '#B4860F', soft: '#FFF5D6' },
        ink: '#122030',
        muted: '#55657A',
        line: '#D9E3EE',
        fill: '#EDF3F9',
        alt: '#F7FAFD',
        milk: '#F4F8FC',
        good: { DEFAULT: '#14804A', light: '#E1F3E9' },
        warn: { DEFAULT: '#8A5A00', light: '#FFF5D6' },
        bad: { DEFAULT: '#B23A2E', light: '#FBE9E6' },
        console: '#084785',
      },
      fontFamily: {
        // Mukta covers Latin, Devanagari and Gujarati; Noto Sans fills the other scripts glyph by glyph
        sans: ['"Mukta Vaani"', 'Mukta', '"Noto Sans Bengali"', '"Noto Sans Telugu"', '"Noto Sans Tamil"', '"Noto Sans Kannada"', '"Noto Sans Malayalam"', '"Noto Sans Oriya"', 'system-ui', 'sans-serif'],
        // Baloo has a sister family per script, so amounts and headings keep one voice in every language
        display: ['"Baloo Bhai 2"', '"Baloo 2"', '"Baloo Da 2"', '"Baloo Tammudu 2"', '"Baloo Thambi 2"', '"Baloo Tamma 2"', '"Baloo Chettan 2"', '"Baloo Bhaina 2"', '"Mukta Vaani"', 'system-ui', 'sans-serif'],
      },
      borderRadius: { sheet: '18px' },
      keyframes: {
        'view-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(24px)' }, to: { opacity: '1', transform: 'none' } },
        'toast-in': { from: { opacity: '0', transform: 'translate(-50%, 12px)' }, to: { opacity: '1', transform: 'translate(-50%, 0)' } },
        pop: { '0%': { transform: 'scale(.96)', opacity: '.6' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        eq: { '0%,100%': { transform: 'scaleY(.35)' }, '50%': { transform: 'scaleY(1)' } },
        draw: { to: { strokeDashoffset: '0' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
      },
      animation: {
        'view-in': 'view-in 240ms cubic-bezier(.2,.7,.2,1) both',
        'slide-in': 'slide-in 260ms cubic-bezier(.2,.7,.2,1) both',
        'toast-in': 'toast-in 220ms cubic-bezier(.2,.7,.2,1) both',
        pop: 'pop 200ms ease-out both',
        eq: 'eq 900ms ease-in-out infinite',
        draw: 'draw 420ms ease-out 80ms forwards',
      },
    },
  },
  plugins: [],
};
export default config;
