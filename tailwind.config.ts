import type { Config } from "tailwindcss";

/**
 * ElaBela — "Premium Noir" system.
 * Near-black + graphite grays, glass surfaces, semantic status colors (blue/green/amber).
 * The only warm accent is `nude`, reserved for the pulsing corner logo.
 * Everything else leans on Tailwind's built-in zinc/neutral/blue/emerald/amber.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        nude: {
          DEFAULT: "#d6ab99",
          soft: "#e6c9bb",
          deep: "#b98a76",
        },
        ink: {
          950: "#08080a",
          900: "#0c0c0f",
          850: "#111114",
          800: "#16161a",
          700: "#1d1d22",
          600: "#26262c",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.15rem",
        "3xl": "1.6rem",
      },
      boxShadow: {
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 50px -28px rgba(0,0,0,0.9)",
        pop: "0 30px 80px -30px rgba(0,0,0,0.95)",
        "glow-nude": "0 0 0 1px rgba(214,171,153,0.25), 0 0 40px -6px rgba(214,171,153,0.55)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-nude": {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(214,171,153,0.55), 0 0 22px -2px rgba(214,171,153,0.5)" },
          "50%": { boxShadow: "0 0 0 8px rgba(214,171,153,0), 0 0 34px 2px rgba(214,171,153,0.75)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96) translateY(8px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-nude": "pulse-nude 2.8s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        "scale-in": "scale-in 0.22s cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
