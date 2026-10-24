/**
 * UX §7 / WCAG 2.2 — painel da conta mistura select de idioma + logout.
 * Isso não é um menu APG puro (só menuitems); trata-se de dialog modal.
 */

export const ACCOUNT_PANEL_ARIA = {
  popup: 'dialog' as const,
  modal: true,
};

export const shouldCloseAccountPanelOnKey = (key: string): boolean => key === 'Escape';
