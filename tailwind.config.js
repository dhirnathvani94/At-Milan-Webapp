/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#fdf2f2', 100: '#fde8e8', 200: '#fbd5d5', 300: '#f8b4b4', 400: '#f38b8b', 500: '#c53030', 600: '#8B1A1A', 700: '#742a2a', 800: '#63171b', 900: '#421a1a', DEFAULT: '#8B1A1A' },
        secondary: { 50: '#fffdf0', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#D4AF37', 500: '#D4AF37', 600: '#b8962e', 700: '#9a7b24', 800: '#7c5f1b', 900: '#5e4311', DEFAULT: '#D4AF37' },
        accent: { DEFAULT: '#FFF8DC', light: '#FFFEF5' },
        dark: '#1a1a2e'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Poppins', 'sans-serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out'
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-10px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } }
      }
    }
  },
  plugins: []
}
