import type { SearchableSelectOption } from '../SearchableSelect';

export const normalizeSearchText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const filterSearchableOptions = (
  options: SearchableSelectOption[],
  query: string
): SearchableSelectOption[] => {
  const trimmedQuery = normalizeSearchText(query);
  if (!trimmedQuery) return options;
  return options.filter((option) => normalizeSearchText(option.label).includes(trimmedQuery));
};
