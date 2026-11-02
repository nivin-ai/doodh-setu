import type { Config } from 'tailwindcss';

// Doodh Setu tokens: ajrakh indigo + marigold on milk-white.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#26347F', dark: '#1B2560', light: '#E9ECF8' },
        marigold: { DEFAULT: '#F4B400', deep: '#C98A00', soft: '#FFF3CF' },
        ink: '#171A26',
        muted: '#5B6275',
        line: '#DCE1EA',
        fill: '#EEF1F6',
        alt: '#F7F8FB',
        milk: '#F3F5F9',
        good: { DEFAULT: '#1F7A4D', light: '#E3F2E9' },
        warn: { DEFAULT: '#8A5A00', light: '#FFF3CF' },
        bad: { DEFAULT: '#B23A2E', light: '#FBE9E6' },
        console: '#1B2560',
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
