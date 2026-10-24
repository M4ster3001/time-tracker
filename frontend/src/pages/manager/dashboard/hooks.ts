import { useState } from 'react';
import { MANAGER_DASHBOARD_VIEW_STORAGE_KEY } from './constants';
import type { ManagerDashboardViewMode } from './types';

export const useStoredDashboardViewMode = (): [
  ManagerDashboardViewMode,
  (mode: ManagerDashboardViewMode) => void,
] => {
  const [viewMode, setViewModeState] = useState<ManagerDashboardViewMode>(() => {
    const stored = window.localStorage.getItem(MANAGER_DASHBOARD_VIEW_STORAGE_KEY);
    return stored === 'list' || stored === 'cards' ? stored : 'cards';
  });

  const setViewMode = (mode: ManagerDashboardViewMode) => {
    setViewModeState(mode);
    window.localStorage.setItem(MANAGER_DASHBOARD_VIEW_STORAGE_KEY, mode);
  };

  return [viewMode, setViewMode];
};
