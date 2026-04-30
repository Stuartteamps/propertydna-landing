import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        espresso: '#0F0E0D',
        canvas: '#F4F0E8',
        gold: '#B89355',
        warmgray: '#6B6252',
      },
      fontFamily: {
        sans: ['Jost', 'system-ui', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
