import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FormField from './FormField';
import { filterSearchableOptions } from './searchable-select/searchableSelect.filter';
import { nextActiveIndex } from './searchable-select/searchableSelect.keyboard';

export interface SearchableSelectOption {
  label: string;
  value: number | string;
}

interface SearchableSelectProps {
  value: number | string;
  options: SearchableSelectOption[];
  onChange: (value: number | string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  searchInputClassName?: string;
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  id?: string;
  ariaLabel?: string;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Selecione uma opcao',
  searchPlaceholder = 'Buscar...',
  emptyMessage = 'Nenhum resultado encontrado.',
  disabled = false,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  searchInputClassName = '',
  label,
  hint,
  error,
  required = false,
  id,
  ariaLabel,
}) => {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const helperId = hint || error ? `${selectId}-help` : undefined;
  const listboxId = `${selectId}-menu`;
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(
    null
  );

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    return filterSearchableOptions(options, query);
  }, [options, query]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      if (wrapperRef.current?.contains(event.target)) return;
      if (dropdownRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const selectedIdx = filteredOptions.findIndex((option) => option.value === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      if (!wrapperRef.current) return;
      const rect = wrapperRef.current.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const closeMenu = (restoreFocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) {
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }
  };

  const selectOption = (optionValue: number | string) => {
    onChange(optionValue);
    closeMenu(true);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  };

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => nextActiveIndex(current, filteredOptions.length, 'down'));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => nextActiveIndex(current, filteredOptions.length, 'up'));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(nextActiveIndex(0, filteredOptions.length, 'home'));
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(nextActiveIndex(0, filteredOptions.length, 'end'));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) selectOption(option.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    } else if (event.key === 'Tab') {
      closeMenu(false);
    }
  };

  const activeOptionId =
    open && filteredOptions[activeIndex]
      ? `${listboxId}-option-${activeIndex}`
      : undefined;

  const button = (
    <button
      ref={buttonRef}
      id={selectId}
      type="button"
      onClick={() => setOpen((prev) => !prev)}
      onKeyDown={onTriggerKeyDown}
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      aria-describedby={helperId}
      aria-label={ariaLabel ?? label}
      aria-invalid={Boolean(error)}
      className={`flex min-h-touch w-full items-center justify-between rounded-tt-control border border-tt-border bg-tt-surface px-4 py-2 text-left text-sm text-tt-text outline-none transition focus-visible:border-tt-action focus-visible:ring-2 focus-visible:ring-tt-focus/25 disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`.trim()}
    >
      <span className="truncate">{selectedOption?.label ?? placeholder}</span>
      <span className="ml-3 text-tt-text-muted" aria-hidden="true">
        ▾
      </span>
    </button>
  );

  const body = (
    <div ref={wrapperRef} className={`relative ${open ? 'z-[120]' : 'z-10'} ${className}`.trim()}>
      {button}

      {open && menuStyle
        ? createPortal(
            <div
              ref={dropdownRef}
              className={`fixed z-[9999] rounded-tt border border-tt-border bg-tt-surface p-2 shadow-tt ${menuClassName}`.trim()}
              style={{
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
              }}
            >
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                className={`mb-2 w-full min-h-touch rounded-tt-control border border-tt-border bg-tt-surface px-3 py-2 text-sm text-tt-text outline-none focus-visible:border-tt-action focus-visible:ring-2 focus-visible:ring-tt-focus/25 ${searchInputClassName}`.trim()}
                aria-label={searchPlaceholder}
                aria-controls={listboxId}
                aria-activedescendant={activeOptionId}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={true}
                aria-haspopup="listbox"
              />

              <div
                id={listboxId}
                role="listbox"
                aria-label={label ?? ariaLabel ?? placeholder}
                className="max-h-56 overflow-y-auto"
              >
                {filteredOptions.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-tt-text-muted">{emptyMessage}</p>
                ) : (
                  filteredOptions.map((option, index) => (
                    <button
                      type="button"
                      key={String(option.value)}
                      id={`${listboxId}-option-${index}`}
                      role="option"
                      aria-selected={option.value === value || index === activeIndex}
                      tabIndex={-1}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectOption(option.value)}
                      className={`min-h-touch w-full rounded-tt-control px-3 py-2 text-left text-sm text-tt-text hover:bg-tt-elevated focus-visible:ring-2 focus-visible:ring-tt-focus/40 ${
                        index === activeIndex || option.value === value
                          ? 'bg-tt-selection font-semibold text-tt-action'
                          : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );

  if (label) {
    return (
      <FormField
        label={label}
        htmlFor={selectId}
        hint={hint}
        error={error}
        required={required}
        descriptionId={helperId}
      >
        {body}
      </FormField>
    );
  }

  return (
    <div className="space-y-2">
      {body}
      {error ? (
        <p id={helperId} className="text-xs font-semibold text-tt-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={helperId} className="text-xs text-tt-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default SearchableSelect;
