/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213D",
        bg: "#F7F8FA",
        accent: "#0EA5A4",
        "accent-dark": "#0C8584",
        status: {
          todo: "#94A3B8",
          progress: "#F59E0B",
          done: "#10B981",
          blocked: "#EF4444",
        },
      },
      fontFamily: {
        display: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
