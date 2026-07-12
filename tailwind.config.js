/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef4ff", 100: "#dbe7ff", 500: "#3b5fe0", 600: "#2f4bc0", 700: "#25399a"
        }
      }
    },
  },
  plugins: [],
};
