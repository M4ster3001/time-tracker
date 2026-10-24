import React from 'react';

type AppBrandMarkProps = {
  className?: string;
  compact?: boolean;
  title?: string;
};

/** Neutral time-tracking mark. Replace this component to use a custom logo. */
const AppBrandMark: React.FC<AppBrandMarkProps> = ({
  className = '',
  compact = false,
  title = 'Time Tracker',
}) => (
  <span
    className={`tt-brand-mark${compact ? ' tt-brand-mark--compact' : ''} ${className}`.trim()}
    role="img"
    aria-label={title}
  >
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7v5l3.5 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

export default AppBrandMark;
