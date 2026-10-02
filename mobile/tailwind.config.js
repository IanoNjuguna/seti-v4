const rootConfig = require('../tailwind.config.js');

/** @type {import('tailwindcss').Config} */
module.exports = Object.assign({}, rootConfig, {
  content: [
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
    './src/screens/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
});
