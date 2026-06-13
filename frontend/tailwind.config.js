/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Manrope', 'ui-sans-serif', 'sans-serif']
      },
      boxShadow: {
        soft: '18px 18px 42px rgba(0, 0, 0, 0.42), -10px -10px 30px rgba(255, 255, 255, 0.035)',
        insetSoft: 'inset 8px 8px 18px rgba(0, 0, 0, 0.34), inset -8px -8px 18px rgba(255, 255, 255, 0.035)',
        glow: '0 0 34px rgba(125, 211, 252, 0.18)'
      }
    }
  },
  plugins: []
};
