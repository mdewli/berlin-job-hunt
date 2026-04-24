/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        gold: {
          muted: '#D4AF37',
          soft:  '#FFBF00',
          dim:   '#A88B28',
        },
      },
      boxShadow: {
        'card-hover': '0 10px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,175,55,0.15)',
        'glass':      '0 4px 24px rgba(0,0,0,0.4)',
        'drawer':     '-20px 0 60px rgba(0,0,0,0.6)',
      },
    },
  },
  plugins: [],
}
