/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "dark-purple": "#2d3484", // Color principal
        primary: "#0A30BC", // Color principal
        secondary: "#DDAE5E", // Color secundario
      },
    },
  },
  plugins: [],
};
