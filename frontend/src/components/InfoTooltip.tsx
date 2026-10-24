import React, { useId } from 'react';
import { text } from '../i18n';

interface InfoTooltipProps {
  content: string;
  className?: string;
  align?: 'center' | 'left' | 'right';
  /** `subtle` drops the border/background until hover, for dense card headers. */
  variant?: 'default' | 'subtle';
}

const triggerVariantClassMap: Record<NonNullable<InfoTooltipProps['variant']>, string> = {
  default: 'border border-tt-border bg-tt-surface text-tt-warning shadow-sm hover:bg-tt-warning-soft',
  subtle:
    'border border-transparent bg-transparent text-tt-text-muted hover:border-tt-border hover:text-tt-text',
};

const tooltipAlignClassMap: Record<NonNullable<InfoTooltipProps['align']>, string> = {
  center: 'left-1/2 -translate-x-1/2',
  left: 'left-0',
  right: 'right-0',
};

const InfoTooltip: React.FC<InfoTooltipProps> = ({
  content,
  className = '',
  align = 'center',
  variant = 'default',
}) => {
  const tipId = useId();

  return (
    <span className={`group relative z-20 inline-flex shrink-0 isolate ${className}`.trim()}>
      <button
        type="button"
        aria-label={text('Mais informações', 'More information')}
        aria-describedby={tipId}
        className={`inline-flex h-6 w-6 min-h-[24px] min-w-[24px] items-center justify-center rounded-full transition ${triggerVariantClassMap[variant]} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-focus focus-visible:ring-offset-2 focus-visible:ring-offset-tt-surface`}
      >
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="7.25" strokeWidth="1.5" />
          <path strokeLinecap="round" strokeWidth="1.8" d="M10 6.3v4.6" />
          <circle cx="10" cy="13.9" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={`pointer-events-none absolute top-full z-[120] mt-2 hidden w-[18rem] max-w-[calc(100vw-2rem)] rounded-tt border border-tt-border bg-tt-page px-3 py-2 text-left text-xs font-normal leading-5 text-tt-text shadow-tt group-hover:block group-focus-within:block ${tooltipAlignClassMap[align]}`}
      >
        {content}
      </span>
    </span>
  );
};

export default InfoTooltip;
