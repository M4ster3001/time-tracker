import { requestLocale } from '../../../../shared/domain/locale.js';
const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEKDAY_NAMES = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];

export const toAsciiLabel = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const sanitizeFileName = (name: string): string =>
  name
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const splitClientName = (name: string): { part1: string; part2: string } => {
  const parts = name.trim().split(' ');
  if (parts.length <= 1) return { part1: name, part2: '' };
  return { part1: parts[0], part2: parts.slice(1).join(' ') };
};

export const monthFolderLabel = (month: number): string => {
  const monthName = getMonthLabel(month);
  return `${String(month).padStart(2, '0')}-${toAsciiLabel(monthName).toLowerCase()}`;
};

export const formatDatePtBr = (day: number, month: number, year: number): string => {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yy = String(year).slice(-2);
  return requestLocale() === 'en' ? `${mm}/${dd}/${yy}` : `${dd}/${mm}/${yy}`;
};

export const getMonthLabel = (month: number): string => requestLocale() === 'en' ?
  new Date(Date.UTC(2026, month - 1, 1)).toLocaleDateString('en', { month: 'long', timeZone: 'UTC' }) : MONTH_NAMES[month - 1] ?? `${month}`;
export const getWeekdayLabel = (weekday: number): string => requestLocale() === 'en' ?
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday] ?? '' : WEEKDAY_NAMES[weekday] ?? '';
