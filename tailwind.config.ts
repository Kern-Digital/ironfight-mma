import type { Config } from "tailwindcss";

const config: Config = {
  // Hover-Styles NUR an Geräten mit echtem Zeiger.
  // Ohne diesen Schalter setzt Tailwind `hover:` als blankes `:hover` — und
  // auf iOS/Android löst der erste Tap das aus und der Zustand BLEIBT
  // hängen, bis woanders hingetippt wird. Mit dem Schalter wickelt Tailwind
  // jede hover:-Klasse in `@media (hover: hover)`. Pflicht, weil die App
  // via Capacitor in WKWebView laufen soll (docs/DESIGN-BRIEF.md §8).
  future: { hoverOnlyWhenSupported: true },
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
        // ── NEUES TOKEN-SYSTEM (Redesign 2026-08, docs/DESIGN-BRIEF.md) ──
        // Alle Werte leben als CSS-Variablen in app/globals.css und leiten
        // sich aus --accent-h/--accent-c ab. Nie Hex hier eintragen.
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          press: "var(--accent-press)",
          subtle: "var(--accent-subtle)",
          text: "var(--accent-text)",
          on: "var(--on-accent)",
        },
        // Brand-Violett — AUSSCHLIESSLICH DeepFight-Kontexte
        fight: {
          DEFAULT: "var(--accent-2)",
          subtle: "var(--accent-2-subtle)",
        },
        surface: {
          page: "var(--surface-page)",
          card: "var(--surface-card)",
          raised: "var(--surface-raised)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
        },
        content: {
          1: "var(--text-1)",
          2: "var(--text-2)",
          3: "var(--text-3)",
        },
        positive: "var(--positive)",
        negative: "var(--negative)",
        warning: "var(--warning)",
        // ── ALTES SYSTEM (bis Rollout-Ende, danach entfernen) ──
        // Tidal Athletics — cyan primary
        cyan: {
          DEFAULT: "#23C4CE",
          bright: "#5FE6EC",
          deep: "#13939C",
        },
        // Tidal Athletics — pink accent
        pink: {
          DEFAULT: "#FF4FA8",
          bright: "#FF85C2",
          deep: "#D62E86",
        },
        // Sekundär-Akzente
        violet: { DEFAULT: "#9D7BFA", deep: "#7C5BD2" },
        amber: { DEFAULT: "#8A63E8", deep: "#6A48C9" },
        mint: { DEFAULT: "#3EE06B", deep: "#22B04C" },
        // Ink scale (dark backgrounds)
        ink: {
          0: "#07040D",
          1: "#0B0716",
          2: "#110B1E",
          3: "#161028",
          4: "#1E1733",
          5: "#2B2243",
          6: "#3C3158",
        },
        // Foreground scale
        fg: {
          DEFAULT: "#FFFFFF",
          2: "#CCC9E0",
          3: "#8F8AA8",
          4: "#5F5878",
        },
        // Legacy aliases kept for backward compatibility
        blood: {
          DEFAULT: "#23C4CE",
          dark: "#13939C",
          light: "#5FE6EC",
        },
        carbon: {
          900: "#07040D",
          800: "#0B0716",
          700: "#110B1E",
          600: "#161028",
          500: "#2B2243",
          400: "#3C3158",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Barlow Condensed", "Impact", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
        // Neues System: Archivo für Display UND Body (Rollout ersetzt display/sans)
        archivo: ["var(--font-archivo)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Neues System (semantisch statt Größenleiter)
        card: "var(--r-lg)",   // 16px — Karten
        field: "var(--r-md)",  // 12px — Buttons/Inputs
        modal: "var(--r-xl)",  // 22px — Modals
        badge: "var(--r-sm)",  // 8px — kleine Elemente
        pill: "var(--r-pill)",
      },
      spacing: {
        hit: "var(--hit-min)", // 44px Mindest-Touchziel
      },
      transitionTimingFunction: {
        tok: "var(--ease-out)",
      },
      transitionDuration: {
        fast: "120ms",
        med: "220ms",
      },
      backgroundImage: {
        // Neues System — Nutzung nur gemäß Token-Regeln (DESIGN-BRIEF)
        ambient: "var(--ambient)",
        "ambient-fight": "var(--ambient-fight)",
        "grad-fight": "var(--grad-fight)",       // NUR DeepFight
        "grad-progress": "var(--grad-progress)", // generische Fortschrittsbalken
        // Altes System (bis Rollout-Ende)
        "grid-pattern":
          "linear-gradient(rgba(35,196,206,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(35,196,206,0.06) 1px, transparent 1px)",
        "radial-fade":
          "radial-gradient(ellipse at top, rgba(35,196,206,0.12), transparent 60%)",
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
          "0%, 100%": { filter: "drop-shadow(0 0 0 rgba(35,196,206,0))" },
          "50%": { filter: "drop-shadow(0 0 24px rgba(35,196,206,.6))" },
        },
        dotPulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: ".55", transform: "scale(.85)" },
        },
      },
      boxShadow: {
        // Neues System
        glass: "var(--glass-shadow)",
        "accent-glow": "var(--accent-glow)", // NUR Primär-Button/aktive Zustände
        // Altes System (bis Rollout-Ende)
        "glow-cyan": "0 0 0 1px rgba(35,196,206,.4), 0 0 24px rgba(35,196,206,.35), 0 0 60px rgba(35,196,206,.15)",
        "glow-pink": "0 0 0 1px rgba(255,79,168,.4), 0 0 24px rgba(255,79,168,.35)",
        "glow-cyan-sm": "0 0 12px rgba(35,196,206,.5)",
        "glow-pink-sm": "0 0 12px rgba(255,79,168,.5)",
      },
    },
  },
  plugins: [],
};
export default config;
