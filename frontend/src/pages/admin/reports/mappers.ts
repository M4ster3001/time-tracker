export const getUtilizationColor = (percent: number | null) => {
  if (percent === null) return 'text-tt-text-muted';
  if (percent < 50) return 'text-tt-danger';
  if (percent < 80) return 'text-tt-warning';
  if (percent <= 100) return 'text-tt-success';
  return 'text-tt-info';
};

export const getUtilizationBg = (percent: number | null) => {
  if (percent === null) return 'bg-tt-elevated';
  if (percent < 50) return 'bg-tt-danger-soft';
  if (percent < 80) return 'bg-tt-elevated';
  if (percent <= 100) return 'bg-tt-success-soft';
  return 'bg-tt-info-soft';
};

export const formatUtilization = (percent: number | null) =>
  percent === null ? 'N/A' : `${percent}%`;
