const RELAXED_AUTH_ENVS = new Set(['development', 'test']);

export const usesRelaxedAuthRateLimits = (env: string): boolean => RELAXED_AUTH_ENVS.has(env);

export const resolveLoginRateLimitMax = (env: string, configuredMax: number): number => {
  if (usesRelaxedAuthRateLimits(env)) return Math.max(configuredMax, 100);
  return configuredMax;
};

export const resolveRefreshRateLimitMax = (env: string): number => {
  if (usesRelaxedAuthRateLimits(env)) return 200;
  return 20;
};
