/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: '2rem',
    },
    extend: {
      colors: {
        'bamika-red': '#CE1126',   // Placeholder for logo Red
        'bamika-green': '#007A33', // Placeholder for logo Green
        primary: {
          DEFAULT: '#CE1126',      // Using Bamika Red as Primary
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#007A33',      // Using Bamika Green as Secondary
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#EF4444', // red-500
          foreground: '#FFFFFF',
        },
        muted: {
          DEFAULT: '#F4F4F5', // zinc-100
          foreground: '#71717A', // zinc-500
        },
        accent: {
          DEFAULT: '#007A33',      // Green accent
          foreground: '#FFFFFF',
        },
      }
    },
  },
  plugins: [],
};
