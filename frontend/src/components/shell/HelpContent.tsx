import React, { useMemo } from 'react';
import { useCapabilities } from '../../contexts/CapabilitiesContext';
import { text, useLocale } from '../../i18n';
import EmptyState from '../EmptyState';
import { getHelpTopic, helpTopicsForFlows, type HelpTopic } from './help.catalog';

type HelpContentProps = {
  topicId?: string | null;
  onSelectTopic?: (id: string) => void;
  compact?: boolean;
};

const topicTitle = (topic: HelpTopic, locale: 'pt-BR' | 'en'): string =>
  locale === 'en' ? topic.titleEn : topic.titlePt;

const topicSummary = (topic: HelpTopic, locale: 'pt-BR' | 'en'): string =>
  locale === 'en' ? topic.summaryEn : topic.summaryPt;

const topicBody = (topic: HelpTopic, locale: 'pt-BR' | 'en'): string[] =>
  locale === 'en' ? topic.bodyEn : topic.bodyPt;

export const HelpContent: React.FC<HelpContentProps> = ({
  topicId,
  onSelectTopic,
  compact = false,
}) => {
  const locale = useLocale();
  const { capabilities } = useCapabilities();
  const topics = useMemo(
    () => helpTopicsForFlows(capabilities?.flows),
    [capabilities?.flows]
  );
  const selected = topicId ? getHelpTopic(topicId) : null;
  const visibleSelected =
    selected && (!selected.requireFlow || capabilities?.flows?.[selected.requireFlow])
      ? selected
      : null;

  if (visibleSelected) {
    return (
      <article className="space-y-4">
        {onSelectTopic ? (
          <button
            type="button"
            className="tt-btn-secondary min-h-touch px-3 text-sm"
            onClick={() => onSelectTopic('')}
          >
            {text('← Todos os tópicos', '← All topics')}
          </button>
        ) : null}
        <div>
          <h2 className="text-lg font-semibold text-tt-text">
            {topicTitle(visibleSelected, locale)}
          </h2>
          <p className="mt-1 text-sm text-tt-text-muted">
            {topicSummary(visibleSelected, locale)}
          </p>
        </div>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-tt-text">
          {topicBody(visibleSelected, locale).map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {visibleSelected.moreDetailDoc ? (
          <p className="rounded-tt border border-tt-border bg-tt-elevated p-3 text-xs text-tt-text-muted">
            {text(
              `Operadores: detalhe técnico em ${visibleSelected.moreDetailDoc} no repositório.`,
              `Operators: technical detail in ${visibleSelected.moreDetailDoc} in the repository.`
            )}
          </p>
        ) : null}
      </article>
    );
  }

  if (!topics.length) {
    return (
      <EmptyState
        variant="no-data"
        title={text('Ajuda indisponível', 'Help unavailable')}
        description={text(
          'Não há tópicos de ajuda para os fluxos ativos.',
          'No help topics for the active flows.'
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      {!compact ? (
        <div>
          <h2 className="text-lg font-semibold text-tt-text">
            {text('Ajuda do Time Tracker', 'Time Tracker Help')}
          </h2>
          <p className="mt-1 text-sm text-tt-text-muted">
            {text(
              'Guias curtos das rotinas principais. Use a busca global (Ctrl+K) para achar um tópico.',
              'Short guides for core routines. Use global search (Ctrl+K) to find a topic.'
            )}
          </p>
        </div>
      ) : null}
      <ul className="space-y-2">
        {topics.map((topic) => (
          <li key={topic.id}>
            <button
              type="button"
              className="tt-nav-link w-full text-left"
              onClick={() => onSelectTopic?.(topic.id)}
            >
              <span>
                <span className="block font-medium">{topicTitle(topic, locale)}</span>
                <span className="mt-0.5 block text-xs font-normal text-tt-text-muted">
                  {topicSummary(topic, locale)}
                </span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default HelpContent;
