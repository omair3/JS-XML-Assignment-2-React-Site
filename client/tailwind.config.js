// client/tailwind.config.js
import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      container: { center: true, padding: "1rem", screens: { "2xl": "1120px" } }
    },
  },
  plugins: [forms(), typography()],
}
