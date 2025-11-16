/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': 'var(--bg-primary)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-hover': 'var(--bg-hover)',
        'border-default': 'var(--border)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'accent': {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
        },
        'success': 'var(--success)',
        'gold-start': 'var(--gold-start)',
        'gold-end': 'var(--gold-end)',
        'warning': 'var(--warning)',
      },
      letterSpacing: {
        'elegant': '0.02em',
      },
      boxShadow: {
        'elevation': '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      backdropBlur: {
        'soft': '12px',
      },
      transitionDuration: {
        'micro': '150ms',
      },
    },
  },
  plugins: [],
};
