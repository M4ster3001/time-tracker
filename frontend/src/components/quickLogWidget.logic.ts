export interface QuickLogActivitySuggestion {
  name: string;
  suggestedDurationMinutes: number;
  usageCount: number;
  lastUsedAt: string | Date | null;
  source: 'client' | 'global' | 'default';
}

export interface QuickLogSuggestionApplicationInput {
  activity: string;
  duration: number;
  customDuration: string;
  hasManualDurationEdit: boolean;
  suggestion: QuickLogActivitySuggestion;
}

export interface QuickLogSuggestionApplicationResult {
  activity: string;
  duration: number;
  customDuration: string;
  hasManualDurationEdit: boolean;
  selectedSuggestion: string;
}

export const FALLBACK_QUICK_LOG_SUGGESTIONS: QuickLogActivitySuggestion[] = [
  {
    name: 'Desenvolvimento',
    suggestedDurationMinutes: 30,
    usageCount: 0,
    lastUsedAt: null,
    source: 'default',
  },
  {
    name: 'Reuniao',
    suggestedDurationMinutes: 30,
    usageCount: 0,
    lastUsedAt: null,
    source: 'default',
  },
  {
    name: 'Testes',
    suggestedDurationMinutes: 30,
    usageCount: 0,
    lastUsedAt: null,
    source: 'default',
  },
  {
    name: 'Documentacao',
    suggestedDurationMinutes: 30,
    usageCount: 0,
    lastUsedAt: null,
    source: 'default',
  },
  {
    name: 'Code Review',
    suggestedDurationMinutes: 30,
    usageCount: 0,
    lastUsedAt: null,
    source: 'default',
  },
];

export const resolveQuickLogActivityOptions = (
  suggestions: QuickLogActivitySuggestion[]
): QuickLogActivitySuggestion[] =>
  suggestions.length > 0 ? suggestions : FALLBACK_QUICK_LOG_SUGGESTIONS;

export const applyQuickLogSuggestion = (
  input: QuickLogSuggestionApplicationInput
): QuickLogSuggestionApplicationResult => ({
  activity: input.suggestion.name,
  duration: input.hasManualDurationEdit
    ? input.duration
    : input.suggestion.suggestedDurationMinutes,
  customDuration: input.hasManualDurationEdit ? input.customDuration : '',
  hasManualDurationEdit: false,
  selectedSuggestion: input.suggestion.name,
});
