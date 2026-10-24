/**
 * True when the SPA is hosted by the Electron shell (bridge present, or loaded from
 * file://). On the web there is no `/api/desktop/*`, so probing it only produces a
 * 400 in the console on every visit.
 */
export const isDesktopShell = (): boolean =>
  typeof window !== 'undefined' &&
  Boolean(window.desktopRuntime?.isDesktop || window.location.protocol === 'file:');
