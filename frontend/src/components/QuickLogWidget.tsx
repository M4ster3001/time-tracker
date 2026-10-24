import { text } from '../i18n';
import React, { useEffect, useMemo, useState } from 'react';
import { parseDurationToMinutes } from '../utils/formatters';
import SearchableSelect from './SearchableSelect';
import FormField from './FormField';
import StateBanner from './StateBanner';
import { FieldInput } from './FormControls';
import {
  applyQuickLogSuggestion,
  type QuickLogActivitySuggestion as ActivitySuggestion,
  FALLBACK_QUICK_LOG_SUGGESTIONS,
  resolveQuickLogActivityOptions,
} from './quickLogWidget.logic';

interface ClientOption {
  id: number;
  name: string;
}

interface QuickLogWidgetProps {
  clients: ClientOption[];
  activities: ActivitySuggestion[];
  aiStatus?: { enabled: boolean; provider?: string | null };
  onSave: (payload: {
    clientId: number;
    activityDescription: string;
    durationMinutes: number;
  }) => Promise<void>;
  loadSuggestions?: (clientId?: number) => Promise<ActivitySuggestion[]>;
}
const QUICK_DURATIONS = [15, 30, 60, 120, 240];
const COLLAPSED_SUGGESTIONS = 4;

const chipBaseClass =
  'rounded-full border px-3 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-focus';
const chipIdleClass = 'border-tt-border text-tt-text-muted hover:border-tt-action hover:text-tt-text';
const chipActiveClass = 'border-tt-action bg-tt-action text-tt-on-action';

const QuickLogWidget: React.FC<QuickLogWidgetProps> = ({
  clients,
  activities,
  aiStatus,
  onSave,
  loadSuggestions,
}) => {
  const [activity, setActivity] = useState('');
  const [duration, setDuration] = useState(30);
  const [customDuration, setCustomDuration] = useState('');
  const [clientId, setClientId] = useState<number>(clients[0]?.id ?? 0);
  const [activitySuggestions, setActivitySuggestions] = useState<ActivitySuggestion[]>(activities);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [hasManualDurationEdit, setHasManualDurationEdit] = useState(false);
  const [durationFieldFocused, setDurationFieldFocused] = useState(false);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCustomDuration = customDuration.trim().length > 0;
  const parsedCustomDuration = hasCustomDuration ? parseDurationToMinutes(customDuration) : null;
  const selectedDuration = hasCustomDuration ? parsedCustomDuration : duration;
  const canSubmit =
    clientId > 0 && activity.trim().length > 2 && selectedDuration !== null && selectedDuration > 0;

  const clientOptions = useMemo(() => clients, [clients]);
  const activityOptions = useMemo(
    () => resolveQuickLogActivityOptions(activitySuggestions),
    [activitySuggestions]
  );
  const suggestionsCount = activityOptions.length;

  useEffect(() => {
    if (clients.length > 0 && clientId === 0) {
      setClientId(clients[0].id);
    }
  }, [clients, clientId]);

  useEffect(() => {
    setActivitySuggestions(activities);
  }, [activities]);

  useEffect(() => {
    if (!loadSuggestions || clientId <= 0) return;

    let active = true;
    void loadSuggestions(clientId)
      .then((nextSuggestions) => {
        if (!active) return;
        setActivitySuggestions(nextSuggestions);
      })
      .catch(() => {
        if (!active) return;
        setActivitySuggestions(activities.length > 0 ? activities : FALLBACK_QUICK_LOG_SUGGESTIONS);
      });

    return () => {
      active = false;
    };
  }, [clientId, loadSuggestions]);

  const handleSave = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave({
        clientId,
        activityDescription: activity.trim(),
        durationMinutes: selectedDuration as number,
      });
      setActivity('');
      setCustomDuration('');
      setDuration(30);
      setSelectedSuggestion(null);
      setHasManualDurationEdit(false);
      if (loadSuggestions && clientId > 0) {
        const nextSuggestions = await loadSuggestions(clientId).catch(() => activitySuggestions);
        setActivitySuggestions(nextSuggestions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : text('Falha ao salvar', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const applySuggestion = (item: ActivitySuggestion) => {
    const nextState = applyQuickLogSuggestion({
      activity,
      duration,
      customDuration,
      hasManualDurationEdit,
      suggestion: item,
    });
    setActivity(nextState.activity);
    setDuration(nextState.duration);
    setCustomDuration(nextState.customDuration);
    setHasManualDurationEdit(nextState.hasManualDurationEdit);
    setSelectedSuggestion(nextState.selectedSuggestion);
  };

  const durationHint = durationFieldFocused
    ? selectedSuggestion
      ? text(
          `Sugestão para "${selectedSuggestion}": ${duration}m. Use h, hr, hour, m ou min.`,
          `Suggestion for "${selectedSuggestion}": ${duration}m. Use h, hr, hour, m or min.`
        )
      : text('Use h, hr, hour, m ou min.', 'Use h, hr, hour, m or min.')
    : undefined;

  const submitLabel = saving
    ? text('Salvando...', 'Saving...')
    : selectedDuration && selectedDuration > 0
      ? text(`Registrar ${selectedDuration}m`, `Log ${selectedDuration}m`)
      : text('Registrar', 'Log time');

  return (
    <div className="rounded-tt border border-tt-border bg-tt-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-tt-text">
          {text('Lançamento rápido', 'Quick entry')}
        </h3>
        {aiStatus?.enabled ? (
          <span className="rounded-full bg-tt-success-soft px-3 py-1 text-xs font-semibold text-tt-success">
            {text('IA ativa', 'AI on')}
            {aiStatus.provider ? ` · ${aiStatus.provider}` : ''}
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        <FormField label={text('Cliente', 'Client')} htmlFor="quick-log-client">
          <SearchableSelect
            id="quick-log-client"
            value={clientId}
            onChange={(value) => {
              setClientId(Number(value));
              setSelectedSuggestion(null);
            }}
            options={[
              { value: 0, label: text('Selecione um cliente', 'Select a client') },
              ...clientOptions.map((client) => ({ value: client.id, label: client.name })),
            ]}
            placeholder={text('Selecione um cliente', 'Select a client')}
            searchPlaceholder={text('Buscar cliente...', 'Search client...')}
            className="w-full"
          />
        </FormField>

        <div className="space-y-2">
          <FieldInput
            label={text('Atividade', 'Activity')}
            id="quick-log-activity"
            value={activity}
            onChange={(event) => {
              setActivity(event.target.value);
              setSelectedSuggestion(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canSubmit && !saving) {
                event.preventDefault();
                void handleSave();
              }
            }}
            placeholder={text('Descreva a atividade', 'Describe the activity')}
            inputClassName="py-3"
          />

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-tt-text-muted">
              {text('Recentes', 'Recent')} · {suggestionsCount}
            </p>
            {suggestionsCount > COLLAPSED_SUGGESTIONS ? (
              <button
                type="button"
                onClick={() => setShowAllSuggestions((prev) => !prev)}
                aria-expanded={showAllSuggestions}
                className="text-xs font-semibold text-tt-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-focus"
              >
                {showAllSuggestions ? text('Ver menos', 'Show less') : text('Ver todas', 'Show all')}
              </button>
            ) : null}
          </div>
          <div
            className={
              showAllSuggestions
                ? 'flex flex-wrap gap-2'
                : 'flex gap-2 overflow-x-auto pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none]'
            }
          >
            {activityOptions.map((item) => (
              <button
                key={`${item.name}-${item.source}`}
                type="button"
                title={item.name}
                onClick={() => applySuggestion(item)}
                className={`${chipBaseClass} max-w-[15rem] shrink-0 truncate ${
                  selectedSuggestion === item.name || activity === item.name
                    ? chipActiveClass
                    : chipIdleClass
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {QUICK_DURATIONS.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setDuration(mins);
                  setCustomDuration('');
                  setHasManualDurationEdit(true);
                }}
                className={`${chipBaseClass} ${
                  duration === mins && !hasCustomDuration ? chipActiveClass : chipIdleClass
                }`}
              >
                {mins}m
              </button>
            ))}
          </div>
          <FieldInput
            label={text('Duração personalizada', 'Custom duration')}
            id="quick-log-duration"
            value={customDuration}
            onChange={(event) => {
              setCustomDuration(event.target.value);
              setHasManualDurationEdit(true);
            }}
            onFocus={() => setDurationFieldFocused(true)}
            onBlur={() => setDurationFieldFocused(false)}
            placeholder={text('Ex.: 1h 30m, 90m, 2hr', 'E.g. 1h 30m, 90m, 2hr')}
            inputClassName="py-3"
            hint={durationHint}
            error={
              hasCustomDuration && parsedCustomDuration === null
                ? text(
                    'Duração inválida. Ex.: 1h 30m, 90m, 2hr',
                    'Invalid duration. E.g. 1h 30m, 90m, 2hr'
                  )
                : null
            }
          />
        </div>

        {error ? <StateBanner tone="error" message={error} /> : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSubmit || saving}
          className="w-full rounded-2xl bg-tt-action px-4 py-3 text-sm font-semibold text-tt-on-action transition hover:bg-tt-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tt-focus focus-visible:ring-offset-2 focus-visible:ring-offset-tt-surface disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
};

export default QuickLogWidget;
