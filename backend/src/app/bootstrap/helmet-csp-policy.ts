import type { HelmetOptions } from 'helmet';

export type HelmetCspRuntime = {
  desktopMode: boolean;
};

/**
 * Explicit Helmet options: API responses get a lock-down CSP; desktop mode
 * (Express serving the SPA) allows self assets. Avoid CORP same-origin so a
 * separate Vite/prod frontend origin can still call the API with CORS.
 */
export const resolveHelmetOptions = (runtime: HelmetCspRuntime): HelmetOptions => {
  if (runtime.desktopMode) {
    return {
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    };
  }

  return {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    // SPA often lives on another origin (CORS); CORP same-origin would break fetches.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  };
};
