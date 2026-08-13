/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        arc: {
          DEFAULT: "#0f2f24",
          light: "#1c4a38",
          accent: "#c9a24b"
        }
      }
    }
  },
  plugins: []
};
