/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--color-surface)",
        card: "var(--color-card)",
        border: "var(--color-border)",
        muted: "var(--color-muted)",
        accent: "var(--color-accent)",
        primary: "var(--color-primary)",
        "primary-deep": "var(--color-primary-deep)",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        bento: "1.25rem",
      },
      boxShadow: {
        bento: "0 25px 50px -12px rgb(15 23 42 / 0.08)",
      },
      animation: {
        "grid-shift": "grid-shift 28s linear infinite",
        "diagonal-shift": "diagonal-shift 32s linear infinite",
      },
      keyframes: {
        "grid-shift": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(-4%, -2%)" },
        },
        "diagonal-shift": {
          "0%, 100%": { transform: "translate(0, 0) rotate(0deg)" },
          "50%": { transform: "translate(2%, 3%) rotate(1deg)" },
        },
      },
    },
  },
  plugins: [],
};
