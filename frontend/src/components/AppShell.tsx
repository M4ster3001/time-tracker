import React, { createContext, useContext, useEffect } from 'react';
import Sidebar from './Sidebar';
import { text, translate, useLocale } from '../i18n';
import { ShellChromeProvider, useShellChrome } from './shell/ShellChromeContext';
import GlobalSearch from './shell/GlobalSearch';
import HelpDrawer from './shell/HelpDrawer';
import ThemeIconToggle from './shell/ThemeIconToggle';
import UserAccountMenu from './shell/UserAccountMenu';
import ShellBrand from './shell/ShellBrand';
import {
  applyShellLayoutToDocument,
  readShellLayout,
} from './shell/layoutVariants';

interface AppShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}
const NestedShell = createContext(false);

const ShellLayout: React.FC<AppShellProps> = ({ title, subtitle, children }) => {
  useLocale();
  const { sidebarCollapsed, toggleSidebarCollapsed, openHelp, searchOpen, helpOpen } =
    useShellChrome();
  const chromeLocksContent = searchOpen || helpOpen;

  useEffect(() => {
    applyShellLayoutToDocument(readShellLayout());
  }, []);

  return (
    <div className="tt-shell" data-testid="app-shell">
      <a href="#workspace-content" className="tt-skip-link">
        {text('Ir para o conteúdo', 'Skip to content')}
      </a>
      <div className="tt-shell-frame">
        <div
          className={`tt-shell-grid ${
            sidebarCollapsed ? 'tt-shell-grid--collapsed' : 'tt-shell-grid--expanded'
          }`}
        >
          <div className="tt-shell-sidebar-slot" {...(searchOpen ? { inert: true } : {})}>
            <Sidebar />
          </div>

          <div className="tt-shell-main">
            <header className="tt-shell-header">
              <div className="tt-shell-header-brand">
                <ShellBrand compact />
              </div>
              <div className="tt-shell-header-titles">
                <h1 className="tt-shell-title">{translate(title)}</h1>
                {subtitle ? <p className="tt-shell-subtitle">{subtitle}</p> : null}
              </div>
              <div className="tt-shell-header-tools" data-testid="shell-header-tools">
                <GlobalSearch />
                <div className="tt-shell-header-actions" data-testid="shell-header-actions">
                  {/* Layout B keeps collapse in the sidebar; layouts A and C expose it here. */}
                  <button
                    type="button"
                    className="tt-icon-btn layout-hide-b hidden md:inline-flex"
                    data-testid="header-sidebar-collapse"
                    onClick={toggleSidebarCollapsed}
                    aria-pressed={sidebarCollapsed}
                    aria-label={
                      sidebarCollapsed
                        ? text('Expandir menu lateral', 'Expand side menu')
                        : text('Recolher menu lateral', 'Collapse side menu')
                    }
                  >
                    {sidebarCollapsed ? '☰' : '«'}
                  </button>
                  <button
                    type="button"
                    className="tt-icon-btn"
                    onClick={() => openHelp()}
                    aria-haspopup="dialog"
                    aria-label={text('Abrir ajuda', 'Open help')}
                    title={text('Ajuda', 'Help')}
                  >
                    <svg
                      className="h-5 w-5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.75}
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path
                        strokeLinecap="round"
                        d="M9.75 9.75a2.25 2.25 0 114.1 1.3c-.4.6-1.1 1-1.6 1.45-.35.3-.5.6-.5 1"
                      />
                      <circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none" />
                    </svg>
                  </button>
                  <ThemeIconToggle />
                  <UserAccountMenu />
                </div>
              </div>
            </header>

            <details className="tt-mobile-nav md:hidden" data-testid="mobile-nav">
              <summary
                className="tt-mobile-nav-trigger"
                aria-label={text('Abrir menu de navegação', 'Open navigation menu')}
              >
                <span className="tt-mobile-nav-icon" aria-hidden="true">
                  ☰
                </span>
                <span className="tt-mobile-nav-label">{text('Menu', 'Menu')}</span>
              </summary>
              <Sidebar forceExpanded />
            </details>

            <main
              id="workspace-content"
              tabIndex={-1}
              className="tt-shell-content"
              {...(chromeLocksContent ? { inert: true } : {})}
            >
              <div className="tt-shell-workspace">
                <NestedShell.Provider value={true}>{children}</NestedShell.Provider>
              </div>
            </main>
          </div>
        </div>
      </div>
      <HelpDrawer />
    </div>
  );
};

const AppShell: React.FC<AppShellProps> = ({ title, subtitle, children }) => {
  useLocale();
  const nested = useContext(NestedShell);
  if (nested) {
    return (
      <section className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-tt-text">{translate(title)}</h3>
          {subtitle ? (
            <p className="mt-1 text-sm text-tt-text-muted">{translate(subtitle)}</p>
          ) : null}
        </div>
        {children}
      </section>
    );
  }
  return (
    <ShellChromeProvider>
      <ShellLayout title={title} subtitle={subtitle}>
        {children}
      </ShellLayout>
    </ShellChromeProvider>
  );
};

export default AppShell;
