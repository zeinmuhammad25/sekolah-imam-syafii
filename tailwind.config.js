/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0B3D2E', // Emerald deep
          light: '#14513C',
        },
        secondary: {
          DEFAULT: '#9A7B1C', // Gold (deep — aman untuk teks di atas ivory)
          light: '#C9A227',   // Gold (terang — untuk latar gelap / garis aksen)
        },
        accent: {
          DEFAULT: '#9A7B1C', // alias emas: menjaga pemakaian `accent` lama tetap selaras
          light: '#C9A227',
        },
        ivory: '#FAF7F0',
        forest: '#07271D',
        ink: '#1A1A1A',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        '3xl': '0 35px 60px -15px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}
