/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        signature: ["Dancing Script", "cursive"], // Custom font for logo text
      },
    },
  },
  plugins: [],
};
