import { AsyncLocalStorage } from 'node:async_hooks';
export type Locale = 'pt-BR' | 'en';
const storage = new AsyncLocalStorage<Locale>();
export const withLocale = <T>(header: string | undefined, run: () => T): T =>
  storage.run(/^en(?:[-,;]|$)/i.test(header ?? '') ? 'en' : 'pt-BR', run);
export const requestLocale = (): Locale => storage.getStore() ?? 'pt-BR';
const english: Record<string, string> = {
  'Empresa:': 'Company:',
  'Consultor Externo:': 'External consultant:',
  Data: 'Date',
  'Dia da semana': 'Weekday',
  Atividade: 'Activity',
  Duração: 'Duration',
  Duracao: 'Duration',
  Consultor: 'Person',
  Cliente: 'Client',
  'Horas Trabalhadas': 'Worked hours',
  'Horas Contratadas': 'Contracted hours',
  'Horas Extras': 'Overtime hours',
  'Horas Faturaveis': 'Billable hours',
  'Horas Faturáveis': 'Billable hours',
  'Valor/Hora (R$)': 'Hourly rate (BRL)',
  'Total (R$)': 'Amount (BRL)',
  'Bolsao de Horas': 'Time billing',
  Resumo: 'Summary',
  'Resumo Executivo': 'Executive summary',
  Planilha: 'Worksheet',
  Periodo: 'Period',
  Período: 'Period',
  Horas: 'Hours',
  Total: 'Total',
  'Horas Normais': 'Regular hours',
  'Horas normais': 'Regular hours',
  'Horas extras': 'Overtime hours',
  Descricao: 'Description',
  Descrição: 'Description',
  Dia: 'Day',
  Meta: 'Target',
  Trabalhado: 'Worked',
  Faturavel: 'Billable',
  Faturável: 'Billable',
  'Mês:': 'Month:',
  'Mes:': 'Month:',
  Fechamento: 'Month close',
};
export const exportLabel = (label: string): string =>
  requestLocale() === 'en' ? (english[label] ?? label) : label;
