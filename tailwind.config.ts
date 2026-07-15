import type { Config } from "tailwindcss";

/**
 * ElaBela brand system.
 * Base palette from the official "Manual de Marca" (CRM canvas):
 *   Chocolate #71453f · Nude Glow #D6AB99 · Cream #fcebdb · Light Nude #dec2ad
 *   Rose Nude #dbb09f · Terra #c18468 · Brown #8b6357
 * Extended into a premium warm-dark ("espresso") system for the app shell.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Core brand
        chocolate: {
          DEFAULT: "#71453f",
          50: "#f7efec",
          100: "#ecd9d1",
          200: "#d9b3a6",
          300: "#c18d7b",
          400: "#a06a58",
          500: "#71453f",
          600: "#5c3833",
          700: "#472b27",
          800: "#33201d",
          900: "#221513",
          950: "#160d0c",
        },
        nude: {
          DEFAULT: "#D6AB99",
          light: "#dec2ad",
          rose: "#dbb09f",
        },
        terra: "#c18468",
        brownie: "#8b6357",
        cream: "#fcebdb",
        // Semantic surfaces for the dark shell (warm espresso, not neutral gray)
        espresso: {
          DEFAULT: "#160d0c",
          soft: "#1e1311",
          card: "#241715",
          border: "#3a2622",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(214,171,153,0.12), 0 20px 60px -20px rgba(0,0,0,0.7)",
        "glow-terra": "0 10px 40px -10px rgba(193,132,104,0.45)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.8)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.16,1,0.3,1) both",
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-ring": "pulse-ring 1.4s cubic-bezier(0.16,1,0.3,1) forwards",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
