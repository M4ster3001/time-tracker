import axios from 'axios';

export const isAbortError = (error: unknown): boolean => {
  if (axios.isCancel?.(error)) return true;
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string; name?: string };
  return maybe.code === 'ERR_CANCELED' || maybe.name === 'CanceledError' || maybe.name === 'AbortError';
};
