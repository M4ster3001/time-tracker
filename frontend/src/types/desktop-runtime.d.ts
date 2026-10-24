interface DesktopRuntimeApi {
  getApiBaseUrl: () => string;
  isDesktop: boolean;
}

declare global {
  interface Window {
    desktopRuntime?: DesktopRuntimeApi;
  }
}

export {};
