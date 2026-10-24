import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../../components/AppShell';
import {
  applyShellLayoutToDocument,
  DEFAULT_LAYOUT,
  isShellLayoutVariant,
  LAYOUT_LABELS,
  type ShellLayoutVariant,
  writeShellLayout,
} from '../../components/shell/layoutVariants';
import TimeEntryPage from '../consultant/time-entry';
import { LayoutPreviewProviders } from './LayoutPreviewProviders';

type PreviewRole = 'consultant' | 'manager' | 'admin';
type PreviewView = 'home' | 'time-entry';

type MockUser = {
  id: number;
  name: string;
  email: string;
  roleId: number;
};

type MockCapabilities = {
  grants: Array<{ permission: string; scope: 'self' | 'team' | 'all' }>;
  flows: Record<string, boolean>;
  locale: 'pt-BR' | 'en';
  navigation: Array<{ path: string; label: string; labelEn: string; section: string }>;
};

const NAV: Record<PreviewRole, MockCapabilities['navigation']> = {
  consultant: [
    { path: '/dashboard', label: 'Início', labelEn: 'Home', section: 'home' },
    { path: '/time-entries/new', label: 'Lançar horas', labelEn: 'Log time', section: 'hours' },
    { path: '/time-entries', label: 'Meus lançamentos', labelEn: 'My entries', section: 'hours' },
    { path: '/closing', label: 'Fechamento', labelEn: 'Closing', section: 'closing' },
    { path: '/settings', label: 'Preferências', labelEn: 'Preferences', section: 'settings' },
  ],
  manager: [
    { path: '/dashboard', label: 'Início', labelEn: 'Home', section: 'home' },
    { path: '/dashboard/team', label: 'Equipe', labelEn: 'Team', section: 'home' },
    { path: '/time-entries', label: 'Lançamentos', labelEn: 'Entries', section: 'hours' },
    { path: '/people', label: 'Time', labelEn: 'People', section: 'directory' },
    { path: '/clients', label: 'Clientes', labelEn: 'Clients', section: 'directory' },
    { path: '/reports', label: 'Relatórios', labelEn: 'Reports', section: 'reports' },
    { path: '/settings', label: 'Configurações', labelEn: 'Settings', section: 'settings' },
  ],
  admin: [
    { path: '/dashboard', label: 'Início', labelEn: 'Home', section: 'home' },
    { path: '/people', label: 'Pessoas', labelEn: 'People', section: 'directory' },
    { path: '/clients', label: 'Clientes', labelEn: 'Clients', section: 'directory' },
    { path: '/reports', label: 'Relatórios', labelEn: 'Reports', section: 'reports' },
    { path: '/admin/bulk', label: 'Operações em lote', labelEn: 'Bulk ops', section: 'settings' },
    { path: '/settings', label: 'Configurações', labelEn: 'Settings', section: 'settings' },
  ],
};

const USERS: Record<PreviewRole, MockUser> = {
  consultant: {
    id: 31,
    name: 'Maria Consultant',
    email: 'maria@example.com',
    roleId: 3,
  },
  manager: {
    id: 21,
    name: 'Joao Manager',
    email: 'manager@example.com',
    roleId: 2,
  },
  admin: {
    id: 11,
    name: 'Admin User',
    email: 'admin@example.com',
    roleId: 1,
  },
};

function PreviewHomePanel({ role }: { role: PreviewRole }) {
  const copy =
    role === 'consultant'
      ? {
          title: 'Início do consultor',
          subtitle: 'Resumo da semana e atalhos de lançamento',
          cards: ['Horas confirmadas', 'Pendências', 'Próximo fechamento'],
        }
      : role === 'manager'
        ? {
            title: 'Painel do gestor',
            subtitle: 'Equipe, alocações e acompanhamento',
            cards: ['Consultores ativos', 'Horas da equipe', 'Clientes no escopo'],
          }
        : {
            title: 'Administração',
            subtitle: 'Pessoas, clientes e operações em lote',
            cards: ['Usuários', 'Pool de horas', 'Saúde do sistema'],
          };

  return (
    <AppShell title={copy.title} subtitle={copy.subtitle}>
      <div className="tt-home-board" data-testid="layout-preview-home">
        <div className="tt-card-grid" data-testid="layout-preview-panels">
          {copy.cards.map((label) => (
            <section key={label} className="tt-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-tt-text-muted">
                {label}
              </p>
              <p className="mt-2 font-mono text-2xl tabular-nums text-tt-text">12.5h</p>
              <p className="mt-1.5 text-sm text-tt-text-muted">
                Prévia estática para escolha de layout.
              </p>
            </section>
          ))}
        </div>
        <div className="tt-home-board-lower">
          <section className="tt-panel tt-home-activity">
            <h2 className="text-base font-semibold text-tt-text">Atividade recente</h2>
            <ul className="mt-3 space-y-2.5 text-sm text-tt-text-muted">
              <li className="flex justify-between gap-4 border-b border-tt-border pb-2.5">
                <span>Cliente Alpha · Discovery</span>
                <span className="font-mono tabular-nums text-tt-text">2.0h</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-tt-border pb-2.5">
                <span>Cliente Beta · Entrega</span>
                <span className="font-mono tabular-nums text-tt-text">3.5h</span>
              </li>
              <li className="flex justify-between gap-4 border-b border-tt-border pb-2.5">
                <span>Interno · Ritual de time</span>
                <span className="font-mono tabular-nums text-tt-text">1.0h</span>
              </li>
              <li className="flex justify-between gap-4">
                <span>Cliente Gamma · Revisão</span>
                <span className="font-mono tabular-nums text-tt-text">1.5h</span>
              </li>
            </ul>
          </section>
          <section className="tt-panel tt-home-shortcuts">
            <h2 className="text-base font-semibold text-tt-text">Atalhos</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a className="tt-home-shortcut" href="/time-entries/new">
                  Lançar horas
                </a>
              </li>
              <li>
                <a className="tt-home-shortcut" href="/time-entries">
                  Meus lançamentos
                </a>
              </li>
              <li>
                <a className="tt-home-shortcut" href="/closing">
                  Fechamento
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

/**
 * Dev shell preview: mocks auth/capabilities so layout variants can be
 * screenshotted without a live seeded database.
 * Query: /dev/layout-preview?layout=a|b|c&role=consultant|manager|admin&view=home|time-entry
 */
const LayoutPreviewPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const layoutParam = params.get('layout');
  const roleParam = params.get('role');
  const viewParam = params.get('view');
  const layout: ShellLayoutVariant = isShellLayoutVariant(layoutParam)
    ? layoutParam
    : DEFAULT_LAYOUT;
  const role: PreviewRole =
    roleParam === 'manager' || roleParam === 'admin' ? roleParam : 'consultant';
  const view: PreviewView =
    viewParam === 'time-entry' && role === 'consultant' ? 'time-entry' : 'home';

  const [ready, setReady] = useState(false);

  useEffect(() => {
    writeShellLayout(layout);
    applyShellLayoutToDocument(layout);
    setReady(true);
  }, [layout]);

  const user = USERS[role];
  const capabilities = useMemo<MockCapabilities>(
    () => ({
      grants: [{ permission: '*', scope: 'all' }],
      flows: { tracking: true },
      locale: 'pt-BR',
      navigation: NAV[role],
    }),
    [role]
  );

  const setQuery = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    if (key === 'role' && value !== 'consultant' && next.get('view') === 'time-entry') {
      next.delete('view');
    }
    setParams(next, { replace: true });
  };

  return (
    <LayoutPreviewProviders user={user} capabilities={capabilities}>
      {/* In-flow toolbar: never covers home/activity content (fixed bottom overlay did on mobile). */}
      <div
        className="relative z-[60] flex justify-center px-2 py-2 sm:justify-start sm:px-3"
        data-testid="layout-preview-toolbar"
      >
        <div className="flex max-w-full flex-wrap gap-2 rounded-tt border border-tt-border bg-tt-surface p-2 shadow-tt">
          {(['a', 'b', 'c'] as ShellLayoutVariant[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`tt-btn-secondary px-3 text-xs ${layout === id ? 'ring-2 ring-tt-focus' : ''}`}
              data-testid={`layout-pick-${id}`}
              onClick={() => setQuery('layout', id)}
            >
              {LAYOUT_LABELS[id]}
            </button>
          ))}
          {(['consultant', 'manager', 'admin'] as PreviewRole[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`tt-btn-secondary px-3 text-xs ${role === id ? 'ring-2 ring-tt-focus' : ''}`}
              data-testid={`role-pick-${id}`}
              onClick={() => setQuery('role', id)}
            >
              {id}
            </button>
          ))}
          {role === 'consultant' ? (
            <>
              <button
                type="button"
                className={`tt-btn-secondary px-3 text-xs ${view === 'home' ? 'ring-2 ring-tt-focus' : ''}`}
                data-testid="view-pick-home"
                onClick={() => setQuery('view', 'home')}
              >
                home
              </button>
              <button
                type="button"
                className={`tt-btn-secondary px-3 text-xs ${view === 'time-entry' ? 'ring-2 ring-tt-focus' : ''}`}
                data-testid="view-pick-time-entry"
                onClick={() => setQuery('view', 'time-entry')}
              >
                time-entry
              </button>
            </>
          ) : null}
        </div>
      </div>
      {ready ? (
        view === 'time-entry' ? (
          <div data-testid="layout-preview-time-entry">
            <TimeEntryPage />
          </div>
        ) : (
          <PreviewHomePanel role={role} />
        )
      ) : null}
      <span className="sr-only" data-testid="layout-preview-ready">
        layout:{layout} role:{role} view:{view}
      </span>
    </LayoutPreviewProviders>
  );
};

export default LayoutPreviewPage;
