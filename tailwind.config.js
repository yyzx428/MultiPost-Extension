/** @type {import('tailwindcss').Config} */
import { nextui } from '@nextui-org/react';

module.exports = {
  content: ['./src/**/*.{tsx,html}', './node_modules/@nextui-org/theme/dist/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  // prefix: "plasmo-",
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {},
  },
  plugins: [nextui({ addCommonColors: true, defaultTheme: 'light' })],
};
