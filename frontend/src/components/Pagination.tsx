import { translate as translateUi } from '../i18n';
import React, { useState, useCallback } from 'react';

interface PaginationProps {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  showGoToPage?: boolean;
}

const PAGE_SIZES = [10, 20, 50];

const controlClassName =
  'min-h-touch rounded-tt-control border border-tt-border bg-tt-surface px-3 py-1 text-tt-text disabled:cursor-not-allowed disabled:opacity-50';

const Pagination: React.FC<PaginationProps> = ({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  showGoToPage = true,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const start = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const end = total === 0 ? 0 : Math.min(total, clampedPage * pageSize);

  const [goToPageValue, setGoToPageValue] = useState('');

  const handleGoToPage = useCallback(
    (e: React.FormEvent | React.KeyboardEvent) => {
      e.preventDefault();
      const targetPage = parseInt(goToPageValue, 10);
      if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= totalPages) {
        onPageChange(targetPage);
        setGoToPageValue('');
      }
    },
    [goToPageValue, totalPages, onPageChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleGoToPage(e);
      }
    },
    [handleGoToPage]
  );

  return (
    <nav
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-tt-text-muted"
      role="navigation"
      aria-label="Paginação"
    >
      <div aria-live="polite" aria-atomic="true">
        {translateUi('Mostrando')} {start}-{end} {translateUi('de')} {total}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <label className="flex items-center gap-1">
            <span className="sr-only">{translateUi('Itens por pagina')}</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className={controlClassName}
              aria-label="Selecionar quantidade de itens por página"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                  {translateUi('/pagina')}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={clampedPage <= 1}
          className={controlClassName}
          aria-label="Ir para primeira página"
          title={translateUi('Primeira pagina')}
        >
          &laquo;
        </button>

        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, clampedPage - 1))}
          disabled={clampedPage <= 1}
          className={controlClassName}
          aria-label="Ir para página anterior"
        >
          {translateUi('Anterior')}
        </button>

        <span className="px-2 font-mono text-tt-text" aria-current="page">
          {clampedPage} / {totalPages}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, clampedPage + 1))}
          disabled={clampedPage >= totalPages}
          className={controlClassName}
          aria-label="Ir para próxima página"
        >
          {translateUi('Proxima')}
        </button>

        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={clampedPage >= totalPages}
          className={controlClassName}
          aria-label="Ir para última página"
          title={translateUi('Ultima pagina')}
        >
          &raquo;
        </button>

        {showGoToPage && totalPages > 1 ? (
          <form onSubmit={handleGoToPage} className="ml-2 flex items-center gap-1">
            <label htmlFor="go-to-page" className="sr-only">
              {translateUi('Ir para pagina')}
            </label>
            <input
              id="go-to-page"
              type="number"
              min={1}
              max={totalPages}
              value={goToPageValue}
              onChange={(e) => setGoToPageValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pg"
              className="min-h-touch w-14 rounded-tt-control border border-tt-border bg-tt-surface px-2 py-1 text-center text-xs text-tt-text"
              aria-label={`Ir para página (1 a ${totalPages})`}
              title={`Ir para página (1 a ${totalPages})`}
            />
            <button
              type="submit"
              className="min-h-touch rounded-tt-control border border-tt-border bg-tt-elevated px-2 py-1 text-tt-action hover:bg-tt-selection disabled:cursor-not-allowed disabled:opacity-50"
              disabled={
                !goToPageValue ||
                isNaN(parseInt(goToPageValue, 10)) ||
                parseInt(goToPageValue, 10) < 1 ||
                parseInt(goToPageValue, 10) > totalPages
              }
              aria-label="Ir para página especificada"
              title={translateUi('Ir')}
            >
              {translateUi('Ir')}
            </button>
          </form>
        ) : null}
      </div>
    </nav>
  );
};

export default Pagination;
