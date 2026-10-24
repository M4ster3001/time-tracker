import React from 'react';
import SearchableSelect from '../../../../components/SearchableSelect';
import StateBanner from '../../../../components/StateBanner';
import FormField from '../../../../components/FormField';
import { FieldInput, FieldTextarea } from '../../../../components/FormControls';
import { formatMinutes } from '../../../../utils/formatters';
import { text } from '../../../../i18n';
import type {
  ClientOption,
  ProjectOption,
  TimeEntryAiStatus,
  TimeEntryDurationContract,
  TimeEntryLockStatus,
} from '../types/timeEntry.types';
import { timeEntryFormClassName, timeEntryGridClassName } from '../styles/timeEntry.styles';

interface TimeEntryFormProps {
  isEditing: boolean;
  clients: ClientOption[];
  projects: ProjectOption[];
  projectsEnabled: boolean;
  canConfirmDuration: boolean;
  confirmJustification: string;
  onConfirmJustificationChange: (value: string) => void;
  onConfirmDuration: () => void;
  clientId: number;
  onClientChange: (value: number) => void;
  projectId: number | null;
  onProjectChange: (value: number | null) => void;
  date: string;
  onDateChange: (value: string) => void;
  activityDescription: string;
  onActivityDescriptionChange: (value: string) => void;
  durationInput: string;
  onDurationInputChange: (value: string) => void;
  durations: TimeEntryDurationContract | null;
  parsedDurationMinutes: number | null;
  status: 'idle' | 'saving' | 'success' | 'error';
  error: string | null;
  fieldErrors: Record<string, string>;
  loadingEntry: boolean;
  aiStatus: TimeEntryAiStatus | null;
  todayInputDate: string;
  minSelectableDate: string | null;
  lockStatus: TimeEntryLockStatus | null;
  canPrivilegedCorrectLockedEntry: boolean;
  lockBlocked: boolean;
  lockHint?: string;
  onSubmit: (event: React.FormEvent) => void;
  onBack: () => void;
}

const TimeEntryForm: React.FC<TimeEntryFormProps> = ({
  isEditing,
  clients,
  projects,
  projectsEnabled,
  canConfirmDuration,
  confirmJustification,
  onConfirmJustificationChange,
  onConfirmDuration,
  clientId,
  onClientChange,
  projectId,
  onProjectChange,
  date,
  onDateChange,
  activityDescription,
  onActivityDescriptionChange,
  durationInput,
  onDurationInputChange,
  durations,
  parsedDurationMinutes,
  status,
  error,
  fieldErrors,
  loadingEntry,
  aiStatus,
  todayInputDate,
  minSelectableDate,
  lockStatus,
  canPrivilegedCorrectLockedEntry,
  lockBlocked,
  lockHint,
  onSubmit,
  onBack,
}) => {
  return (
    <form onSubmit={onSubmit} className={timeEntryFormClassName} data-testid="time-entry-form">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-tt-text">
          {isEditing
            ? text('Dados do lançamento', 'Entry details')
            : text('Novo lançamento', 'New time entry')}
        </h3>
        {aiStatus?.enabled ? (
          <span className="rounded-full bg-tt-success-soft px-3 py-1 text-xs font-semibold text-tt-success">
            {text('IA ativa', 'AI enabled')}
            {aiStatus.provider ? ` · ${aiStatus.provider}` : ''}
          </span>
        ) : null}
      </div>
      {loadingEntry ? (
        <StateBanner
          tone="info"
          message={text('Carregando lançamento...', 'Loading time entry...')}
          className="mb-4"
        />
      ) : null}
      <div className={timeEntryGridClassName}>
        <FieldInput
          label={text('Data', 'Date')}
          id="time-entry-date"
          type="date"
          value={date}
          onChange={(event) => onDateChange(event.target.value)}
          min={minSelectableDate ?? undefined}
          max={todayInputDate}
          error={fieldErrors.date}
          hint={lockHint}
          inputClassName="[color-scheme:light] dark:bg-tt-elevated dark:text-tt-text"
        />

        <FormField
          label={text('Cliente', 'Client')}
          htmlFor="time-entry-client"
          error={fieldErrors.clientId}
        >
          <SearchableSelect
            id="time-entry-client"
            value={clientId}
            onChange={(value) => onClientChange(Number(value))}
            className="w-full"
            disabled={clients.length === 0}
            options={[
              {
                value: 0,
                label:
                  clients.length === 0
                    ? text('Sem clientes disponíveis', 'No clients available')
                    : text('Selecione um cliente', 'Select a client'),
              },
              ...clients.map((client) => ({ value: client.id, label: client.name })),
            ]}
            placeholder={
              clients.length === 0
                ? text('Sem clientes disponíveis', 'No clients available')
                : text('Selecione um cliente', 'Select a client')
            }
            searchPlaceholder={text('Buscar cliente...', 'Search clients...')}
          />
        </FormField>

        {projectsEnabled ? (
          <FormField
            label={text('Projeto', 'Project')}
            htmlFor="time-entry-project"
            error={fieldErrors.projectId}
            hint={
              clients.find((c) => c.id === clientId)?.requireProjectOnEntries
                ? text(
                    'Obrigatório para este cliente.',
                    'Required for this client.'
                  )
                : text(
                    'Opcional. Sem projeto mantém o lançamento só no cliente.',
                    'Optional. Leave empty to keep the entry on the client only.'
                  )
            }
          >
            <SearchableSelect
              id="time-entry-project"
              value={projectId ?? 0}
              onChange={(value) => onProjectChange(Number(value) || null)}
              className="w-full"
              options={[
                ...(clients.find((c) => c.id === clientId)?.requireProjectOnEntries
                  ? []
                  : [{ value: 0, label: text('Sem projeto', 'No project') }]),
                ...projects.map((project) => ({
                  value: project.id,
                  label: `${project.code} — ${project.name}`,
                })),
              ]}
              placeholder={
                clients.find((c) => c.id === clientId)?.requireProjectOnEntries
                  ? text('Selecione um projeto', 'Select a project')
                  : text('Sem projeto', 'No project')
              }
              searchPlaceholder={text('Buscar projeto...', 'Search projects...')}
            />
          </FormField>
        ) : null}

        <FieldTextarea
          label={text('Atividade', 'Activity')}
          id="time-entry-activity"
          value={activityDescription}
          onChange={(event) => onActivityDescriptionChange(event.target.value)}
          className="md:col-span-2"
          textareaClassName="h-28 py-3"
          error={fieldErrors.activityDescription}
          placeholder={text('Descreva o que foi feito', 'Describe the work completed')}
        />

        <FieldInput
          label={text('Duração confirmada / declarada', 'Confirmed / declared duration')}
          id="time-entry-duration"
          type="text"
          value={durationInput}
          onChange={(event) => onDurationInputChange(event.target.value)}
          error={fieldErrors.durationMinutes}
          hint={
            parsedDurationMinutes === null
              ? text(
                  'Use formatos como 90m, 1h, 1h 30m, 2 hr, 45 minutes',
                  'Use formats such as 90m, 1h, 1h 30m, 2 hr, 45 minutes'
                )
              : `${text('Equivale a', 'Equivalent to')} ${formatMinutes(parsedDurationMinutes)}. ${
                  durations?.actualTrackedStatus === 'NOT_TRACKED' || !durations
                    ? text('Não medido', 'Not tracked')
                    : text('Com medição', 'Tracked')
                }`
          }
          inputClassName="py-3"
          placeholder="Ex: 1h 30m, 90m, 2 hr"
          title="Exemplos: 1h, 1h 30m, 90m, 2 hr, 45 minutes"
        />

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={
              status === 'saving' ||
              !clientId ||
              activityDescription.length < 3 ||
              parsedDurationMinutes === null ||
              (lockBlocked && !canPrivilegedCorrectLockedEntry)
            }
            className="tt-btn-primary w-full disabled:cursor-not-allowed"
          >
            {status === 'saving'
              ? text('Salvando...', 'Saving...')
              : isEditing
                ? text('Salvar alterações', 'Save changes')
                : text('Salvar lançamento', 'Save time entry')}
          </button>
          {isEditing && canConfirmDuration ? (
            <div className="space-y-2">
              <label className="workspace-label" htmlFor="confirm-duration-justification">
                {text('Justificativa da confirmação (opcional)', 'Confirmation justification (optional)')}
                <textarea
                  id="confirm-duration-justification"
                  className="workspace-input mt-1 min-h-[4.5rem]"
                  value={confirmJustification}
                  onChange={(e) => onConfirmJustificationChange(e.target.value)}
                  maxLength={2000}
                  disabled={status === 'saving' || lockBlocked}
                />
              </label>
              <button
                type="button"
                onClick={onConfirmDuration}
                disabled={status === 'saving' || parsedDurationMinutes === null || lockBlocked}
                className="tt-btn-secondary w-full disabled:cursor-not-allowed"
              >
                {text('Confirmar duração', 'Confirm duration')}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {durations ? (
        <div
          className="tt-duration-panel"
          role="group"
          aria-label={text('Durações do lançamento', 'Entry durations')}
        >
          <div>
            <strong id="duration-estimated-label">
              {text('Duração estimada', 'Estimated Duration')}
            </strong>
            <div className="tt-duration-value" aria-labelledby="duration-estimated-label">
              {durations.estimatedMinutes == null
                ? text('—', '—')
                : formatMinutes(durations.estimatedMinutes)}
            </div>
          </div>
          <div>
            <strong id="duration-confirmed-label">
              {text('Duração confirmada', 'Confirmed Duration')}
            </strong>
            <div className="tt-duration-value" aria-labelledby="duration-confirmed-label">
              {durations.confirmedMinutes == null
                ? durations.legacyDeclaredMinutes != null
                  ? `${formatMinutes(durations.legacyDeclaredMinutes)} (${text('legado', 'legacy')})`
                  : text('—', '—')
                : formatMinutes(durations.confirmedMinutes)}
            </div>
          </div>
          <div>
            <strong id="duration-tracked-label">
              {text('Duração medida', 'Actual Tracked Duration')}
            </strong>
            <div className="tt-duration-value" aria-labelledby="duration-tracked-label">
              {durations.actualTrackedStatus === 'NOT_TRACKED'
                ? text('Não medido', 'Not tracked')
                : formatMinutes(durations.actualTrackedMinutes ?? 0)}
            </div>
          </div>
        </div>
      ) : null}

      {status === 'success' ? (
        <StateBanner
          tone="success"
          className="mt-4"
          message={
            isEditing
              ? text('Lançamento atualizado com sucesso.', 'Time entry updated.')
              : text('Lançamento registrado com sucesso.', 'Time entry saved.')
          }
        />
      ) : null}
      {status === 'error' && error ? (
        <StateBanner tone="error" className="mt-4" message={error} />
      ) : null}
      {lockStatus?.locked && !lockStatus?.temporaryUnlock && !canPrivilegedCorrectLockedEntry ? (
        <StateBanner
          tone="warning"
          className="mt-4"
          message={text(
            'Fechamento ativo. Edições do mês selecionado estão bloqueadas.',
            'The selected period is locked.'
          )}
        />
      ) : null}
      {lockBlocked && canPrivilegedCorrectLockedEntry ? (
        <StateBanner
          tone="info"
          className="mt-4"
          message={text(
            'Correção supervisionada. Períodos aprovados exigem desbloqueio temporário.',
            'Supervised correction. Approved periods require a temporary unlock.'
          )}
        />
      ) : null}
      {lockStatus?.locked && lockStatus?.temporaryUnlock ? (
        <StateBanner
          tone="success"
          className="mt-4"
          message={text(
            'Desbloqueio temporário ativo para corrigir este cliente e período.',
            'A temporary unlock allows corrections for this client and period.'
          )}
        />
      ) : null}
      {isEditing ? (
        <button
          type="button"
          onClick={onBack}
          className="mt-4 min-h-touch text-sm font-semibold text-tt-link underline-offset-2 hover:underline"
        >
          {text('Voltar ao histórico', 'Back to history')}
        </button>
      ) : null}
    </form>
  );
};

export default TimeEntryForm;
