import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0A",
        foreground: "#F5F7FA",
        primary: "#3B82F6",
        accent: "#F59E0B",
        surface: "#111111",
        card: "#1F1F1F",
        border: "rgba(255,255,255,0.08)",
        muted: "#A1A1AA",
      },
      fontFamily: {
        sans: ["var(--font-efootball-sans)", "sans-serif"],
        display: ["var(--font-efootball-stencil)", "var(--font-efootball-sans)", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(59,130,246,0.18), 0 20px 60px rgba(59,130,246,0.12)",
      },
      backgroundImage: {
        hero: "radial-gradient(circle at top, rgba(59,130,246,0.22), transparent 40%), radial-gradient(circle at bottom right, rgba(245,158,11,0.14), transparent 30%)",
      },
    },
  },
  plugins: [],
};
export default config;
