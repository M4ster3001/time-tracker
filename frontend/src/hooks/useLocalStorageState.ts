import { useEffect, useState } from 'react';
import { readStoredValue } from './useLocalStorageState.logic';

/**
 * Estado persistido no localStorage, validado contra um conjunto conhecido de valores.
 * Substitui os toggles `layoutMode`/`viewMode` reimplementados manualmente em cada dashboard.
 */
export const useLocalStorageState = <T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: string) => value is T
): [T, (value: T) => void] => {
  const [value, setValue] = useState<T>(() =>
    readStoredValue(window.localStorage, key, defaultValue, isValid)
  );

  useEffect(() => {
    window.localStorage.setItem(key, value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  return [value, setValue];
};
