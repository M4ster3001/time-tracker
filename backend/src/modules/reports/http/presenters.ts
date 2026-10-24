import type {
  ClientCapacity,
  ConsultantPerformance,
} from '../application/report.service.interfaces.js';

const round0 = (value: number): number => Math.round(value);

const averageUtilization = (values: Array<number | null>): number => {
  const numeric = values.filter((value): value is number => typeof value === 'number');
  if (numeric.length === 0) return 0;
  return round0(numeric.reduce((sum, value) => sum + value, 0) / numeric.length);
};

export const buildConsultantPerformanceSummary = (report: ConsultantPerformance[]) => {
  const utilizationValues = report.map((item) => item.utilizationPercent);

  return {
    totalConsultants: report.length,
    averageUtilization: averageUtilization(utilizationValues),
    underUtilized: report.filter(
      (item) => typeof item.utilizationPercent === 'number' && item.utilizationPercent < 80
    ).length,
    overUtilized: report.filter(
      (item) => typeof item.utilizationPercent === 'number' && item.utilizationPercent > 100
    ).length,
  };
};

export const buildConsultantPerformanceResponse = (report: ConsultantPerformance[]) => {
  return {
    success: true,
    data: report,
    summary: buildConsultantPerformanceSummary(report),
  };
};

export const buildClientCapacitySummary = (report: ClientCapacity[]) => {
  const utilizationValues = report.map((item) => item.utilizationPercent);

  return {
    totalClients: report.length,
    totalAllocatedHours:
      Math.round(report.reduce((sum, item) => sum + item.totalAllocatedHours, 0) * 100) / 100,
    totalWorkedHours:
      Math.round(report.reduce((sum, item) => sum + item.totalWorkedHours, 0) * 100) / 100,
    totalRemainingHours:
      Math.round(report.reduce((sum, item) => sum + item.remainingHours, 0) * 100) / 100,
    averageUtilization: averageUtilization(utilizationValues),
    nearCapacity: report.filter((item) => item.remainingHours < 10 && item.remainingHours >= 0)
      .length,
    overCapacity: report.filter((item) => item.remainingHours < 0).length,
  };
};

export const buildClientCapacityResponse = (report: ClientCapacity[]) => {
  return {
    success: true,
    data: report,
    summary: buildClientCapacitySummary(report),
  };
};
