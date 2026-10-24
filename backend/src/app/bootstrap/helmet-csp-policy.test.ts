import { describe, expect, it } from 'vitest';
import { resolveHelmetOptions } from './helmet-csp-policy.js';

describe('resolveHelmetOptions', () => {
  it('API (non-desktop): CSP default-src none and no framing', () => {
    const options = resolveHelmetOptions({ desktopMode: false });
    const csp = options.contentSecurityPolicy;
    expect(csp).not.toBe(false);
    expect(csp).not.toBe(true);
    if (typeof csp !== 'object' || csp === null) throw new Error('expected CSP object');
    const directives = 'directives' in csp ? csp.directives : undefined;
    expect(directives?.defaultSrc).toEqual(["'none'"]);
    expect(directives?.frameAncestors).toEqual(["'none'"]);
  });

  it('desktop SPA: allows self scripts/styles/connect without breaking static UI', () => {
    const options = resolveHelmetOptions({ desktopMode: true });
    const csp = options.contentSecurityPolicy;
    expect(csp).not.toBe(false);
    expect(csp).not.toBe(true);
    if (typeof csp !== 'object' || csp === null) throw new Error('expected CSP object');
    const directives = 'directives' in csp ? csp.directives : undefined;
    expect(directives?.defaultSrc).toEqual(["'self'"]);
    expect(directives?.scriptSrc).toEqual(["'self'"]);
    expect(directives?.styleSrc).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directives?.connectSrc).toEqual(["'self'"]);
    expect(directives?.frameAncestors).toEqual(["'none'"]);
  });

  it('never forces CORP same-origin (would break cross-origin SPA → API)', () => {
    const api = resolveHelmetOptions({ desktopMode: false });
    const desktop = resolveHelmetOptions({ desktopMode: true });
    expect(api.crossOriginResourcePolicy).not.toEqual({ policy: 'same-origin' });
    expect(desktop.crossOriginResourcePolicy).not.toEqual({ policy: 'same-origin' });
  });
});
