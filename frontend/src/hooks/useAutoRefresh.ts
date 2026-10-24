import { useEffect } from 'react';

/**
 * Roda `callback` a cada `intervalMs`, reiniciando o timer quando `deps` mudar.
 * Extrai o boilerplate de setInterval/clearInterval duplicado nos dashboards
 * (admin/manager) para o refresh em segundo plano.
 */
export const useAutoRefresh = (
  callback: () => void | Promise<void>,
  intervalMs: number,
  deps: unknown[]
): void => {
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void callback();
    }, intervalMs);

    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};
