/** Fatia `items` para a pagina/tamanho pedidos. */
export const paginate = <T>(items: T[], page: number, pageSize: number): T[] => {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
};

/** Garante que a pagina atual nunca fique acima do total disponivel (ex: apos filtrar a lista). */
export const clampPage = (page: number, totalItems: number, pageSize: number): number => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return Math.min(Math.max(1, page), totalPages);
};
