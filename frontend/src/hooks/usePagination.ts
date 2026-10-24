import { useEffect, useMemo, useState } from 'react';
import { paginate } from './usePagination.logic';

/**
 * Extrai o padrao de paginacao (fatiar a lista + resetar para a pagina 1 quando os
 * itens ou o tamanho de pagina mudam) duplicado nas paginas de alocacao e outras
 * telas com tabela. Usar junto com o componente compartilhado `components/Pagination`.
 */
export const usePagination = <T>(items: T[], initialPageSize = 10) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [items, pageSize]);

  const paginatedItems = useMemo(() => paginate(items, page, pageSize), [items, page, pageSize]);

  return { page, pageSize, setPage, setPageSize, paginatedItems };
};
