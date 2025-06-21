/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        serif: ['Lora', 'Georgia', 'Times New Roman', 'serif'],
      },
      colors: {
        amber: {
          50: '#fffbeb',
          100: '#fef3c7', // Slightly darker than 50
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // --- NEW CUSTOM COLORS FOR THEMES ---
        'light-background': '#f8f8f8', // Slightly off-white for a softer light theme
        'light-text': '#333333',     // Darker grey for better contrast on light
        'vintage-background': '#F2EBDF', // A richer, slightly darker cream/beige
        'vintage-text': '#4A3A2F',     // A deep, warm brown for vintage text
        'vintage-pattern-fill': '#B45309', // A deeper amber for the vintage pattern dots (same as amber-700)
        // --- END NEW CUSTOM COLORS ---
      },
      boxShadow: {
        'book': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05)',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
      typography: (theme) => ({
        amber: {
          css: {
            '--tw-prose-body': theme('colors.amber[800]'),
            '--tw-prose-headings': theme('colors.amber[900]'),
            '--tw-prose-lead': theme('colors.amber[700]'),
            '--tw-prose-links': theme('colors.amber[900]'),
            '--tw-prose-bold': theme('colors.amber[900]'),
            '--tw-prose-counters': theme('colors.amber[600]'),
            '--tw-prose-bullets': theme('colors.amber[400]'),
            '--tw-prose-hr': theme('colors.amber[300]'),
            '--tw-prose-quotes': theme('colors.amber[900]'),
            '--tw-prose-quote-borders': theme('colors.amber[300]'),
            '--tw-prose-captions': theme('colors.amber[700]'),
            '--tw-prose-code': theme('colors.amber[900]'),
            '--tw-prose-pre-code': theme('colors.amber[100]'),
            '--tw-prose-pre-bg': theme('colors.amber[900]'),
            '--tw-prose-th-borders': theme('colors.amber[300]'),
            '--tw-prose-td-borders': theme('colors.amber[200]'),
            '--tw-prose-invert-body': theme('colors.amber[200]'),
            '--tw-prose-invert-headings': theme('colors.white'),
            '--tw-prose-invert-lead': theme('colors.amber[300]'),
            '--tw-prose-invert-links': theme('colors.white'),
            '--tw-prose-invert-bold': theme('colors.white'),
            '--tw-prose-invert-counters': theme('colors.amber[400]'),
            '--tw-prose-invert-bullets': theme('colors.amber[600]'),
            '--tw-prose-invert-hr': theme('colors.amber[700]'),
            '--tw-prose-invert-quotes': theme('colors.amber[100]'),
            '--tw-prose-invert-quote-borders': theme('colors.amber[700]'),
            '--tw-prose-invert-captions': theme('colors.amber[400]'),
            '--tw-prose-invert-code': theme('colors.white'),
            '--tw-prose-invert-pre-code': theme('colors.amber[300]'),
            '--tw-prose-invert-pre-bg': 'rgb(0 0 0 / 50%)',
            '--tw-prose-invert-th-borders': theme('colors.amber[600]'),
            '--tw-prose-invert-td-borders': theme('colors.amber[700]'),
          },
        },
      }),
    },
  },
  plugins: [],
};