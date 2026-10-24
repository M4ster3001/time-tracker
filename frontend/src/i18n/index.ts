import { useSyncExternalStore } from 'react';
import { legacyEnglish } from './legacy-catalog';
import { restorePortugueseAccents } from './pt-accents';

export type Locale = 'pt-BR' | 'en';
const listeners = new Set<() => void>();
let locale: Locale = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('tts.locale') === 'en'
      ? 'en'
      : 'pt-BR';
  } catch {
    return 'pt-BR';
  }
})();
export const getLocale = (): Locale => locale;
export const subscribeLocale = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const setLocale = (next: Locale): void => {
  locale = next;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem('tts.locale', next);
  } catch {
    /* Server preference remains available when local storage is blocked. */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((listener) => listener());
};
if (typeof document !== 'undefined') document.documentElement.lang = locale;
export const useLocale = (): Locale =>
  useSyncExternalStore(subscribeLocale, getLocale, () => 'pt-BR');
export const text = (portuguese: string, english: string): string =>
  locale === 'en' ? english : portuguese;

const messages: Record<string, string> = {
  'Carregando...': 'Loading...',
  Salvar: 'Save',
  'Salvando...': 'Saving...',
  Cancelar: 'Cancel',
  Excluir: 'Delete',
  Editar: 'Edit',
  Voltar: 'Back',
  Buscar: 'Search',
  Filtrar: 'Filter',
  'Limpar filtros': 'Clear filters',
  'Nenhum resultado': 'No results',
  'Tentar novamente': 'Try again',
  'Algo deu errado': 'Something went wrong',
  'Ocorreu um erro inesperado.': 'An unexpected error occurred.',
  Selecionar: 'Select',
  Todos: 'All',
  Todas: 'All',
  Cliente: 'Client',
  Clientes: 'Clients',
  Consultor: 'Consultant',
  Consultores: 'Consultants',
  Usuários: 'Users',
  Usuarios: 'Users',
  'Lançar Horas': 'Log time',
  'Lancar Horas': 'Log time',
  Histórico: 'History',
  Historico: 'History',
  Relatórios: 'Reports',
  Relatorios: 'Reports',
  Exportação: 'Export',
  Exportacao: 'Export',
  'Bolsão de Horas': 'Time billing',
  Notificações: 'Notifications',
  Notificacoes: 'Notifications',
  Integrações: 'Integrations',
  Integracoes: 'Integrations',
  Senha: 'Password',
  Entrar: 'Sign in',
  'Entrando...': 'Signing in...',
  Sair: 'Sign out',
  Ativo: 'Active',
  Inativo: 'Inactive',
  Data: 'Date',
  Horas: 'Hours',
  Descrição: 'Description',
  Descricao: 'Description',
  Ações: 'Actions',
  Acoes: 'Actions',
  Fechamento: 'Month close',
  Total: 'Total',
};
const isCatalogCopy = (value: string): boolean => value in messages || value in legacyEnglish;
const portugueseCache = new Map<string, string>();
const toPortuguese = (value: string): string => {
  if (!isCatalogCopy(value)) return value;
  let accented = portugueseCache.get(value);
  if (accented === undefined) {
    accented = restorePortugueseAccents(value);
    portugueseCache.set(value, accented);
  }
  return accented;
};
export const translate = (value: string): string =>
  locale === 'en' ? (messages[value] ?? legacyEnglish[value] ?? value) : toPortuguese(value);
