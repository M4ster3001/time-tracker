/** LAN CORS (RFC1918) is a local/dev convenience — never staging/demo/prod. */

const PRIVATE_LAN_CORS_ENVS = new Set(['development', 'test']);

export const usesPrivateLanCorsEnv = (env: string): boolean => PRIVATE_LAN_CORS_ENVS.has(env);

export const resolveAllowPrivateLan = (params: {
  env: string;
  flagRequested: boolean;
}): boolean => params.flagRequested && usesPrivateLanCorsEnv(params.env);

/**
 * Fail-fast when an operator turns on CORS_ALLOW_PRIVATE_LAN outside local envs.
 * Prevents staging from silently widening CSRF/CORS to any RFC1918 Origin.
 */
export const assertCorsPrivateLanFlagSafe = (params: {
  env: string;
  flagRequested: boolean;
}): void => {
  if (!params.flagRequested) return;
  if (usesPrivateLanCorsEnv(params.env)) return;
  throw new Error(
    `FATAL: CORS_ALLOW_PRIVATE_LAN=true is not allowed in ${params.env} (only development/test). Use explicit CORS_ORIGIN instead.`
  );
};
