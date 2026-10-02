/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic background / surface tokens
        'bg-canvas': {
          DEFAULT: '#F8F9FA',
          dark: '#0F172A',
        },
        'surface-card': {
          DEFAULT: '#FFFFFF',
          dark: '#1E293B',
        },
        'surface-inset': {
          DEFAULT: '#F1F5F9',
          dark: '#334155',
        },

        // Border tokens
        'border-1': {
          DEFAULT: '#E5E7EB',
          dark: '#334155',
        },
        'border-focus': {
          DEFAULT: '#059669',
          dark: '#34D399',
        },

        // Text tokens
        'text-primary': {
          DEFAULT: '#0F172A',
          dark: '#F8FAFC',
        },
        'text-secondary': {
          DEFAULT: '#64748B',
          dark: '#94A3B8',
        },
        'text-inverse': {
          DEFAULT: '#FFFFFF',
          dark: '#0F172A',
        },

        // Accent / feedback tokens
        'accent-primary': {
          DEFAULT: '#059669',
          dark: '#34D399',
        },
        'accent-hover': {
          DEFAULT: '#047857',
          dark: '#6EE7B7',
        },
        alert: {
          DEFAULT: '#E05252',
          dark: '#F87171',
        },
        'alert-bg': {
          DEFAULT: '#FEF2F2',
          dark: '#450A0A',
        },
        'success-bg': {
          DEFAULT: '#F0FDF4',
          dark: '#064E3B',
        },
        warning: {
          DEFAULT: '#D97706',
          dark: '#FBBF24',
        },
      },

      fontFamily: {
        inter: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        system: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Inter', 'sans-serif'],
        android: ['Roboto', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        balance: ['40px', { lineHeight: '1', letterSpacing: '-0.02em' }],
        section: ['20px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'card-title': ['16px', { lineHeight: '1.25', letterSpacing: '-0.005em' }],
        body: ['14px', { lineHeight: '1.5' }],
        'body-medium': ['14px', { lineHeight: '1.5' }],
        micro: ['12px', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        button: ['16px', { lineHeight: '1' }],
        tab: ['11px', { lineHeight: '1', letterSpacing: '0.02em' }],
      },

      borderRadius: {
        input: '12px',
        card: '16px',
        pill: '9999px',
        sheet: '24px',
      },

      boxShadow: {
        ambient: '0 2px 8px rgba(15, 23, 42, 0.04)',
        sheet: '0 -4px 24px rgba(15, 23, 42, 0.08)',
      },

      spacing: {
        4.5: '18px',
        5.5: '22px',
      },

      transitionDuration: {
        press: '120ms',
        transition: '200ms',
        spring: '300ms',
      },

      transitionTimingFunction: {
        'ease-out-custom': 'cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.font-tabular': {
          'font-feature-settings': '"tnum" 1, "zero" 1',
          'font-variant-numeric': 'tabular-nums slashed-zero',
        },
        '.slashed-zero': {
          'font-feature-settings': '"zero" 1',
          'font-variant-numeric': 'slashed-zero',
        },
        '.lining-nums': {
          'font-variant-numeric': 'lining-nums',
        },
        '.active-scale': {
          transform: 'scale(0.98)',
        },
        '.min-touch': {
          minHeight: '44px',
          minWidth: '44px',
        },
      });
    },
  ],
};
