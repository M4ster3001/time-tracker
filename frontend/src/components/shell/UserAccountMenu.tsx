import React, { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trapFocusKeyDown, getFocusableElements } from '../../hooks/focusTrap';
import { useAuth } from '../../contexts/AuthContext';
import { setLocale, text, useLocale, type Locale } from '../../i18n';
import api from '../../services/api';
import {
  ACCOUNT_PANEL_ARIA,
  shouldCloseAccountPanelOnKey,
} from './userAccountMenu.focus';

type UserAccountMenuProps = {
  className?: string;
};

const UserAccountMenu: React.FC<UserAccountMenuProps> = ({ className = '' }) => {
  const { user, logout } = useAuth();
  const locale = useLocale();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [preferenceError, setPreferenceError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const menuId = useId();
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const main = document.getElementById('workspace-content');
    if (main) main.inert = true;

    const panel = panelRef.current;
    const focusable = panel ? getFocusableElements(panel) : [];
    focusable[0]?.focus();

    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (shouldCloseAccountPanelOnKey(event.key)) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (panelRef.current) trapFocusKeyDown(panelRef.current, event);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      if (main) main.inert = false;
      const previous = previousFocusRef.current ?? triggerRef.current;
      previousFocusRef.current = null;
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [open]);

  const initials =
    user?.name
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'TT';

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="tt-icon-btn tt-user-chip"
        aria-haspopup={ACCOUNT_PANEL_ARIA.popup}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={text('Abrir menu da conta', 'Open account menu')}
        data-testid="user-menu-trigger"
        onClick={() => setOpen((prev) => !prev)}
        title={user?.name ?? text('Conta', 'Account')}
      >
        <span className="tt-user-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="tt-user-chip-name">{user?.name ?? text('Conta', 'Account')}</span>
        <span className="text-tt-text-muted" aria-hidden="true">
          ▾
        </span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={menuId}
          role="dialog"
          aria-modal={ACCOUNT_PANEL_ARIA.modal}
          aria-labelledby={titleId}
          className="tt-account-popover"
          data-testid="user-menu-popover"
        >
          <div className="border-b border-tt-border px-3 py-3">
            <p id={titleId} className="text-sm font-semibold text-tt-text">
              {user?.name}
            </p>
            <p className="truncate text-xs text-tt-text-muted">{user?.email}</p>
          </div>
          <div className="space-y-2 px-3 py-3">
            <label className="block text-xs text-tt-text-muted">
              {text('Idioma', 'Language')}
              <select
                aria-label={text('Idioma', 'Language')}
                value={locale}
                className="workspace-input mt-1"
                onChange={(event) => {
                  const next = event.target.value as Locale;
                  const previous = locale;
                  setLocale(next);
                  setPreferenceError('');
                  void api.put('/api/preferences', { locale: next }).catch(() => {
                    setLocale(previous);
                    setPreferenceError(
                      text('Falha ao salvar idioma.', 'Unable to save language.')
                    );
                  });
                }}
              >
                <option value="pt-BR">Português</option>
                <option value="en">English</option>
              </select>
            </label>
            {preferenceError ? (
              <p role="alert" className="text-xs text-tt-danger">
                {preferenceError}
              </p>
            ) : null}
          </div>
          <div className="border-t border-tt-border p-2">
            <button type="button" className="tt-btn-secondary w-full min-h-touch" onClick={handleLogout}>
              {text('Sair', 'Sign out')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UserAccountMenu;
