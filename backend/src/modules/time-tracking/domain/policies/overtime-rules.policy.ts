export interface OvertimeComputation {
  targetMinutes: number;
  normalMinutes: number;
  overtimeMinutes: number;
  normalByClient: Map<number, number>;
  overtimeByClient: Map<number, number>;
}

/**
 * Regras:
 * - Cliente com alocacao: normal ate a meta, excedente vira extra.
 * - Cliente sem alocacao: 100% das horas sao extras.
 */
export const computeOvertimeByAllocation = (
  minutesByClient: Map<number, number>,
  targetByClient: Map<number, number>
): OvertimeComputation => {
  const targetMinutes = Array.from(targetByClient.values()).reduce((acc, value) => acc + value, 0);
  const normalByClient = new Map<number, number>();
  const overtimeByClient = new Map<number, number>();

  const clientIds = new Set<number>([
    ...Array.from(minutesByClient.keys()),
    ...Array.from(targetByClient.keys()),
  ]);

  clientIds.forEach((clientId) => {
    const actual = minutesByClient.get(clientId) ?? 0;
    const hasAllocation = targetByClient.has(clientId);
    const target = targetByClient.get(clientId) ?? 0;

    if (!hasAllocation) {
      normalByClient.set(clientId, 0);
      overtimeByClient.set(clientId, actual);
      return;
    }

    const normal = Math.min(actual, target);
    const overtime = Math.max(0, actual - target);
    normalByClient.set(clientId, normal);
    overtimeByClient.set(clientId, overtime);
  });

  const normalMinutes = Array.from(normalByClient.values()).reduce((acc, value) => acc + value, 0);
  const overtimeMinutes = Array.from(overtimeByClient.values()).reduce(
    (acc, value) => acc + value,
    0
  );

  return {
    targetMinutes,
    normalMinutes,
    overtimeMinutes,
    normalByClient,
    overtimeByClient,
  };
};
