/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        electric: {
          50:  'rgba(0,212,255,0.05)',
          100: 'rgba(0,212,255,0.1)',
          200: 'rgba(0,212,255,0.2)',
          300: '#67e8f9',
          400: '#00d4ff',
          500: '#00b8d9',
          600: '#0090a8',
        },
        surface: {
          DEFAULT: '#080d16',
          raised: '#0c1220',
          border: 'rgba(0,212,255,0.12)',
          hover: 'rgba(0,212,255,0.06)',
        },
      },
      boxShadow: {
        'electric':    '0 0 24px rgba(0,212,255,0.12), 0 0 48px rgba(0,212,255,0.04)',
        'electric-lg': '0 0 40px rgba(0,212,255,0.2),  0 0 80px rgba(0,212,255,0.06)',
        'electric-sm': '0 0 12px rgba(0,212,255,0.18)',
      },
      backgroundImage: {
        'electric-radial': 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(0,212,255,0.08) 0%, transparent 70%)',
      },
    },
  },
  plugins: [],
}
