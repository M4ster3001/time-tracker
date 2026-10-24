import { translate as translateUi } from '../../../i18n';
import React from 'react';
import type { ClientLinkRow, ScopeOption } from './allocation.types';

export interface PersonForm {
  name: string;
  email: string;
  isActive: boolean;
}

export interface PersonManagerSelect {
  managerId: number;
  managerOptions: ScopeOption[];
  onManagerChange: (managerId: number) => void;
}

export interface PersonDetailsEditorProps {
  /** Ex: "manager" / "consultor" — usado no titulo e no rotulo do checkbox. */
  personLabel: string;
  form: PersonForm;
  onFormChange: (updater: (prev: PersonForm) => PersonForm) => void;
  onSave: () => void;
  saving: boolean;
  /** Presente somente quando a pessoa pode ser reatribuida a outro manager (consultor). */
  managerSelect?: PersonManagerSelect;
  clients: ClientLinkRow[];
  selectedClientIds: number[];
  onToggleClient: (clientId: number) => void;
}

/**
 * Bloco "Editar dados do manager/consultor" + vinculo de clientes.
 * Presentational puro: identico entre as telas de managers e consultores do admin,
 * variando so o rotulo e a presenca opcional do seletor de manager.
 */
const PersonDetailsEditor: React.FC<PersonDetailsEditorProps> = ({
  personLabel,
  form,
  onFormChange,
  onSave,
  saving,
  managerSelect,
  clients,
  selectedClientIds,
  onToggleClient,
}) => {
  return (
    <div className="rounded-tt border border-tt-border bg-tt-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
            {personLabel.charAt(0).toUpperCase() + personLabel.slice(1)}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-tt-text">
            {translateUi('Editar dados do')} {personLabel}
          </h3>
        </div>
        {!form.isActive ? (
          <span className="rounded-full bg-tt-danger-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-tt-danger">
            {translateUi('Inativo')}
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <input
          value={form.name}
          onChange={(event) => onFormChange((prev) => ({ ...prev, name: event.target.value }))}
          placeholder={translateUi('Nome')}
          className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
        />
        <input
          value={form.email}
          onChange={(event) => onFormChange((prev) => ({ ...prev, email: event.target.value }))}
          placeholder="Email"
          className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
        />
        {managerSelect ? (
          <select
            value={managerSelect.managerId}
            onChange={(event) => managerSelect.onManagerChange(Number(event.target.value))}
            className="rounded-tt border border-tt-border bg-tt-surface px-4 py-2 text-sm"
          >
            <option value={0}>{translateUi('Sem manager')}</option>
            {managerSelect.managerOptions.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-tt-text">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              onFormChange((prev) => ({ ...prev, isActive: event.target.checked }))
            }
          />
          {personLabel.charAt(0).toUpperCase() + personLabel.slice(1)}
          {translateUi('ativo')}
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-2xl bg-tt-action px-4 py-2 text-sm font-semibold text-tt-on-action disabled:opacity-60"
        >
          {saving ? translateUi('Salvando...') : `Salvar ${personLabel}`}
        </button>
      </div>
      {clients.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-tt-border bg-tt-elevated p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-tt-warning">
            {translateUi('Clientes vinculados')}
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {clients.map((client) => (
              <label key={client.id} className="flex items-center gap-2 text-sm text-tt-text">
                <input
                  type="checkbox"
                  checked={selectedClientIds.includes(client.id)}
                  onChange={() => onToggleClient(client.id)}
                  disabled={!client.isActive}
                />
                <span className={client.isActive ? '' : 'text-tt-text-muted'}>{client.name}</span>
                {!client.isActive ? (
                  <span className="rounded-full bg-tt-elevated px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-tt-text-muted">
                    {translateUi('Inativo')}
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PersonDetailsEditor;
