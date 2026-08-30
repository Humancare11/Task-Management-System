/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#14213D",
        bg: "#F7F8FA",
        accent: "#0EA5A4",
        "accent-dark": "#0C8584",
        primary: {
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
        },
        status: {
          todo: "#94A3B8",
          progress: "#F59E0B",
          done: "#10B981",
          blocked: "#EF4444",
        },
        // TMS theme tokens — resolve to CSS variables in index.css
        // so a single `.dark` class on <html> flips the whole app.
        page: "var(--page)",
        rail: "var(--rail)",
        surface: {
          1: "var(--surface-1)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
        },
        hair: "var(--hair)",
        txt: {
          primary: "var(--txt-primary)",
          muted: "var(--txt-muted)",
        },
        // Brand accent reads acceptably on both themes — kept static.
        accentblue: {
          DEFAULT: "#4f8ef7",
          hover: "#3f7de6",
          soft: "rgba(79,142,247,0.16)",
          icon: "#4f8ef7",
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
