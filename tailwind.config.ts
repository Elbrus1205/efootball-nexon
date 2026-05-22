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
        foreground: "#F5F5F5",
        primary: "#D4AF37",
        accent: "#C5A028",
        surface: "#111111",
        card: "#111111",
        border: "rgba(212,175,55,0.24)",
        muted: "#CCCCCC",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "\"Segoe UI\"", "Roboto", "\"Helvetica Neue\"", "Arial", "sans-serif"],
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "\"Segoe UI\"", "Roboto", "\"Helvetica Neue\"", "Arial", "sans-serif"],
      },
      boxShadow: {
        glow: "none",
      },
      backgroundImage: {
        hero: "linear-gradient(180deg, #0A0A0A 0%, #000000 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
