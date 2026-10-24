import React, { useId } from 'react';
import FormField, { fieldBaseClassName } from './FormField';
import InfoTooltip from './InfoTooltip';

interface FieldInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  inputClassName?: string;
}

interface FieldTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  textareaClassName?: string;
}

interface FieldSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  selectClassName?: string;
}

interface FieldCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  checkboxClassName?: string;
}

const mergeClassName = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(' ');

const shouldCompactHint = (hint?: string) => Boolean(hint && hint.length > 48);

export const fieldSelectBaseClassName = fieldBaseClassName;

const FieldInput = React.forwardRef<HTMLInputElement, FieldInputProps>(
  (
    { label, hint, error, required = false, className = '', inputClassName = '', id, ...props },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helperId = hint || error ? `${inputId}-help` : undefined;

    return (
      <FormField
        label={label}
        htmlFor={inputId}
        hint={hint}
        error={error}
        required={required}
        descriptionId={helperId}
        className={className}
      >
        <input
          ref={ref}
          id={inputId}
          aria-describedby={helperId}
          aria-invalid={Boolean(error)}
          className={mergeClassName(fieldBaseClassName, inputClassName)}
          {...props}
        />
      </FormField>
    );
  }
);

FieldInput.displayName = 'FieldInput';

const FieldTextarea = React.forwardRef<HTMLTextAreaElement, FieldTextareaProps>(
  (
    { label, hint, error, required = false, className = '', textareaClassName = '', id, ...props },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const helperId = hint || error ? `${textareaId}-help` : undefined;

    return (
      <FormField
        label={label}
        htmlFor={textareaId}
        hint={hint}
        error={error}
        required={required}
        descriptionId={helperId}
        className={className}
      >
        <textarea
          ref={ref}
          id={textareaId}
          aria-describedby={helperId}
          aria-invalid={Boolean(error)}
          className={mergeClassName(fieldBaseClassName, textareaClassName)}
          {...props}
        />
      </FormField>
    );
  }
);

FieldTextarea.displayName = 'FieldTextarea';

const FieldSelect = React.forwardRef<HTMLSelectElement, FieldSelectProps>(
  (
    {
      label,
      hint,
      error,
      required = false,
      className = '',
      selectClassName = '',
      id,
      children,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;
    const helperId = hint || error ? `${selectId}-help` : undefined;

    return (
      <FormField
        label={label}
        htmlFor={selectId}
        hint={hint}
        error={error}
        required={required}
        descriptionId={helperId}
        className={className}
      >
        <select
          ref={ref}
          id={selectId}
          aria-describedby={helperId}
          aria-invalid={Boolean(error)}
          className={mergeClassName(fieldSelectBaseClassName, selectClassName)}
          {...props}
        >
          {children}
        </select>
      </FormField>
    );
  }
);

FieldSelect.displayName = 'FieldSelect';

const FieldCheckbox = React.forwardRef<HTMLInputElement, FieldCheckboxProps>(
  (
    { label, hint, error, required = false, className = '', checkboxClassName = '', id, ...props },
    ref
  ) => {
    const generatedId = useId();
    const checkboxId = id ?? generatedId;
    const helperId = hint || error ? `${checkboxId}-help` : undefined;
    const compactHint = shouldCompactHint(hint);

    return (
      <div className={className}>
        <label
          htmlFor={checkboxId}
          className="flex min-h-touch items-center justify-between rounded-tt border border-tt-border bg-tt-surface px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-tt-text">
            <span>
              {label}
              {required ? (
                <span className="ml-1 text-tt-danger" aria-hidden="true">
                  *
                </span>
              ) : null}
            </span>
            {!error && compactHint ? <InfoTooltip content={hint!} align="left" /> : null}
          </span>
          <input
            ref={ref}
            id={checkboxId}
            {...props}
            type="checkbox"
            aria-describedby={helperId}
            aria-invalid={Boolean(error)}
            className={mergeClassName('h-4 w-4 accent-[var(--tt-action)]', checkboxClassName)}
          />
        </label>
        {error ? (
          <p id={helperId} className="mt-2 text-xs font-semibold text-tt-danger" role="alert">
            {error}
          </p>
        ) : hint && !compactHint ? (
          <p id={helperId} className="mt-2 text-xs text-tt-text-muted">
            {hint}
          </p>
        ) : hint && compactHint && helperId ? (
          <span id={helperId} className="sr-only">
            {hint}
          </span>
        ) : null}
      </div>
    );
  }
);

FieldCheckbox.displayName = 'FieldCheckbox';

export { FieldInput, FieldTextarea, FieldSelect, FieldCheckbox };
