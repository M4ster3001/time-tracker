import React from 'react';
import InfoTooltip from './InfoTooltip';

type ScreenStateVariant = 'loading' | 'empty' | 'success' | 'error';

interface ScreenStateProps {
  variant: ScreenStateVariant;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const iconByVariant: Record<ScreenStateVariant, React.ReactNode> = {
  loading: (
    <div
      className="h-12 w-12 animate-spin rounded-full border-4 border-tt-border border-t-tt-action"
      aria-hidden="true"
    />
  ),
  empty: (
    <svg
      className="h-12 w-12 text-tt-text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  success: (
    <svg
      className="h-12 w-12 text-tt-success"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  error: (
    <svg
      className="h-12 w-12 text-tt-danger"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M12 9v2m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.7-1.33-3.46 0L3.2 16c-.77 1.33.2 3 1.73 3z"
      />
    </svg>
  ),
};

const toneClasses: Record<ScreenStateVariant, string> = {
  loading: 'border-tt-border bg-tt-surface text-tt-text',
  empty: 'border-tt-border bg-tt-surface text-tt-text',
  success: 'border-tt-success/40 bg-tt-success-soft text-tt-success',
  error: 'border-tt-danger/40 bg-tt-danger-soft text-tt-danger',
};

const ScreenState: React.FC<ScreenStateProps> = ({
  variant,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`flex flex-col items-center justify-center rounded-tt border p-8 text-center shadow-tt ${toneClasses[variant]} ${className}`.trim()}
    >
      {iconByVariant[variant]}
      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? <InfoTooltip content={description} /> : null}
      </div>
      {action ? (
        <button type="button" onClick={action.onClick} className="tt-btn-primary mt-6 px-5">
          {action.label}
        </button>
      ) : null}
    </div>
  );
};

export default ScreenState;
