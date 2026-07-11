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
        background: "#171717",
        foreground: "#F4FAF7",
        primary: "#21F1A8",
        accent: "#21F1A8",
        surface: "#1D1D1D",
        card: "#202020",
        border: "rgba(33,241,168,0.24)",
        muted: "#AAB6B2",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "\"Segoe UI\"", "Roboto", "\"Helvetica Neue\"", "Arial", "sans-serif"],
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "\"Segoe UI\"", "Roboto", "\"Helvetica Neue\"", "Arial", "sans-serif"],
      },
      boxShadow: {
        glow: "none",
      },
      backgroundImage: {
        hero: "linear-gradient(180deg, #171717 0%, #111111 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
