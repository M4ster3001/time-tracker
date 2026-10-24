import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Legacy aliases (prefer tt-* tokens in new UI)
        primary: 'var(--tt-action)',
        secondary: 'var(--tt-success)',
        danger: 'var(--tt-danger)',
        warning: 'var(--tt-warning)',
        tt: {
          page: 'var(--tt-page)',
          surface: 'var(--tt-surface)',
          elevated: 'var(--tt-elevated)',
          border: 'var(--tt-border)',
          text: 'var(--tt-text)',
          'text-muted': 'var(--tt-text-muted)',
          link: 'var(--tt-link)',
          action: 'var(--tt-action)',
          'action-hover': 'var(--tt-action-hover)',
          'on-action': 'var(--tt-on-action)',
          focus: 'var(--tt-focus)',
          selection: 'var(--tt-selection)',
          success: 'var(--tt-success)',
          'success-soft': 'var(--tt-success-soft)',
          warning: 'var(--tt-warning)',
          'warning-soft': 'var(--tt-warning-soft)',
          danger: 'var(--tt-danger)',
          'danger-soft': 'var(--tt-danger-soft)',
          info: 'var(--tt-info)',
          'info-soft': 'var(--tt-info-soft)',
        },
      },
      fontFamily: {
        sans: ['var(--tt-font-sans)'],
        mono: ['var(--tt-font-mono)'],
      },
      borderRadius: {
        tt: 'var(--tt-radius)',
        'tt-control': 'var(--tt-radius-control)',
      },
      boxShadow: {
        tt: 'var(--tt-shadow)',
      },
      minHeight: {
        touch: '44px',
      },
    },
  },
  plugins: [],
} satisfies Config;
