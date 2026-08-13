/** @type {import('tailwindcss').Config} */
   module.exports = {
     content: ["./app/**/*.{js,ts,jsx,tsx}"],
     theme: {
       extend: {
         colors: {
           arc: {
             DEFAULT: "#161616",
             light: "#2b2b2b",
             accent: "#b8933f"
           }
         }
       }
     },
     plugins: []
   };