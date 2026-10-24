export type HelpTopic = {
  id: string;
  titlePt: string;
  titleEn: string;
  summaryPt: string;
  summaryEn: string;
  bodyPt: string[];
  bodyEn: string[];
  keywords: string[];
  /** Operator-facing doc path for “more detail” — not required for end users. */
  moreDetailDoc?: string;
  /** When set, topic is only listed if this flow flag is true. */
  requireFlow?: string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'log-hours',
    titlePt: 'Lançar horas',
    titleEn: 'Log time',
    summaryPt: 'Como registrar um lançamento de horas no dia a dia.',
    summaryEn: 'How to record a daily time entry.',
    bodyPt: [
      'Abra Horas → Novo lançamento (ou use a busca global).',
      'Escolha cliente (e projeto, se a organização usar projetos), data e duração.',
      'Preencha a descrição do trabalho e salve. Você pode editar depois enquanto o período estiver aberto.',
      'Use o atalho Ctrl+K (Cmd+K no Mac) para ir direto a “Novo lançamento”.',
    ],
    bodyEn: [
      'Open Time → New entry (or use global search).',
      'Pick client (and project, if your organization uses projects), date, and duration.',
      'Add a short work description and save. You can edit later while the period is open.',
      'Use Ctrl+K (Cmd+K on Mac) to jump straight to “New time entry”.',
    ],
    keywords: ['lancar', 'horas', 'timesheet', 'log', 'entry', 'novo'],
  },
  {
    id: 'projects',
    titlePt: 'Projetos por cliente',
    titleEn: 'Client projects',
    summaryPt: 'Organizar lançamentos por projeto dentro do cliente.',
    summaryEn: 'Organize entries by project under a client.',
    bodyPt: [
      'Se o fluxo de projetos estiver ativo, em Clientes há a aba Projetos.',
      'Cadastre o projeto no cliente correto antes de lançar horas nele.',
      'No formulário de lançamento, selecione o projeto junto com o cliente.',
    ],
    bodyEn: [
      'When the projects flow is on, Clients includes a Projects tab.',
      'Create the project under the right client before logging time against it.',
      'In the time-entry form, pick the project together with the client.',
    ],
    keywords: ['projeto', 'projetos', 'project', 'cliente', 'clients'],
    moreDetailDoc: 'docs/PRJ_01_PROJECTS.md',
    requireFlow: 'projects',
  },
  {
    id: 'confirm-duration',
    titlePt: 'Confirmar duração',
    titleEn: 'Confirm duration',
    summaryPt: 'Diferença entre estimada, confirmada e medida.',
    summaryEn: 'Estimated vs confirmed vs actual tracked duration.',
    bodyPt: [
      'Duração estimada: previsão antes ou durante o trabalho.',
      'Duração confirmada: o que você declara como realizado (confirmação humana).',
      'Duração medida: vem do timer de acompanhamento, só depois de parar a sessão — não é a mesma coisa que a confirmada.',
      'No lançamento, use o painel de durações e a confirmação quando o fluxo de estimativas estiver disponível.',
    ],
    bodyEn: [
      'Estimated duration: forecast before or during the work.',
      'Confirmed duration: what you declare as done (human confirmation).',
      'Actual tracked duration: comes from the tracking timer after you stop — it is not the same as confirmed.',
      'On the time-entry screen, use the duration panel and confirmation when estimates are enabled.',
    ],
    keywords: ['confirmada', 'estimada', 'medida', 'confirmed', 'estimated', 'tracked', 'duracao'],
    moreDetailDoc: 'docs/EST_02_CONFIRMATION.md',
  },
  {
    id: 'tracking',
    titlePt: 'Timer de acompanhamento',
    titleEn: 'Tracking timer',
    summaryPt: 'Usar o relógio ao vivo sem confundir com duração confirmada.',
    summaryEn: 'Use the live clock without confusing it with confirmed duration.',
    bodyPt: [
      'O timer aparece no dashboard ou no lançamento quando o fluxo de tracking está ligado.',
      'Inicie e pare a sessão; o tempo medido alimenta a duração medida do lançamento associado.',
      'O relógio ao vivo não substitui a duração confirmada — confirme as horas quando for o caso.',
    ],
    bodyEn: [
      'The timer appears on the dashboard or time-entry screen when the tracking flow is on.',
      'Start and stop a session; measured time feeds Actual Tracked on the linked entry.',
      'The live clock does not replace Confirmed Duration — confirm hours when required.',
    ],
    keywords: ['timer', 'tracking', 'cronometro', 'medido', 'trk'],
    moreDetailDoc: 'docs/TRK_01_TRACKING.md',
    requireFlow: 'tracking',
  },
  {
    id: 'closing-balances',
    titlePt: 'Fechamento e saldos',
    titleEn: 'Closing and balances',
    summaryPt: 'Conferir o ciclo e consultar bolsão ou banco individual.',
    summaryEn: 'Review the cycle and check pool or personal bank balances.',
    bodyPt: [
      'Em Fechamento, confira pendências, envie para aprovação e acompanhe o status do ciclo.',
      'Em Saldos, veja bolsão do cliente e/ou banco individual conforme os fluxos da organização.',
      'Períodos fechados ou em conferência podem bloquear edição de horas até liberação.',
    ],
    bodyEn: [
      'Under Closing, review open items, submit for approval, and follow the cycle status.',
      'Under Balances, see the client hour pool and/or personal bank when those flows are enabled.',
      'Closed or in-review periods may block time edits until unlocked.',
    ],
    keywords: ['fechamento', 'saldo', 'closing', 'balances', 'bolsao', 'aprovacao'],
  },
  {
    id: 'search-nav',
    titlePt: 'Busca e menu',
    titleEn: 'Search and menu',
    summaryPt: 'Atalhos da interface de trabalho.',
    summaryEn: 'Workspace interface shortcuts.',
    bodyPt: [
      'Ctrl+K / Cmd+K abre a busca global: páginas, ações e tópicos de ajuda permitidos para você.',
      'No menu lateral, cada seção pode expandir ou recolher; a preferência fica salva neste navegador.',
      'O botão de recolher a barra lateral deixa só os ícones — útil em telas estreitas.',
      'Ajuda também fica em Configurações → Ajuda.',
    ],
    bodyEn: [
      'Ctrl+K / Cmd+K opens global search: pages, actions, and help topics you can access.',
      'In the side menu, each section can expand or collapse; the preference is saved in this browser.',
      'Collapse the sidebar to icons when you need more workspace width.',
      'Help is also under Settings → Help.',
    ],
    keywords: ['busca', 'search', 'atalho', 'shortcut', 'menu', 'sidebar', 'ajuda', 'help'],
  },
  {
    id: 'mcp',
    titlePt: 'MCP para operadores',
    titleEn: 'MCP for operators',
    summaryPt: 'Ponte conceitual para automação — detalhe no guia do repositório.',
    summaryEn: 'Conceptual pointer to automation — details in the repo guide.',
    bodyPt: [
      'O servidor MCP é opcional e fica desligado por padrão (fluxo mcp).',
      'HTTP: GET /api/mcp/tools e POST /api/mcp/tools/call com JWT ou PAT; local: npm run mcp:stdio com TIME_TRACKER_MCP_USER_ID.',
      'Auth das tools continua JWT/PAT. OAuth é só discovery (MCP_OAUTH_*); o Time Tracker não emite tokens — IdP live fica fora deste app.',
      'Confirmação de duração e fechamento financeiro não entram no catálogo MCP. Consulte a documentação pública de MCP.',
    ],
    bodyEn: [
      'The MCP server is optional and off by default (mcp flow).',
      'HTTP: GET /api/mcp/tools and POST /api/mcp/tools/call with JWT or PAT; local: npm run mcp:stdio with TIME_TRACKER_MCP_USER_ID.',
      'Tool auth stays JWT/PAT. OAuth is discovery-only (MCP_OAUTH_*); Time Tracker does not issue tokens — live IdP is out of this app.',
      'Duration confirmation and financial close stay out of the MCP catalog. See the public MCP documentation.',
    ],
    keywords: ['mcp', 'agente', 'agent', 'automacao', 'stdio', 'oauth', 'pat'],
    moreDetailDoc: 'docs/integrations/mcp.md',
    requireFlow: 'mcp',
  },
];

export const helpTopicsForFlows = (flows: Record<string, boolean> | undefined): HelpTopic[] =>
  HELP_TOPICS.filter((topic) => !topic.requireFlow || Boolean(flows?.[topic.requireFlow]));

export const getHelpTopic = (id: string): HelpTopic | undefined =>
  HELP_TOPICS.find((topic) => topic.id === id);
