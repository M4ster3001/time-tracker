import { translate as translateUi } from '../../../../i18n';
import React, { useEffect, useId, useRef } from 'react';
import SearchableSelect from '../../../../components/SearchableSelect';
import { trapFocusKeyDown } from '../../../../hooks/focusTrap';
import { TIME_ENTRY_CORRECTIONS_DEFAULT_DURATION_HINT } from '../constants';
import {
  TIME_ENTRY_CORRECTIONS_INPUT_CLASS_NAME,
  TIME_ENTRY_CORRECTIONS_MODAL_CLASS_NAME,
  TIME_ENTRY_CORRECTIONS_PRIMARY_BUTTON_CLASS_NAME,
  TIME_ENTRY_CORRECTIONS_SECONDARY_BUTTON_CLASS_NAME,
  TIME_ENTRY_CORRECTIONS_OVERLAY_CLASS_NAME,
} from '../styles';
import type { TimeEntryCorrectionsClientOption, TimeEntryCorrectionsEditDraft } from '../types';

interface TimeEntryCorrectionsEditDialogProps {
  editing: TimeEntryCorrectionsEditDraft;
  editClients: TimeEntryCorrectionsClientOption[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onChange: (
    updater: (current: TimeEntryCorrectionsEditDraft) => TimeEntryCorrectionsEditDraft
  ) => void;
}

const TimeEntryCorrectionsEditDialog: React.FC<TimeEntryCorrectionsEditDialogProps> = ({
  editing,
  editClients,
  saving,
  onClose,
  onSave,
  onChange,
}) => {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dateId = useId();
  const durationId = useId();
  const activityId = useId();
  const clientSelectId = useId();

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const main = document.getElementById('workspace-content');
    if (main) main.inert = true;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (dialogRef.current) trapFocusKeyDown(dialogRef.current, event);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (main) main.inert = false;
      previousFocusRef.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className={TIME_ENTRY_CORRECTIONS_OVERLAY_CLASS_NAME}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={TIME_ENTRY_CORRECTIONS_MODAL_CLASS_NAME}
      >
        <div className="flex items-center justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold text-tt-text">
            {translateUi('Editar lancamento #')} {editing.id}
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="tt-btn-secondary min-h-touch px-3 text-sm"
            aria-label={translateUi('Fechar')}
          >
            {translateUi('Fechar')}
          </button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-[0.12em] text-tt-text-muted" htmlFor={clientSelectId}>
              {translateUi('Cliente')}
            </label>
            <SearchableSelect
              id={clientSelectId}
              value={editing.clientId}
              onChange={(value) => onChange((prev) => ({ ...prev, clientId: Number(value) }))}
              className="w-full"
              options={editClients.map((option) => ({ value: option.id, label: option.name }))}
              placeholder={translateUi('Selecione um cliente')}
              searchPlaceholder={translateUi('Buscar cliente...')}
              ariaLabel={translateUi('Cliente')}
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-semibold uppercase tracking-[0.12em] text-tt-text-muted"
              htmlFor={dateId}
            >
              {translateUi('Data')}
            </label>
            <input
              id={dateId}
              type="date"
              value={editing.date}
              onChange={(event) => onChange((prev) => ({ ...prev, date: event.target.value }))}
              className={`w-full ${TIME_ENTRY_CORRECTIONS_INPUT_CLASS_NAME}`}
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-semibold uppercase tracking-[0.12em] text-tt-text-muted"
              htmlFor={durationId}
            >
              {translateUi('Duracao')}
            </label>
            <input
              id={durationId}
              type="text"
              value={editing.durationMinutes}
              onChange={(event) =>
                onChange((prev) => ({ ...prev, durationMinutes: event.target.value }))
              }
              className={`w-full ${TIME_ENTRY_CORRECTIONS_INPUT_CLASS_NAME}`}
              placeholder="Ex: 480, 8h, 1h 30m"
              aria-describedby={`${durationId}-hint`}
            />
            <p id={`${durationId}-hint`} className="text-xs text-tt-text-muted">
              {TIME_ENTRY_CORRECTIONS_DEFAULT_DURATION_HINT}
            </p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label
              className="text-xs font-semibold uppercase tracking-[0.12em] text-tt-text-muted"
              htmlFor={activityId}
            >
              {translateUi('Atividade')}
            </label>
            <textarea
              id={activityId}
              value={editing.activityDescription}
              onChange={(event) =>
                onChange((prev) => ({ ...prev, activityDescription: event.target.value }))
              }
              rows={3}
              className={`w-full ${TIME_ENTRY_CORRECTIONS_INPUT_CLASS_NAME}`}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={TIME_ENTRY_CORRECTIONS_PRIMARY_BUTTON_CLASS_NAME}
            aria-busy={saving}
          >
            {translateUi('Salvar alteracoes')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={TIME_ENTRY_CORRECTIONS_SECONDARY_BUTTON_CLASS_NAME}
          >
            {translateUi('Cancelar')}
          </button>
        </div>
      </section>
    </div>
  );
};

export default TimeEntryCorrectionsEditDialog;
