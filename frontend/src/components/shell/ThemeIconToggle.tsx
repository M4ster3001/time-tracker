import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { text } from '../../i18n';

type ThemeIconToggleProps = {
  className?: string;
};

/** Icon-first sun/moon toggle (accessible label; no verbose text chrome). */
const ThemeIconToggle: React.FC<ThemeIconToggleProps> = ({ className = '' }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const label = isDark
    ? text('Ativar modo claro', 'Enable light mode')
    : text('Ativar modo escuro', 'Enable dark mode');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`tt-icon-btn ${className}`.trim()}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      data-testid="theme-toggle"
    >
      {isDark ? (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
          <path
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            d="M12 3v1.5M12 19.5V21M4.5 12H3M21 12h-1.5M6.2 6.2l1.1 1.1M16.7 16.7l1.1 1.1M6.2 17.8l1.1-1.1M16.7 7.3l1.1-1.1"
          />
        </svg>
      ) : (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.5 14.2A7.8 7.8 0 019.8 3.5 8.5 8.5 0 1020.5 14.2z"
          />
        </svg>
      )}
    </button>
  );
};

export default ThemeIconToggle;
