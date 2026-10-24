import React, { useEffect, useId, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useCapabilities } from '../contexts/CapabilitiesContext';
import { text, useLocale } from '../i18n';
import ShellBrand from './shell/ShellBrand';
import { useShellChrome } from './shell/ShellChromeContext';
import {
  presentNavGroups,
  type NavGroupInput,
  type NavItemInput,
} from './shell/navGroups';
import { readNavOpenGroups, writeNavOpenGroups } from './shell/shellPreferences';

type NavItem = NavItemInput;
type NavGroup = NavGroupInput;

const SECTION_MARK: Record<string, string> = {
  home: 'In',
  hours: 'Hr',
  closing: 'Fc',
  directory: 'Ps',
  reports: 'Rl',
  settings: 'Cf',
};

type SidebarProps = {
  /** Mobile drawer should stay full-width even if the desktop rail is collapsed. */
  forceExpanded?: boolean;
};

/** Compact-rail section mark with hover + keyboard-focus tooltip (workspace layout a11y). */
const RailNavLink: React.FC<{
  to: string;
  label: string;
  mark: string;
  active: boolean;
}> = ({ to, label, mark, active }) => {
  const tipId = useId();
  return (
    <span className="tt-rail-tip">
      <NavLink
        to={to}
        aria-label={label}
        aria-describedby={tipId}
        className={`tt-rail-link ${active ? 'active' : ''}`}
      >
        {mark}
      </NavLink>
      <span id={tipId} role="tooltip" className="tt-rail-tip__bubble">
        {label}
      </span>
    </span>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ forceExpanded = false }) => {
  const { capabilities } = useCapabilities();
  const locale = useLocale();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebarCollapsed } = useShellChrome();
  const railCollapsed = sidebarCollapsed && !forceExpanded;

  const groups = useMemo<NavGroup[]>(() => {
    const sections = [
      ['home', text('Início', 'Home')],
      ['hours', text('Horas', 'Time')],
      ['closing', text('Fechamento e saldos', 'Closing and balances')],
      ['directory', text('Pessoas e clientes', 'People and clients')],
      ['reports', text('Relatórios', 'Reports')],
      ['settings', text('Configurações', 'Settings')],
    ];
    return sections
      .map(([key, label]) => ({
        key,
        label,
        mark: SECTION_MARK[key] ?? key.slice(0, 2).toUpperCase(),
        // Only the daily-use groups start open; the active route's group opens itself.
        defaultOpen: key === 'home' || key === 'hours',
        items: (capabilities?.navigation ?? [])
          .filter((entry) => entry.section === key)
          .map((entry) => ({
            to: entry.path,
            label: locale === 'en' ? entry.labelEn : entry.label,
          })),
      }))
      .filter((group) => group.items.length > 0);
  }, [capabilities?.navigation, locale]);

  /** Flat link when singleton label matches the section (avoids CONFIGURAÇÕES + Configurações). */
  const navEntries = useMemo(() => presentNavGroups(groups), [groups]);

  const defaultOpenMap = useMemo(
    () =>
      groups.reduce<Record<string, boolean>>((acc, group) => {
        acc[group.key] = group.defaultOpen;
        return acc;
      }, {}),
    [groups]
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    readNavOpenGroups(defaultOpenMap)
  );

  useEffect(() => {
    setOpenGroups((prev) => {
      const merged = readNavOpenGroups({ ...defaultOpenMap, ...prev });
      writeNavOpenGroups(merged);
      return merged;
    });
  }, [defaultOpenMap]);

  const allItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const [mostVisited, setMostVisited] = useState<Array<NavItem & { count: number }>>([]);

  const readRouteCounts = (): Record<string, number> => {
    try {
      const raw = localStorage.getItem('navRouteCounts');
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  };

  const updateMostVisited = () => {
    const counts = readRouteCounts();
    const labelsByRoute = new Map(allItems.map((item) => [item.to, item.label]));
    const top = Object.entries(counts)
      .filter(([route]) => labelsByRoute.has(route))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([to, count]) => ({
        to,
        count,
        label: labelsByRoute.get(to) ?? to,
      }));
    setMostVisited(top);
  };

  const registerNavVisit = (route: string) => {
    const counts = readRouteCounts();
    counts[route] = (counts[route] ?? 0) + 1;
    localStorage.setItem('navRouteCounts', JSON.stringify(counts));
    updateMostVisited();
  };

  useEffect(() => {
    registerNavVisit(location.pathname);
    const activeGroup = groups.find((group) =>
      group.items.some((item) => item.to === location.pathname)
    );
    if (activeGroup && !openGroups[activeGroup.key]) {
      setOpenGroups((prev) => {
        const next = { ...prev, [activeGroup.key]: true };
        writeNavOpenGroups(next);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, allItems]);

  // Frequent shortcuts are promoted out of their groups so no link shows up twice.
  const visibleGroups = useMemo(() => {
    const promoted = new Set(mostVisited.map((item) => item.to));
    return groups
      .map((group) => ({ ...group, items: group.items.filter((item) => !promoted.has(item.to)) }))
      .filter((group) => group.items.length > 0);
  }, [groups, mostVisited]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      writeNavOpenGroups(next);
      return next;
    });
  };

  /** Keep collapse/expand in the top brand row in both sidebar modes. */
  const workspaceChrome = (
    <div className="tt-sidebar-brand-row layout-show-b">
      <ShellBrand compact={railCollapsed} />
      <button
        type="button"
        className="tt-icon-btn hidden md:inline-flex"
        data-testid="sidebar-collapse"
        onClick={toggleSidebarCollapsed}
        aria-label={
          railCollapsed
            ? text('Expandir menu lateral', 'Expand side menu')
            : text('Recolher menu lateral', 'Collapse side menu')
        }
        title={
          railCollapsed
            ? text('Expandir menu', 'Expand menu')
            : text('Recolher menu', 'Collapse menu')
        }
      >
        {railCollapsed ? '»' : '«'}
      </button>
    </div>
  );

  if (railCollapsed) {
    return (
      <aside
        aria-label={text('Navegação principal', 'Main navigation')}
        className="tt-sidebar tt-sidebar--rail"
        data-testid="app-sidebar"
      >
        {workspaceChrome}
        <nav
          className="tt-sidebar-scroll min-h-0 flex-1 space-y-2"
          aria-label={text('Seções', 'Sections')}
        >
          {navEntries.map((entry) => {
            if (entry.kind === 'link') {
              const active =
                location.pathname === entry.item.to ||
                location.pathname.startsWith(`${entry.item.to}/`);
              return (
                <RailNavLink
                  key={entry.key}
                  to={entry.item.to}
                  label={entry.item.label}
                  mark={entry.mark}
                  active={active}
                />
              );
            }
            const { group } = entry;
            const first = group.items[0];
            if (!first) return null;
            const active = group.items.some(
              (item) =>
                location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
            );
            return (
              <RailNavLink
                key={group.key}
                to={first.to}
                label={group.label}
                mark={group.mark}
                active={active}
              />
            );
          })}
        </nav>
      </aside>
    );
  }

  return (
    <aside
      aria-label={text('Navegação principal', 'Main navigation')}
      className="tt-sidebar"
      data-testid="app-sidebar"
    >
      {/* Chrome outside scroll so collapse Y matches the rail (collapsed) mode. */}
      {workspaceChrome}
      <div className="tt-sidebar-scroll min-h-0 flex-1">
        <nav className="space-y-4" aria-label={text('Seções', 'Sections')}>
          {mostVisited.length > 0 ? (
            <div className="space-y-2">
              <p className="tt-nav-section-label">{text('Mais acessados', 'Frequently used')}</p>
              <div className="space-y-1">
                {mostVisited.map((item) => (
                  <NavLink
                    key={`top-${item.to}`}
                    to={item.to}
                    end
                    title={text(`Visitado ${item.count}x`, `Visited ${item.count}x`)}
                    className={({ isActive }) => `tt-nav-link ${isActive ? 'active' : ''}`}
                  >
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ) : null}
          {presentNavGroups(visibleGroups).map((entry) => {
            if (entry.kind === 'link') {
              return (
                <NavLink
                  key={entry.key}
                  to={entry.item.to}
                  end
                  className={({ isActive }) => `tt-nav-link ${isActive ? 'active' : ''}`}
                >
                  <span>{entry.item.label}</span>
                  <span className="text-xs opacity-60" aria-hidden="true">
                    →
                  </span>
                </NavLink>
              );
            }
            const { group } = entry;
            const expanded = Boolean(openGroups[group.key]);
            const panelId = `nav-group-${group.key}`;
            return (
              <div key={group.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  className="tt-nav-group-toggle"
                >
                  <span>{group.label}</span>
                  <span aria-hidden="true">{expanded ? '−' : '+'}</span>
                </button>
                {expanded ? (
                  <div id={panelId} className="space-y-1" role="group" aria-label={group.label}>
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end
                        className={({ isActive }) => `tt-nav-link ${isActive ? 'active' : ''}`}
                      >
                        <span>{item.label}</span>
                        <span className="text-xs opacity-60" aria-hidden="true">
                          →
                        </span>
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
