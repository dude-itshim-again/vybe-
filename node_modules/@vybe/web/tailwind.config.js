/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#070709',
          card: '#0e0f14',
          border: 'rgba(255, 255, 255, 0.08)',
          hover: 'rgba(255, 255, 255, 0.12)',
          muted: '#8e8e9a',
          purple: '#a855f7',
          cyan: '#06b6d4',
          pink: '#ec4899',
          amber: '#f59e0b',
          emerald: '#10b981',
          rose: '#f43f5e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        editorial: ['"Instrument Serif"', '"Playfair Display"', 'Georgia', 'serif'],
        instrument: ['"Instrument Serif"', 'Georgia', 'serif'],
        anton: ['Anton', 'sans-serif'],
        archivo: ['"Archivo Black"', 'sans-serif'],
        fraunces: ['Fraunces', 'serif'],
        vibes: ['"Great Vibes"', 'cursive'],
        playfair: ['"Playfair Display"', 'serif'],
        syne: ['Syne', 'sans-serif'],
      },
      boxShadow: {
        'glow-purple': '0 0 25px -5px rgba(168, 85, 247, 0.4)',
        'glow-cyan': '0 0 25px -5px rgba(6, 182, 212, 0.4)',
        'glow-bass': '0 0 35px calc(var(--bass-energy, 0) * 20px) rgba(168, 85, 247, calc(var(--bass-energy, 0) * 0.7 + 0.1))',
      }
    },
  },
  plugins: [],
}
