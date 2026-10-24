import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';
import { setLocale, type Locale } from '../i18n';

export type Grant = { permission: string; scope: 'self' | 'team' | 'all' };
export type NavigationEntry = { path: string; label: string; labelEn: string; section: string };
type Capabilities = {
  grants: Grant[];
  flows: Record<string, boolean>;
  locale: Locale;
  navigation: NavigationEntry[];
};
type Value = {
  capabilities: Capabilities | null;
  loading: boolean;
  error: boolean;
  refresh: () => Promise<void>;
  can: (permission: string, scope?: 'self' | 'team' | 'all') => boolean;
  canVisit: (path: string) => boolean;
};
export const CapabilitiesContext = createContext<Value | null>(null);
const Context = CapabilitiesContext;
const rank = { self: 0, team: 1, all: 2 };

export const CapabilitiesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const identity = useRef(user?.id);
  identity.current = user?.id;
  const generation = useRef(0);
  const hasCapabilities = useRef(false);
  const lastFocusRefresh = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    const userId = user?.id;
    if (!user) {
      setCapabilities(null);
      setLoadedFor(null);
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const result = await api.get('/api/capabilities');
      const data = result.data.data as Capabilities;
      if (identity.current !== userId || generation.current !== request) return;
      setCapabilities(data);
      hasCapabilities.current = true;
      setLocale(data.locale === 'en' ? 'en' : 'pt-BR');
    } catch {
      // A transient failure on a background refresh (e.g. 429 on window focus) must not
      // throw away permissions we already have; only a first load is a hard error.
      if (identity.current === userId && generation.current === request && !hasCapabilities.current) {
        setCapabilities(null);
        setError(true);
      }
    } finally {
      if (identity.current === userId && generation.current === request) {
        setLoadedFor(userId ?? null);
        setLoading(false);
      }
    }
  }, [user?.id]);
  useEffect(() => {
    setLoading(true);
    setCapabilities(null);
    hasCapabilities.current = false;
    void refresh();
    const update = () => {
      void refresh();
    };
    const onFocus = () => {
      const now = Date.now();
      if (now - lastFocusRefresh.current < 30_000) return;
      lastFocusRefresh.current = now;
      update();
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('access:changed', update);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('access:changed', update);
    };
  }, [refresh]);
  const can = (permission: string, scope: 'self' | 'team' | 'all' = 'self') =>
    Boolean(
      capabilities?.grants.some(
        (grant) => grant.permission === permission && rank[grant.scope] >= rank[scope]
      )
    );
  const canVisit = (path: string) =>
    path === '/dashboard' ||
    Boolean(capabilities?.navigation.some((entry) => entry.path === path)) ||
    (/^\/time-entries\/\d+\/edit$/.test(path) && can('time.write'));
  return (
    <Context.Provider
      value={{
        capabilities,
        loading: loading || Boolean(user && loadedFor !== user.id),
        error,
        refresh,
        can,
        canVisit,
      }}
    >
      {children}
    </Context.Provider>
  );
};
export const useCapabilities = (): Value => {
  const value = useContext(Context);
  if (!value) throw new Error('CapabilitiesProvider is required');
  return value;
};
