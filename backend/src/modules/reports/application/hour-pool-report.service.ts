import { computeCycleSummaryForUser } from '../../closing-cycle/application/closing-cycle.service.js';
import { reportRepository } from '../infrastructure/repositories/prisma-report.repository.js';
import { getMonthRangeUTC } from '../../../shared/domain/date.js';
import type { HourPoolFilters, HourPoolLineItem } from './report.service.interfaces.js';
import { Prisma } from '@prisma/client';

const round2 = (value: number): number => Math.round(value * 100) / 100;
const toHours = (minutes: number): number => round2(minutes / 60);

/**
 * Bolsao de horas: para cada consultor x cliente com alocacao ou horas no ciclo fechado do mes,
 * cruza horas trabalhadas (do modulo closing-cycle) com o valor/hora cadastrado na alocacao e a
 * flag "paga hora extra" do cliente, pra saber quanto cobrar.
 */
export const getHourPoolReport = async (filters: HourPoolFilters): Promise<HourPoolLineItem[]> => {
  const { start, end } = getMonthRangeUTC(filters.year, filters.month);

  const { baseConsultants, allocations } = await reportRepository.getConsultantPerformanceData({
    clientId: filters.clientId,
    startDate: start,
    endDate: end,
  });

  const consultants = baseConsultants.filter(
    (user) => !filters.consultantId || user.id === filters.consultantId
  );

  const cycleByConsultant = new Map(
    await Promise.all(
      consultants.map(
        async (consultant) =>
          [
            consultant.id,
            await computeCycleSummaryForUser({
              userId: consultant.id,
              year: filters.year,
              month: filters.month,
              clientId: filters.clientId,
            }),
          ] as const
      )
    )
  );

  const rateByConsultantClient = new Map<string, number | null>();
  const overtimeByClient = new Map<number, boolean>();
  const codeByClient = new Map<number, string>();
  allocations.forEach((allocation) => {
    rateByConsultantClient.set(`${allocation.userId}:${allocation.clientId}`, allocation.hourlyRate);
    overtimeByClient.set(allocation.clientId, allocation.client.paysOvertime);
    codeByClient.set(allocation.clientId, allocation.client.code);
  });

  const lineItems: HourPoolLineItem[] = [];

  consultants.forEach((consultant) => {
    const cycleSummary = cycleByConsultant.get(consultant.id);
    if (!cycleSummary) return;

    cycleSummary.byClient
      .filter((client) => !filters.clientId || client.clientId === filters.clientId)
      .filter((client) => client.closedCycle.workedMinutes > 0 || client.closedCycle.targetMinutes > 0)
      .forEach((client) => {
        const hourlyRate = rateByConsultantClient.get(`${consultant.id}:${client.clientId}`) ?? null;
        const paysOvertime = overtimeByClient.get(client.clientId) ?? true;

        const workedHours = toHours(client.closedCycle.workedMinutes);
        const overtimeHours = toHours(client.closedCycle.overtimeMinutes);
        const billableMinutes = paysOvertime ? client.closedCycle.workedMinutes :
          client.closedCycle.workedMinutes - client.closedCycle.overtimeMinutes;
        const billableHours = toHours(billableMinutes);

        lineItems.push({
          consultantId: consultant.id,
          consultantName: consultant.name,
          clientId: client.clientId,
          clientName: client.clientName,
          clientCode: codeByClient.get(client.clientId) ?? '',
          paysOvertime,
          cycleStart: client.closedCycle.startDate,
          cycleEnd: client.closedCycle.endDate,
          allocatedHours: toHours(client.closedCycle.targetMinutes),
          workedHours,
          overtimeHours,
          billableHours,
          hourlyRate,
          billableAmount: hourlyRate !== null ? new Prisma.Decimal(billableMinutes)
            .mul(hourlyRate).div(60).toDecimalPlaces(2).toNumber() : null,
        });
      });
  });

  return lineItems.sort(
    (a, b) =>
      a.clientName.localeCompare(b.clientName, 'pt-BR') ||
      a.consultantName.localeCompare(b.consultantName, 'pt-BR')
  );
};
