const DERIVE_ALLOWED_ENVS = new Set(['development', 'test']);

export const allowsDerivedFieldEncryptionKey = (env: string): boolean =>
  DERIVE_ALLOWED_ENVS.has(env);

export const assertFieldEncryptionKeyConfigured = (params: {
  env: string;
  fieldEncryptionKey?: string | null;
}): void => {
  const key = params.fieldEncryptionKey?.trim();
  if (key) return;
  if (allowsDerivedFieldEncryptionKey(params.env)) return;
  throw new Error(
    `FATAL: FIELD_ENCRYPTION_KEY is required in ${params.env} (derivation from JWT_SECRET is only allowed in development/test)`
  );
};
