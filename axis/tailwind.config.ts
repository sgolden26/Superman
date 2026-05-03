import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        mil: {
          900: "#06080d",
          800: "#0a0e13",
          700: "#10151c",
          600: "#161c25",
          500: "#1e2530",
          400: "#28313e",
          300: "#384352",
          200: "#6a7686",
          100: "#a9b3c1",
          50: "#dde2eb",
        },
        faction: {
          nato: "#4DA1FF",
          ru: "#FF5C4D",
          neutral: "#D4A24F",
        },
        accent: {
          amber: "#D4A24F",
          danger: "#FF5C4D",
          ok: "#7CD891",
          blue: "#4DA1FF",
        },
      },
      borderRadius: {
        deck: "2px",
      },
      fontFamily: {
        sans: [
          "IBM Plex Sans",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      letterSpacing: {
        wider2: "0.18em",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(77,161,255,0.5), 0 0 16px rgba(77,161,255,0.25)",
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        spawnRing: {
          "0%": { transform: "translate(-50%, -50%) scale(0.4)", opacity: "0.9" },
          "70%": { opacity: "0.55" },
          "100%": { transform: "translate(-50%, -50%) scale(2.6)", opacity: "0" },
        },
        spawnLabel: {
          "0%": { opacity: "0", transform: "translate(8px, calc(-50% - 14px))" },
          "20%": { opacity: "1", transform: "translate(8px, calc(-50% - 18px))" },
          "80%": { opacity: "1", transform: "translate(8px, calc(-50% - 18px))" },
          "100%": { opacity: "0", transform: "translate(8px, calc(-50% - 22px))" },
        },
      },
      animation: {
        ticker: "ticker 60s linear infinite",
        spawnRing: "spawnRing 2200ms ease-out forwards",
        spawnLabel: "spawnLabel 2400ms ease-out forwards",
      },
    },
  },
  plugins: [],
} satisfies Config;
