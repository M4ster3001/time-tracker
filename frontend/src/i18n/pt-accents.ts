/**
 * The legacy catalog uses accent-less Portuguese strings as lookup keys
 * ("Historico", "Correcao de Lancamentos"). Keys must stay stable, so the accents
 * are restored at display time, word by word, for strings that are known UI copy.
 * Only whole accent-less words listed here are rewritten; ambiguous ones
 * ("esta", "tem", "pode") are intentionally left out.
 */
const ACCENTED_WORDS: Record<string, string> = {
  acao: 'ação',
  alocacao: 'alocação',
  alocacoes: 'alocações',
  alteracoes: 'alterações',
  analise: 'análise',
  aplicacao: 'aplicação',
  apos: 'após',
  botao: 'botão',
  calendario: 'calendário',
  codigo: 'código',
  comecar: 'começar',
  concluida: 'concluída',
  configuracao: 'configuração',
  configuracoes: 'configurações',
  correcao: 'correção',
  diaria: 'diária',
  disponivel: 'disponível',
  duracao: 'duração',
  edicao: 'edição',
  edicoes: 'edições',
  estatisticas: 'estatísticas',
  exportacao: 'exportação',
  faca: 'faça',
  faturaveis: 'faturáveis',
  formulario: 'formulário',
  gestao: 'gestão',
  historico: 'histórico',
  horario: 'horário',
  horarios: 'horários',
  importacao: 'importação',
  inicio: 'início',
  integracoes: 'integrações',
  ja: 'já',
  lancamento: 'lançamento',
  lancamentos: 'lançamentos',
  mantem: 'mantém',
  media: 'média',
  mes: 'mês',
  metricas: 'métricas',
  nao: 'não',
  notificacao: 'notificação',
  operacoes: 'operações',
  pagina: 'página',
  pendencias: 'pendências',
  periodo: 'período',
  periodos: 'períodos',
  permissao: 'permissão',
  permissoes: 'permissões',
  politicas: 'políticas',
  possivel: 'possível',
  preferencias: 'preferências',
  previa: 'prévia',
  proxima: 'próxima',
  proximo: 'próximo',
  proximos: 'próximos',
  rapido: 'rápido',
  recomendacoes: 'recomendações',
  relatorio: 'relatório',
  relatorios: 'relatórios',
  retencao: 'retenção',
  revogacao: 'revogação',
  rotulo: 'rótulo',
  saude: 'saúde',
  selecao: 'seleção',
  sera: 'será',
  serao: 'serão',
  sincronizacao: 'sincronização',
  sugestoes: 'sugestões',
  temporario: 'temporário',
  temporarios: 'temporários',
  tendencia: 'tendência',
  ultima: 'última',
  ultimas: 'últimas',
  ultimo: 'último',
  ultimos: 'últimos',
  usuario: 'usuário',
  usuarios: 'usuários',
  utilizacao: 'utilização',
  valido: 'válido',
  varios: 'vários',
  verificacao: 'verificação',
  verificacoes: 'verificações',
  versao: 'versão',
  visao: 'visão',
  voce: 'você',
};

const matchCase = (original: string, replacement: string): string => {
  if (original.length > 1 && original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
};

export const restorePortugueseAccents = (value: string): string =>
  value.replace(/\p{L}+/gu, (word) => {
    const replacement = ACCENTED_WORDS[word.toLowerCase()];
    return replacement ? matchCase(word, replacement) : word;
  });
