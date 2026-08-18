/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      colors: {
        primary: {
          50: '#f6f0fb',
          100: '#eee0f7',
          200: '#dcc2ef',
          300: '#c5a3f0',
          400: '#b183e8',
          500: '#9b5de5',
          600: '#8347d1',
          700: '#6b37ab',
          800: '#542b86',
          900: '#3d1f61'
        },
        surface: '#f2e9f8',
        sidebar: {
          DEFAULT: '#201c2b',
          header: '#241f2f',
          bubble: '#2c273a',
          border: '#322c40',
          borderLight: '#3a3348'
        }
      }
    }
  },
  plugins: []
};
