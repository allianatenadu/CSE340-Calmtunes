/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4DB6AC',    // Teal
        secondary: '#81C784',  // Light Green  
        accent: '#64B5F6',     // Soft Blue
        background: '#F9FAFB', // Light Gray
        textMain: '#374151'    // Dark Gray
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'breathing': 'breathing 6s ease-in-out infinite',
      },
      keyframes: {
        breathing: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' }
        }
      }
    },
  },
  plugins: [],
}