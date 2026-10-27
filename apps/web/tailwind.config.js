/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#090d16",
        foreground: "#f8fafc",
        card: "#0f172a",
        cardBorder: "#1e293b",
        primary: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
          light: "#60a5fa"
        },
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444"
      }
    },
  },
  plugins: [],
};
