import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          950: "#0a0a0f",
          900: "#111118",
          850: "#15151e",
          800: "#1a1a26",
          750: "#1e1e2e",
          700: "#252535",
          600: "#3a3a50",
          500: "#5a5a78",
          400: "#8080a0",
          300: "#a0a0c0",
          200: "#c0c0d8",
          100: "#e0e0f0",
          50: "#f0f0f8",
        },
        green: {
          400: "#4ade80",
          500: "#22c55e",
        },
        yellow: {
          400: "#facc15",
          500: "#eab308",
        },
        red: {
          400: "#f87171",
          500: "#ef4444",
        },
        blue: {
          400: "#60a5fa",
          500: "#3b82f6",
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Fira Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
