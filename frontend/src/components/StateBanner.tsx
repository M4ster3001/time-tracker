import React from 'react';

type StateBannerTone = 'error' | 'success' | 'info' | 'warning';

interface StateBannerProps {
  tone: StateBannerTone;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const toneMap: Record<StateBannerTone, string> = {
  error: 'tt-banner-danger',
  success: 'tt-banner-success',
  info: 'tt-banner-info',
  warning: 'tt-banner-warning',
};

const StateBanner: React.FC<StateBannerProps> = ({ tone, message, action, className = '' }) => {
  return (
    <div
      className={`${toneMap[tone]} ${className}`.trim()}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium">{message}</p>
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className="min-h-touch text-xs font-semibold underline underline-offset-2"
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default StateBanner;
