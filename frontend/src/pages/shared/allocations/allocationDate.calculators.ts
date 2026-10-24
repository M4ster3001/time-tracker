/** Conta os dias uteis (seg-sex) de um mes, usado para converter horas/dia em meta mensal. */
export const buildWorkingDays = (year: number, month: number): number => {
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= totalDays; day += 1) {
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    if (weekday >= 1 && weekday <= 5) count += 1;
  }
  return count;
};

/** Primeiro dia do proximo mes (UTC) — data em que uma alocacao editada agora passa a valer. */
export const getNextMonthEffectiveDate = (referenceDate = new Date()): Date =>
  new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1));

export const formatEffectiveDate = (value: Date): string =>
  value.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
