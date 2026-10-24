import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_PANEL_ARIA,
  shouldCloseAccountPanelOnKey,
} from './userAccountMenu.focus';

describe('userAccountMenu.focus (UX §7 / a11y)', () => {
  it('modelo de painel e dialog modal (conteudo misto: idioma + acoes), nao menu APG puro', () => {
    expect(ACCOUNT_PANEL_ARIA.popup).toBe('dialog');
    expect(ACCOUNT_PANEL_ARIA.modal).toBe(true);
  });

  it('Escape fecha o painel; outras teclas nao', () => {
    expect(shouldCloseAccountPanelOnKey('Escape')).toBe(true);
    expect(shouldCloseAccountPanelOnKey('Enter')).toBe(false);
    expect(shouldCloseAccountPanelOnKey('Tab')).toBe(false);
    expect(shouldCloseAccountPanelOnKey('ArrowDown')).toBe(false);
  });
});
