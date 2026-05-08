import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // Tidal Athletics — cyan primary
        cyan: {
          DEFAULT: "#00D4E6",
          bright: "#4DEEFF",
          deep: "#008FA0",
        },
        // Tidal Athletics — pink accent
        pink: {
          DEFAULT: "#FF2D78",
          bright: "#FF5C99",
          deep: "#B81E58",
        },
        // Ink scale (dark backgrounds)
        ink: {
          0: "#030406",
          1: "#07090C",
          2: "#0C1014",
          3: "#11161C",
          4: "#181E26",
          5: "#232A33",
          6: "#313B47",
        },
        // Foreground scale
        fg: {
          DEFAULT: "#FFFFFF",
          2: "#C9D1DA",
          3: "#8893A1",
          4: "#5A6573",
        },
        // Legacy aliases kept for backward compatibility
        blood: {
          DEFAULT: "#00D4E6",
          dark: "#008FA0",
          light: "#4DEEFF",
        },
        carbon: {
          900: "#030406",
          800: "#07090C",
          700: "#0C1014",
          600: "#11161C",
          500: "#232A33",
          400: "#313B47",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Barlow Condensed", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(rgba(0,212,230,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,230,0.06) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(ellipse at top, rgba(0,212,230,0.12), transparent 60%)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-up": "fadeUp 0.6s ease-out forwards",
        "work-pulse": "workPulse 1s ease-in-out infinite",
        "dot-pulse": "dotPulse 1.6s infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        workPulse: {
          "0%, 100%": { filter: "drop-shadow(0 0 0 rgba(0,212,230,0))" },
          "50%": { filter: "drop-shadow(0 0 24px rgba(0,212,230,.6))" },
        },
        dotPulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".55", transform: "scale(.85)" },
        },
      },
      boxShadow: {
        "glow-cyan": "0 0 0 1px rgba(0,212,230,.4), 0 0 24px rgba(0,212,230,.35), 0 0 60px rgba(0,212,230,.15)",
        "glow-pink": "0 0 0 1px rgba(255,45,120,.4), 0 0 24px rgba(255,45,120,.35)",
        "glow-cyan-sm": "0 0 12px rgba(0,212,230,.5)",
        "glow-pink-sm": "0 0 12px rgba(255,45,120,.5)",
      },
    },
  },
  plugins: [],
};
export default config;
