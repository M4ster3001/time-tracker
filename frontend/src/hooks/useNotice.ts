import { useCallback, useEffect, useRef, useState } from 'react';

export type NoticeType = 'success' | 'error';

export interface Notice {
  type: NoticeType;
  message: string;
}

/**
 * Extrai o padrao de toast temporario (notice + timeout + limpeza ao desmontar)
 * duplicado nas paginas de alocacao e em outras telas legado.
 */
export const useNotice = (timeoutMs = 3000) => {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const showNotice = useCallback(
    (type: NoticeType, message: string) => {
      setNotice({ type, message });
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setNotice(null);
        timeoutRef.current = null;
      }, timeoutMs);
    },
    [timeoutMs]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { notice, showNotice };
};
