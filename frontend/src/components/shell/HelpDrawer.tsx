import React, { useEffect, useId, useRef, useState } from 'react';
import { trapFocusKeyDown } from '../../hooks/focusTrap';
import { text } from '../../i18n';
import HelpContent from './HelpContent';
import { useShellChrome } from './ShellChromeContext';

export const HelpDrawer: React.FC = () => {
  const { helpOpen, helpTopicId, closeHelp, openHelp } = useShellChrome();
  const [topicId, setTopicId] = useState<string | null>(helpTopicId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (helpOpen) setTopicId(helpTopicId);
  }, [helpOpen, helpTopicId]);

  useEffect(() => {
    if (!helpOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const main = document.getElementById('workspace-content');
    if (main) main.inert = true;
    if (dialog && !dialog.open) dialog.showModal();
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogRef.current) trapFocusKeyDown(dialogRef.current, event);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (dialog?.open) dialog.close();
      if (main) main.inert = false;
      const previous = previousFocusRef.current;
      previousFocusRef.current = null;
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [helpOpen]);

  if (!helpOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="tt-help-drawer fixed inset-y-0 right-0 m-0 ml-auto flex h-full max-h-full w-full max-w-md flex-col border-0 border-l border-tt-border bg-tt-surface p-0 text-tt-text shadow-tt open:flex"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        closeHelp();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) closeHelp();
      }}
    >
      <div className="flex items-center justify-between border-b border-tt-border px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {text('Ajuda', 'Help')}
        </h2>
        <button
          ref={closeRef}
          type="button"
          className="tt-btn-secondary min-h-touch px-3"
          onClick={closeHelp}
          aria-label={text('Fechar ajuda', 'Close help')}
        >
          {text('Fechar', 'Close')}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <HelpContent
          topicId={topicId}
          compact
          onSelectTopic={(id) => {
            const next = id || null;
            setTopicId(next);
            if (next) openHelp(next);
          }}
        />
      </div>
    </dialog>
  );
};

export default HelpDrawer;
