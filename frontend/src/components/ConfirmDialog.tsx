import React, { useEffect, useId, useRef } from 'react';
import { trapFocusKeyDown } from '../hooks/focusTrap';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const main = document.getElementById('workspace-content');
    if (main) main.inert = true;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
    confirmButtonRef.current?.focus();

    return () => {
      if (dialog?.open) {
        dialog.close();
      }
      if (main) main.inert = false;
      const previous = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (dialogRef.current) trapFocusKeyDown(dialogRef.current, event);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const variantStyles = {
    danger: {
      icon: (
        <svg
          className="h-6 w-6 text-tt-danger"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      ),
      confirmButton: 'bg-tt-danger hover:opacity-90 focus-visible:ring-tt-danger text-tt-on-action',
      iconBg: 'bg-tt-danger-soft',
    },
    warning: {
      icon: (
        <svg
          className="h-6 w-6 text-tt-warning"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      ),
      confirmButton: 'bg-tt-warning hover:opacity-90 focus-visible:ring-tt-warning text-tt-on-action',
      iconBg: 'bg-tt-warning-soft',
    },
    info: {
      icon: (
        <svg
          className="h-6 w-6 text-tt-info"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
          />
        </svg>
      ),
      confirmButton: 'bg-tt-action hover:bg-tt-action-hover focus-visible:ring-tt-focus text-tt-on-action',
      iconBg: 'bg-tt-info-soft',
    },
  };

  const styles = variantStyles[variant];

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto rounded-tt border-0 bg-transparent p-0 backdrop:bg-black/50"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-tt border border-tt-border bg-tt-surface p-6 shadow-tt">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${styles.iconBg}`}
          >
            {styles.icon}
          </div>
          <div className="flex-1">
            <h3 id={titleId} className="text-lg font-semibold text-tt-text">
              {title}
            </h3>
            <p id={descriptionId} className="mt-2 text-sm text-tt-text-muted">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="tt-btn-secondary min-h-touch px-4">
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`min-h-touch rounded-tt-control px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-tt-surface ${styles.confirmButton}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
};

export default ConfirmDialog;
