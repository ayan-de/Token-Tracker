import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0a0b0d",
        secondary: "#12141a",
        accent: {
          cyan: "#16d3b4",
          purple: "#8b5cf6",
          blue: "#3b82f6",
        },
        status: {
          ok: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
        },
        "text-main": "#e2e8f0",
        "text-muted": "#64748b",
      },
      fontFamily: {
        outfit: ["Outfit", "sans-serif"],
        fira: ["Fira Code", "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
    },
  },
  plugins: [],
};

export default config;