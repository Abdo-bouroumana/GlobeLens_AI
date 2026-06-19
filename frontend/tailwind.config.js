/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "tertiary-container": "#231500",
        "secondary-container": "#3e495d",
        "on-surface-variant": "#c6c6cd",
        "on-tertiary-fixed": "#271901",
        "surface-tint": "#bec6e0",
        "on-primary-fixed": "#131b2e",
        "inverse-surface": "#d4e4fa",
        "primary": "#bec6e0",
        "secondary": "#bcc7de",
        "on-surface": "#d4e4fa",
        "on-tertiary-container": "#957d5a",
        "primary-fixed": "#dae2fd",
        "surface-container-low": "#0d1c2d",
        "on-secondary": "#263143",
        "secondary-fixed-dim": "#bcc7de",
        "inverse-primary": "#565e74",
        "surface-container-high": "#1c2b3c",
        "error": "#ffb4ab",
        "primary-container": "#0f172a",
        "on-primary-container": "#798098",
        "on-error": "#690005",
        "on-error-container": "#ffdad6",
        "tertiary-fixed-dim": "#dec29a",
        "outline-variant": "#45464d",
        "surface": "#051424",
        "primary-fixed-dim": "#bec6e0",
        "tertiary": "#dec29a",
        "surface-bright": "#2c3a4c",
        "on-tertiary-fixed-variant": "#574425",
        "inverse-on-surface": "#233143",
        "on-secondary-fixed-variant": "#3c475a",
        "surface-container-highest": "#273647",
        "surface-container-lowest": "#010f1f",
        "secondary-fixed": "#d8e3fb",
        "tertiary-fixed": "#fcdeb5",
        "surface-variant": "#273647",
        "surface-dim": "#051424",
        "surface-container": "#122131",
        "on-primary-fixed-variant": "#3f465c",
        "on-secondary-fixed": "#111c2d",
        "outline": "#909097",
        "background": "#051424",
        "on-tertiary": "#3e2d11",
        "error-container": "#93000a",
        "on-secondary-container": "#aeb9d0",
        "on-background": "#d4e4fa",
        "on-primary": "#283044",
        "darkBg": "#051424",
        "cyber-cyan": "#06b6d4",
        "cyber-indigo": "#6366f1",
        "cyber-emerald": "#10b981",
        "cyber-rose": "#f43f5e",
        "cyber-amber": "#f59e0b",
        "cyber-purple": "#a855f7",
        "cyber-dark": "#030712",
        "cyber-panel": "#0b0f19"
      },
      borderRadius: {
        "DEFAULT": "0.125rem",
        "lg": "0.25rem",
        "xl": "0.5rem",
        "full": "0.75rem"
      },
      spacing: {
        "margin-mobile": "16px",
        "container-max-width": "1440px",
        "unit": "4px",
        "margin-desktop": "40px",
        "gutter": "24px",
        "stack-sm": "8px",
        "stack-md": "16px",
        "stack-lg": "32px"
      },
      fontFamily: {
        "body-lg": ["Inter", "sans-serif"],
        "mono-data": ["Geist", "monospace"],
        "headline-xl": ["Source Serif 4", "serif"],
        "display-lg": ["Source Serif 4", "serif"],
        "headline-lg-mobile": ["Source Serif 4", "serif"],
        "headline-lg": ["Source Serif 4", "serif"],
        "label-caps": ["Geist", "monospace"],
        "body-sm": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"]
      },
      animation: {
        "scan": "scan-line 8s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "spin-slow": "spin 20s linear infinite",
        "fade-in-up": "fade-in-up 0.5s ease-out forwards"
      },
      keyframes: {
        "scan-line": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" }
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.3", filter: "brightness(0.9)" },
          "50%": { opacity: "0.8", filter: "brightness(1.2)" }
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      }
    },
  },
  plugins: [],
}
