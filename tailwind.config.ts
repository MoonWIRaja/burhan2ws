import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Neon Colors
        neon: {
          red: '#ff0040',
          blue: '#00d4ff',
          magenta: '#ff00ff',
          cyan: '#00ffff',
          green: '#00ff88',
          purple: '#bf00ff',
          yellow: '#ffff00',
          orange: '#ff8800',
        },
        // Theme specific
        panel: 'var(--panel)',
        'text-dim': 'var(--text-dim)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        cyber: ['Orbitron', 'sans-serif'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'neon-shift': {
          '0%': { '--neon-hue': '0' },
          '16.66%': { '--neon-hue': '200' },
          '33.33%': { '--neon-hue': '300' },
          '50%': { '--neon-hue': '180' },
          '66.66%': { '--neon-hue': '140' },
          '83.33%': { '--neon-hue': '280' },
          '100%': { '--neon-hue': '0' },
        },
        'neon-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'neon-glow': {
          '0%, 100%': {
            boxShadow: '0 0 5px var(--neon-color-primary), 0 0 10px var(--neon-color-primary), 0 0 20px var(--neon-color-primary)',
          },
          '50%': {
            boxShadow: '0 0 10px var(--neon-color-primary), 0 0 20px var(--neon-color-primary), 0 0 40px var(--neon-color-primary)',
          },
        },
        'terminal-blink': {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        'matrix-rain': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'hologram-flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.95' },
          '25%, 75%': { opacity: '0.98' },
        },
        'border-flow': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'neon-shift': 'neon-shift 12s ease-in-out infinite',
        'neon-pulse': 'neon-pulse 3s ease-in-out infinite',
        'neon-glow': 'neon-glow 2s ease-in-out infinite',
        'terminal-blink': 'terminal-blink 1s step-end infinite',
        'matrix-rain': 'matrix-rain 10s linear infinite',
        'hologram-flicker': 'hologram-flicker 0.15s ease-in-out infinite',
        'border-flow': 'border-flow 6s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'scan-line': 'scan-line 8s linear infinite',
      },
      boxShadow: {
        'neon-sm': '0 0 5px var(--neon-color-primary)',
        'neon-md': '0 0 10px var(--neon-color-primary), 0 0 20px var(--neon-color-primary)',
        'neon-lg': '0 0 15px var(--neon-color-primary), 0 0 30px var(--neon-color-primary), 0 0 45px var(--neon-color-primary)',
        'neon-glow': '0 0 20px var(--neon-color-primary), 0 0 40px var(--neon-color-secondary)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'cyber': 'inset 0 0 60px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 212, 255, 0.2)',
      },
      backdropBlur: {
        'glass': '16px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;



