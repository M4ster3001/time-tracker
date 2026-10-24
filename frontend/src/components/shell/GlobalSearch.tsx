import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCapabilities } from '../../contexts/CapabilitiesContext';
import { trapFocusKeyDown } from '../../hooks/focusTrap';
import { text, useLocale } from '../../i18n';
import EmptyState from '../EmptyState';
import {
  buildGlobalSearchItems,
  filterGlobalSearchItems,
  kindLabel,
  type GlobalSearchItem,
} from './globalSearch.catalog';
import { helpTopicsForFlows } from './help.catalog';
import { useShellChrome } from './ShellChromeContext';

const isModK = (event: KeyboardEvent): boolean =>
  (event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey);

export const GlobalSearch: React.FC = () => {
  const locale = useLocale();
  const navigate = useNavigate();
  const { capabilities, can, canVisit, error } = useCapabilities();
  const { openHelp, searchOpen: open, setSearchOpen } = useShellChrome();
  const setOpen = setSearchOpen;
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const suppressOpenOnFocusRef = useRef(false);
  const panelId = useId();
  const listboxId = useId();

  const catalog = useMemo(
    () =>
      buildGlobalSearchItems({
        locale,
        navigation: capabilities?.navigation ?? [],
        flows: capabilities?.flows,
        canVisit,
        can,
        helpTopics: helpTopicsForFlows(capabilities?.flows),
      }),
    [locale, capabilities?.navigation, capabilities?.flows, canVisit, can]
  );

  const results = useMemo(
    () => filterGlobalSearchItems(catalog, query),
    [catalog, query]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModK(event)) return;
      event.preventDefault();
      setOpen(true);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const closeSearch = (options?: { restoreFocus?: boolean }) => {
    setOpen(false);
    setQuery('');
    if (options?.restoreFocus) {
      suppressOpenOnFocusRef.current = true;
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSearch({ restoreFocus: true });
        return;
      }
      const root = panelRef.current;
      if (root && event.key === 'Tab') {
        trapFocusKeyDown(root, event);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const runItem = (item: GlobalSearchItem) => {
    closeSearch();
    if (item.kind === 'help' && item.helpId) {
      openHelp(item.helpId);
      return;
    }
    if (item.path) {
      if (item.path.startsWith('/settings?tab=help')) {
        const topic = new URLSearchParams(item.path.split('?')[1] ?? '').get('topic');
        openHelp(topic ?? undefined);
        return;
      }
      navigate(item.path);
    }
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(Math.max(results.length - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = results[activeIndex];
      if (item) runItem(item);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch({ restoreFocus: true });
    }
  };

  const shortcutHint = text('Ctrl+K', '⌘K');

  return (
    <div className="relative flex min-w-0 flex-1 items-center" data-testid="global-search" ref={panelRef}>
      <label className="sr-only" htmlFor={panelId}>
        {text('Busca global', 'Global search')}
      </label>
      <div className="relative w-full min-w-0">
        <span
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tt-text-muted"
          aria-hidden="true"
        >
          ⌕
        </span>
        <input
          id={panelId}
          ref={inputRef}
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={
            open && results[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined
          }
          value={query}
          placeholder={text(
            'Digite para buscar um item de menu…',
            'Type to find a menu item…'
          )}
          className="workspace-input w-full min-h-touch pl-9 pr-16"
          onFocus={() => {
            if (suppressOpenOnFocusRef.current) {
              suppressOpenOnFocusRef.current = false;
              return;
            }
            setOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
        />
        <kbd
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-tt border border-tt-border bg-tt-elevated px-2 py-0.5 font-mono text-xs text-tt-text-muted sm:inline"
          aria-hidden="true"
        >
          {shortcutHint}
        </kbd>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label={text('Fechar busca', 'Close search')}
            tabIndex={-1}
            onClick={() => closeSearch({ restoreFocus: true })}
          />
          <div
            className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(24rem,60vh)] overflow-y-auto rounded-tt border border-tt-border bg-tt-surface p-2 shadow-tt"
            role="presentation"
          >
            {error ? (
              <EmptyState
                variant="error"
                title={text('Não foi possível carregar permissões', 'Could not load permissions')}
                description={text(
                  'A busca só mostra destinos permitidos. Tente novamente mais tarde.',
                  'Search only shows allowed destinations. Try again later.'
                )}
                className="py-6"
              />
            ) : results.length === 0 ? (
              <EmptyState
                variant="no-results"
                title={text('Nenhum resultado', 'No results')}
                description={text(
                  'Tente outro termo ou abra a Ajuda pelo botão no topo.',
                  'Try another term or open Help from the top bar.'
                )}
                className="py-6"
              />
            ) : (
              <ul id={listboxId} role="listbox" className="space-y-1">
                {results.map((item, index) => {
                  const active = index === activeIndex;
                  return (
                    <li key={item.id} role="presentation">
                      <button
                        type="button"
                        id={`${listboxId}-option-${index}`}
                        role="option"
                        aria-selected={active}
                        className={`flex w-full min-h-touch items-start justify-between gap-3 rounded-tt px-3 py-2 text-left text-sm ${
                          active
                            ? 'bg-tt-selection text-tt-text'
                            : 'text-tt-text hover:bg-tt-elevated'
                        }`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => runItem(item)}
                      >
                        <span className="min-w-0">
                          <span className="block font-medium">{item.label}</span>
                          <span className="mt-0.5 block text-xs text-tt-text-muted">
                            {item.description}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-tt border border-tt-border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-tt-text-muted">
                          {kindLabel(item.kind, locale)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};

export default GlobalSearch;
