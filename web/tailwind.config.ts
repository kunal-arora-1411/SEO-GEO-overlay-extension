import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#e2dfff",
          300: "#dad7ff",
          400: "#c3c0ff",
          500: "#4f46e5",
          600: "#3525cd",
          700: "#3323cc",
          800: "#2e1065",
          900: "#0f0069",
          950: "#0f0069",
        },
        secondary: {
          50: "#faf8ff",
          100: "#fffbff",
          200: "#eaddff",
          300: "#d2bbff",
          500: "#8a4cfc",
          600: "#712ae2",
          700: "#5a00c6",
          900: "#25005a",
        },
        tertiary: {
          50: "#f0fdfa",
          100: "#ccfbf1",
          200: "#89f5e7",
          300: "#6bd8cb",
          400: "#81eddf",
          500: "#006c63",
          600: "#00524b",
          700: "#005049",
          800: "#003e39",
          900: "#00201d",
        },
        surface: {
          DEFAULT: '#faf8ff',
          dim: '#d2d9f4',
          container: '#eaedff',
          'container-high': '#e2e7ff',
          'container-highest': '#dae2fd',
          'container-low': '#f2f3ff',
          'container-lowest': '#ffffff',
          variant: '#dae2fd',
          on: '#131b2e',
          'on-variant': '#464555',
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Manrope", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
