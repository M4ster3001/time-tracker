import { normalizeSearchText } from '../searchable-select/searchableSelect.filter';
import type { HelpTopic } from './help.catalog';
import { helpTopicsForFlows } from './help.catalog';

export type GlobalSearchKind = 'nav' | 'action' | 'help';

export type GlobalSearchItem = {
  id: string;
  kind: GlobalSearchKind;
  label: string;
  description: string;
  /** Router path (may include query). */
  path?: string;
  helpId?: string;
  keywords: string[];
};

export type NavigationEntryLike = {
  path: string;
  label: string;
  labelEn: string;
  section: string;
};

export type BuildGlobalSearchInput = {
  locale: 'pt-BR' | 'en';
  navigation: NavigationEntryLike[];
  flows: Record<string, boolean> | undefined;
  canVisit: (path: string) => boolean;
  can: (permission: string, scope?: 'self' | 'team' | 'all') => boolean;
  helpTopics?: HelpTopic[];
};

const pathnameOf = (path: string): string => path.split('?')[0] ?? path;

const label = (locale: 'pt-BR' | 'en', pt: string, en: string): string =>
  locale === 'en' ? en : pt;

export const buildGlobalSearchItems = (input: BuildGlobalSearchInput): GlobalSearchItem[] => {
  const items: GlobalSearchItem[] = [];
  const seen = new Set<string>();

  const push = (item: GlobalSearchItem) => {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  };

  for (const entry of input.navigation) {
    if (!input.canVisit(pathnameOf(entry.path))) continue;
    push({
      id: `nav:${entry.path}`,
      kind: 'nav',
      label: input.locale === 'en' ? entry.labelEn : entry.label,
      description: label(input.locale, 'Ir para página', 'Go to page'),
      path: entry.path,
      keywords: [entry.label, entry.labelEn, entry.path, entry.section],
    });
  }

  const actions: Array<{
    id: string;
    path: string;
    labelPt: string;
    labelEn: string;
    descriptionPt: string;
    descriptionEn: string;
    keywords: string[];
    allowed: boolean;
  }> = [
    {
      id: 'action:new-entry',
      path: '/time-entries/new',
      labelPt: 'Novo lançamento',
      labelEn: 'New time entry',
      descriptionPt: 'Abrir formulário de horas',
      descriptionEn: 'Open the time-entry form',
      keywords: ['novo', 'lancar', 'horas', 'new', 'log', 'entry'],
      allowed: input.canVisit('/time-entries/new') || input.can('time.write'),
    },
    {
      id: 'action:projects',
      path: '/clients?tab=projects',
      labelPt: 'Projetos',
      labelEn: 'Projects',
      descriptionPt: 'Cadastro de projetos por cliente',
      descriptionEn: 'Client project directory',
      keywords: ['projeto', 'projetos', 'project', 'projects'],
      allowed:
        Boolean(input.flows?.projects) &&
        input.canVisit('/clients') &&
        input.can('projects.read'),
    },
    {
      id: 'action:closing',
      path: '/closing',
      labelPt: 'Fechamento',
      labelEn: 'Closing',
      descriptionPt: 'Ciclo de conferência e aprovação',
      descriptionEn: 'Review and approval cycle',
      keywords: ['fechamento', 'closing', 'aprovacao'],
      allowed: input.canVisit('/closing'),
    },
    {
      id: 'action:balances',
      path: '/balances',
      labelPt: 'Saldos',
      labelEn: 'Balances',
      descriptionPt: 'Bolsão e banco individual',
      descriptionEn: 'Hour pool and personal bank',
      keywords: ['saldo', 'saldos', 'balances', 'bolsao'],
      allowed: input.canVisit('/balances'),
    },
    {
      id: 'action:settings',
      path: '/settings',
      labelPt: 'Configurações',
      labelEn: 'Settings',
      descriptionPt: 'Preferências e administração',
      descriptionEn: 'Preferences and administration',
      keywords: ['configuracoes', 'settings', 'preferencias'],
      allowed: input.canVisit('/settings'),
    },
    {
      id: 'action:task-types',
      path: '/settings?tab=task-types',
      labelPt: 'Tipos de tarefa',
      labelEn: 'Task types',
      descriptionPt: 'Catálogo EST-01 de tipos e parâmetros',
      descriptionEn: 'EST-01 task type and parameter catalog',
      keywords: ['tipos', 'task types', 'catalogo', 'estimativa', 'est-01'],
      allowed:
        input.canVisit('/settings') &&
        input.can('estimates.read') &&
        (input.can('estimation_parameters.manage') ||
          input.can('estimation_parameters.manage', 'all')),
    },
    {
      id: 'action:calibration',
      path: '/settings?tab=calibration',
      labelPt: 'Calibração',
      labelEn: 'Calibration',
      descriptionPt: 'Parâmetros de estimativa',
      descriptionEn: 'Estimation parameters',
      keywords: ['calibracao', 'calibration', 'estimativa'],
      allowed:
        input.canVisit('/settings') &&
        (input.can('estimation_parameters.manage') ||
          input.can('estimation_parameters.manage', 'all')),
    },
    {
      id: 'action:help',
      path: '/settings?tab=help',
      labelPt: 'Ajuda',
      labelEn: 'Help',
      descriptionPt: 'FAQ e como usar o Time Tracker',
      descriptionEn: 'FAQ and how to use Time Tracker',
      keywords: ['ajuda', 'help', 'faq', 'como'],
      allowed: true,
    },
    {
      id: 'action:display',
      path: '/settings?tab=display',
      labelPt: 'Apresentação',
      labelEn: 'Display',
      descriptionPt: 'Densidade e contraste elevado',
      descriptionEn: 'Density and high contrast',
      keywords: ['apresentacao', 'display', 'densidade', 'density', 'contraste', 'a11y'],
      allowed: true,
    },
  ];

  for (const action of actions) {
    if (!action.allowed) continue;
    push({
      id: action.id,
      kind: 'action',
      label: label(input.locale, action.labelPt, action.labelEn),
      description: label(input.locale, action.descriptionPt, action.descriptionEn),
      path: action.path,
      keywords: action.keywords,
    });
  }

  const topics = input.helpTopics ?? helpTopicsForFlows(input.flows);
  for (const topic of topics) {
    push({
      id: `help:${topic.id}`,
      kind: 'help',
      label: label(input.locale, topic.titlePt, topic.titleEn),
      description: label(input.locale, topic.summaryPt, topic.summaryEn),
      helpId: topic.id,
      path: `/settings?tab=help&topic=${topic.id}`,
      keywords: topic.keywords,
    });
  }

  return items;
};

export const filterGlobalSearchItems = (
  items: GlobalSearchItem[],
  query: string
): GlobalSearchItem[] => {
  const trimmed = normalizeSearchText(query);
  if (!trimmed) return items;
  return items.filter((item) => {
    const haystack = normalizeSearchText(
      [item.label, item.description, ...item.keywords].join(' ')
    );
    return haystack.includes(trimmed);
  });
};

export const kindLabel = (
  kind: GlobalSearchKind,
  locale: 'pt-BR' | 'en'
): string => {
  if (kind === 'nav') return locale === 'en' ? 'Page' : 'Página';
  if (kind === 'action') return locale === 'en' ? 'Action' : 'Ação';
  return locale === 'en' ? 'Help' : 'Ajuda';
};
