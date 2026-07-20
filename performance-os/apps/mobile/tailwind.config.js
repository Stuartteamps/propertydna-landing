/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bg: { light: "#F5F7FA", dark: "#0B0F14" },
        card: { light: "#FFFFFF", dark: "#151B23" },
        readiness: { green: "#2FBF71", yellow: "#F5B301", red: "#E5484D" },
        accent: "#3E7BFA",
      },
    },
  },
  plugins: [],
};
