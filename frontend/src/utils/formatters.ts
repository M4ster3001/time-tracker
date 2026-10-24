import { getLocale, subscribeLocale, text } from '../i18n';

export const formatMinutes = (minutes: number): string => {
  const sign = minutes < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(minutes));
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;
  if (hours === 0) return `${sign}${mins}m`;
  return `${sign}${hours}h ${mins.toString().padStart(2, '0')}m`;
};

export const formatHours = (hours: number): string => {
  return `${hours.toFixed(2)}h`;
};

export const formatDate = (value: Date | string): string => {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(getLocale(), { timeZone: 'UTC' });
};
export const formatTimestamp = (value: Date | string): string => {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(getLocale());
};

const buildMonthOptions = () =>
  Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2024, i, 1).toLocaleDateString(getLocale(), { month: 'long' }),
  }));
export let monthOptions = buildMonthOptions();
subscribeLocale(() => {
  monthOptions = buildMonthOptions();
});

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'BRL' }).format(value);

/** UX-HIGH-03: Map technical error messages to user-friendly messages */
const errorMessageMap: Record<string, string> = {
  'User does not have access to this client': 'Você não tem permissão para acessar este cliente.',
  'Manager does not have access to this client': 'Este gerente não tem acesso a este cliente.',
  'User already exists': 'Este email já está cadastrado.',
  'Invalid credentials': 'Email ou senha incorretos.',
  'User is inactive': 'Esta conta está desativada. Entre em contato com o administrador.',
  'Account locked': 'Conta bloqueada por excesso de tentativas. Tente novamente mais tarde.',
  'Time entry not found or unauthorized':
    'Lançamento não encontrado ou sem permissão para acessa-lo.',
  'Client not found': 'Cliente não encontrado.',
  'User not found': 'Usuário não encontrado.',
  'Cannot delete user with time entries':
    'Não é possível excluir usuário com lançamentos de horas.',
  'Cannot delete client with time entries':
    'Não é possível excluir cliente com lançamentos de horas.',
  'Cannot create time entry for future dates': 'Não é permitido lançar horas em datas futuras.',
  'Notifications are only available for managers and consultants':
    'As notificações estão disponíveis apenas para consultores e managers.',
  'Notifications are only available for active users':
    'As notificações estão disponíveis apenas para usuários ativos.',
  'Notification reminder not found': 'Lembrete de notificação não encontrado.',
  'Notification storage is not ready':
    'As notificações ainda não foram inicializadas no banco de dados. Aplique a migration pendente do backend.',
  user_notification_preferences:
    'As notificações ainda não foram inicializadas no banco de dados. Aplique a migration pendente do backend.',
  notification_reminders:
    'As notificações ainda não foram inicializadas no banco de dados. Aplique a migration pendente do backend.',
  'Invalid origin - CSRF protection': 'Erro de segurança. Recarregue a página e tente novamente.',
  'Token expired': 'Sua sessão expirou. Faça login novamente.',
  Unauthorized: 'Você não tem permissão para realizar esta ação.',
  Forbidden: 'Acesso negado.',
  'Too many requests': 'Muitas requisições. Aguarde um momento antes de tentar novamente.',
  'Too many login attempts': 'Muitas tentativas de login. Aguarde antes de tentar novamente.',
};

const getSupportHint = (status?: number): string => {
  if (getLocale() === 'en') {
    if (status === 400) return 'Review your input and try again.';
    if (status === 401) return 'Your session may have expired. Sign in again.';
    if (status === 403) return 'Ask an administrator for the required access.';
    if (status === 404) return 'The resource was not found. Check your filters.';
    if (status === 429) return 'Too many attempts. Wait a moment and try again.';
    if (status && status >= 500)
      return 'An internal error occurred. Try again shortly or contact support.';
    return '';
  }
  if (status === 400) {
    return 'Revise os dados informados e tente novamente. Se persistir, contate seu supervisor (manager) ou um administrador.';
  }
  if (status === 401) {
    return 'Sua sessão pode ter expirado. Faça login novamente. Se continuar, fale com um administrador.';
  }
  if (status === 403) {
    return 'Você não possui permissão para esta ação. Solicite acesso ao seu supervisor (manager) ou ao administrador.';
  }
  if (status === 404) {
    return 'O recurso não foi encontrado. Verifique os filtros. Se deveria existir, fale com um administrador.';
  }
  if (status === 429) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.';
  }
  if (status !== undefined && status >= 500) {
    return 'O sistema encontrou um erro interno. Tente novamente em instantes. Se persistir, contate seu supervisor (manager) e o administrador/suporte tecnico.';
  }
  return 'Se o problema continuar, contate seu supervisor (manager) ou um administrador.';
};

export const buildFriendlyApiErrorMessage = (rawMessage: string, status?: number): string => {
  const base = translateErrorMessage(rawMessage);
  const hint = getSupportHint(status);
  if (!hint || base.endsWith(hint)) return base;
  return `${base} ${hint}`;
};

export const extractApiValidationErrors = (err: unknown): Record<string, string> => {
  if (!(err && typeof err === 'object' && 'response' in err)) return {};
  const axiosErr = err as {
    response?: {
      data?: {
        details?: {
          fields?: Array<{ field?: string; message?: string }>;
        };
      };
    };
  };
  const fields = axiosErr.response?.data?.details?.fields;
  if (!Array.isArray(fields)) return {};
  return fields.reduce<Record<string, string>>((acc, item) => {
    if (!item?.field || !item?.message) return acc;
    if (!acc[item.field]) acc[item.field] = item.message;
    return acc;
  }, {});
};

const translateErrorMessage = (message: string): string => {
  const workflowErrors: Record<string, [string, string]> = {
    CLOSING_CYCLE_NOT_ENDED: [
      'O ciclo de serviço ainda não encerrou.',
      'The service cycle has not ended yet.',
    ],
    CLOSING_HAS_PENDING_ISSUES: [
      'Corrija as tarifas e alocações pendentes.',
      'Resolve the missing historical rates and allocations.',
    ],
    CLOSING_VERSION_CONFLICT: [
      'Outra pessoa alterou esta revisão. Atualize a página.',
      'This revision changed. Refresh the page.',
    ],
    CLOSING_CHANGED_RECALCULATE: [
      'As horas ou regras mudaram. Gere uma nova revisão antes de aprovar.',
      'Time entries or rules changed. Generate another revision before approval.',
    ],
    CLOSED_PERIOD_REQUIRES_TEMPORARY_UNLOCK: [
      'Período em conferência ou aprovado. Solicite desbloqueio temporário.',
      'This period is in review or approved. Request a temporary unlock.',
    ],
    RECALCULATION_REQUIRES_TEMPORARY_UNLOCK: [
      'O recálculo exige desbloqueio temporário após a última aprovação.',
      'Recalculation requires a temporary unlock after the last approval.',
    ],
    INDEPENDENT_APPROVER_REQUIRED: [
      'Outra pessoa deve aprovar esta revisão.',
      'Another person must approve this revision.',
    ],
    INSUFFICIENT_HOUR_BALANCE: ['Saldo de horas insuficiente.', 'Insufficient hour balance.'],
    PERSONAL_HOUR_ACCOUNT_REQUIRED: [
      'Crie os bancos individuais antes de aprovar.',
      'Create the personal hour accounts before approval.',
    ],
    LAST_ACCESS_MANAGER: [
      'A alteração removeria o último administrador de acessos.',
      'This change would remove the last access administrator.',
    ],
    CONSUMED_CREDIT_REQUIRES_ADJUSTMENT: [
      'Crédito consumido ou expirado. Registre um ajuste justificado.',
      'The credit was consumed or expired. Record a justified adjustment.',
    ],
    FLOW_DISABLED: ['Este fluxo está desabilitado.', 'This workflow is disabled.'],
    BALANCE_PERMISSION_REQUIRED: [
      'A movimentação do fechamento exige permissão para gerenciar saldos.',
      'Posting balances requires permission to manage balances.',
    ],
  };
  if (workflowErrors[message]) return text(...workflowErrors[message]);
  if (getLocale() === 'en') return message;
  // Check for exact match
  if (errorMessageMap[message]) {
    return errorMessageMap[message];
  }
  // Check for partial matches
  for (const [key, value] of Object.entries(errorMessageMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }
  // Check for common patterns
  if (message.includes('locked') && message.includes('minutes')) {
    const minutes = message.match(/(\d+)\s*minutes?/i);
    return `Conta bloqueada. Tente novamente em ${minutes?.[1] || 'alguns'} minutos.`;
  }
  return message;
};

/** Extract error message from axios errors or generic errors */
export const extractApiError = (err: unknown, fallback: string): string => {
  const fieldErrors = extractApiValidationErrors(err);
  if (Object.keys(fieldErrors).length > 0) {
    const first = Object.entries(fieldErrors)[0];
    const fieldLabel = first[0];
    return `${first[1]} ${text('Campo', 'Field')}: ${fieldLabel}.`;
  }
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as { response?: { status?: number; data?: { error?: string } } };
    if (axiosErr.response?.data?.error) {
      return buildFriendlyApiErrorMessage(axiosErr.response.data.error, axiosErr.response.status);
    }
    if (axiosErr.response?.status) return getSupportHint(axiosErr.response.status);
  }
  if (err instanceof Error) return buildFriendlyApiErrorMessage(err.message);
  return fallback;
};

/** Validate password strength matching backend rules */
export const validatePasswordStrength = (
  password: string
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (password.length < 12) {
    errors.push('Mínimo 12 caracteres');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Pelo menos uma letra minuscula');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Pelo menos uma letra maiuscula');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Pelo menos um número');
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('Pelo menos um caractere especial');
  }
  return { isValid: errors.length === 0, errors };
};

export const parseDurationToMinutes = (value: string): number | null => {
  const input = value.trim().toLowerCase();
  if (!input) return null;

  if (/^[0-9]+$/.test(input)) return Number(input);

  const hourMatches = [...input.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*(h|hr|hour|hours)\b/g)];
  const minMatches = [...input.matchAll(/([0-9]+)\s*(m|min|mins|minute|minutes)\b/g)];

  const hours = hourMatches.reduce((acc, match) => acc + Number(match[1]), 0);
  const minutes = minMatches.reduce((acc, match) => acc + Number(match[1]), 0);

  if (hours === 0 && minutes === 0) return null;
  return Math.round(hours * 60 + minutes);
};
