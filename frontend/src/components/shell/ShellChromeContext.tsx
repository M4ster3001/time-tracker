import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  readSidebarCollapsed,
  writeSidebarCollapsed,
} from './shellPreferences';

type ShellChromeValue = {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  helpOpen: boolean;
  helpTopicId: string | null;
  openHelp: (topicId?: string) => void;
  closeHelp: () => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
};

const ShellChromeContext = createContext<ShellChromeValue | null>(null);

export const ShellChromeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarCollapsed, setCollapsedState] = useState(() => readSidebarCollapsed());
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTopicId, setHelpTopicId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const setSidebarCollapsed = useCallback((collapsed: boolean) => {
    setCollapsedState(collapsed);
    writeSidebarCollapsed(collapsed);
  }, []);

  const toggleSidebarCollapsed = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      writeSidebarCollapsed(next);
      return next;
    });
  }, []);

  const openHelp = useCallback((topicId?: string) => {
    setHelpTopicId(topicId ?? null);
    setHelpOpen(true);
  }, []);

  const closeHelp = useCallback(() => {
    setHelpOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      helpOpen,
      helpTopicId,
      openHelp,
      closeHelp,
      searchOpen,
      setSearchOpen,
    }),
    [
      sidebarCollapsed,
      setSidebarCollapsed,
      toggleSidebarCollapsed,
      helpOpen,
      helpTopicId,
      openHelp,
      closeHelp,
      searchOpen,
      setSearchOpen,
    ]
  );

  return (
    <ShellChromeContext.Provider value={value}>{children}</ShellChromeContext.Provider>
  );
};

export const useShellChrome = (): ShellChromeValue => {
  const value = useContext(ShellChromeContext);
  if (!value) {
    throw new Error('ShellChromeProvider is required');
  }
  return value;
};
