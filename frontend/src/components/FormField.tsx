import React from 'react';
import InfoTooltip from './InfoTooltip';
import { translate } from '../i18n';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  descriptionId?: string;
  children: React.ReactNode;
  className?: string;
}

export const fieldBaseClassName =
  'w-full rounded-tt-control border border-tt-border bg-tt-surface px-3 py-2 text-sm text-tt-text outline-none transition focus:border-tt-action focus:ring-2 focus:ring-tt-focus/25 disabled:cursor-not-allowed disabled:opacity-60 placeholder:text-tt-text-muted';

const shouldCompactHint = (hint?: string) => Boolean(hint && hint.length > 48);

const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  descriptionId,
  children,
  className = '',
}) => {
  const compactHint = shouldCompactHint(hint);

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2">
        <label htmlFor={htmlFor} className="block text-sm font-medium text-tt-text">
          {translate(label)}
          {required ? (
            <span className="ml-1 text-tt-danger" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        {!error && compactHint ? <InfoTooltip content={hint!} align="left" /> : null}
      </div>
      {children}
      {error ? (
        <p id={descriptionId} className="mt-2 text-xs font-semibold text-tt-danger" role="alert">
          {error}
        </p>
      ) : hint && !compactHint ? (
        <p id={descriptionId} className="mt-2 text-xs text-tt-text-muted">
          {hint}
        </p>
      ) : hint && compactHint && descriptionId ? (
        <span id={descriptionId} className="sr-only">
          {hint}
        </span>
      ) : null}
    </div>
  );
};

export default FormField;
