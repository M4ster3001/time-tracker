/** Le e valida o valor salvo no storage informado, caindo para o default se ausente/invalido. */
export const readStoredValue = <T extends string>(
  storage: Pick<Storage, 'getItem'>,
  key: string,
  defaultValue: T,
  isValid: (value: string) => value is T
): T => {
  const stored = storage.getItem(key);
  return stored !== null && isValid(stored) ? stored : defaultValue;
};
