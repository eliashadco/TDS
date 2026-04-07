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
        tds: {
          bg: "#eaf0f6",
          card: "#ffffff",
          hover: "#eef3f8",
          input: "#f7fafd",
          border: "#d8e2ec",
          focus: "#1d4ed8",
          text: "#0f172a",
          dim: "#6b7b8f",
          muted: "#cad5e2",
          blue: "#2563eb",
          green: "#0b8a66",
          red: "#dc4c38",
          amber: "#ea6d20",
          purple: "#4f46e5",
          pink: "#db2777",
          slate: "#0d1528",
          ink: "#0f172a",
          wash: "#f7fafd",
          teal: "#0ea5a4",
        },
      },
      fontFamily: {
        sans: ["var(--font-manrope)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
