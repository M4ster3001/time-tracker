import { translate as translateUi } from '../../../../i18n';
import React from 'react';
import Pagination from '../../../../components/Pagination';
import { formatDate, formatMinutes } from '../../../../utils/formatters';
import {
  TIME_ENTRY_CORRECTIONS_EMPTY_MESSAGE,
  TIME_ENTRY_CORRECTIONS_LOADING_MESSAGE,
} from '../constants';
import {
  TIME_ENTRY_CORRECTIONS_BADGE_BASE_CLASS_NAME,
  TIME_ENTRY_CORRECTIONS_LIST_ITEM_CLASS_NAME,
  TIME_ENTRY_CORRECTIONS_SECTION_CLASS_NAME,
} from '../styles';
import type { TimeEntryCorrectionsSupervisedEntry } from '../types';

interface TimeEntryCorrectionsListProps {
  entries: TimeEntryCorrectionsSupervisedEntry[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onEdit: (entry: TimeEntryCorrectionsSupervisedEntry) => void;
  onDelete: (entry: TimeEntryCorrectionsSupervisedEntry) => void;
}

const TimeEntryCorrectionsList: React.FC<TimeEntryCorrectionsListProps> = ({
  entries,
  total,
  page,
  pageSize,
  loading,
  error,
  onPageChange,
  onPageSizeChange,
  onEdit,
  onDelete,
}) => {
  return (
    <section className={TIME_ENTRY_CORRECTIONS_SECTION_CLASS_NAME}>
      {loading ? (
        <p className="text-sm text-tt-text-muted">{TIME_ENTRY_CORRECTIONS_LOADING_MESSAGE}</p>
      ) : null}
      {!loading && error ? <p className="text-sm text-tt-danger">{error}</p> : null}
      {!loading && !error && entries.length === 0 ? (
        <p className="text-sm text-tt-text-muted">{TIME_ENTRY_CORRECTIONS_EMPTY_MESSAGE}</p>
      ) : null}

      {!loading && !error && entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className={TIME_ENTRY_CORRECTIONS_LIST_ITEM_CLASS_NAME}>
              <div>
                <p className="text-sm font-semibold text-tt-text">{entry.activityDescription}</p>
                <p className="text-xs text-tt-text-muted">
                  {formatDate(entry.date)} · {entry.user.name} · {entry.client.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-tt-action">
                  {formatMinutes(entry.durationMinutes)}
                </span>
                <span
                  className={`${TIME_ENTRY_CORRECTIONS_BADGE_BASE_CLASS_NAME} ${
                    entry.locked
                      ? 'bg-tt-elevated text-tt-warning'
                      : 'bg-tt-success-soft text-tt-action'
                  }`}
                >
                  {entry.locked ? 'Fechado' : 'Aberto'}
                </span>
                {entry.source === 'API' ? (
                  <span
                    className={`${TIME_ENTRY_CORRECTIONS_BADGE_BASE_CLASS_NAME} bg-tt-info-soft text-tt-info`}
                  >
                    {translateUi('Via API')}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => onEdit(entry)}
                  className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning hover:bg-tt-warning-soft"
                >
                  {translateUi('Editar')}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(entry)}
                  className="rounded-full border border-tt-border px-3 py-1 text-xs text-tt-warning hover:bg-tt-warning-soft"
                >
                  {translateUi('Excluir')}
                </button>
              </div>
            </div>
          ))}

          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      ) : null}
    </section>
  );
};

export default TimeEntryCorrectionsList;
