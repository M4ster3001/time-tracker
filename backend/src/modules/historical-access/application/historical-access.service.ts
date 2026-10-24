import {
  canConsultantAccessClientWithHistory as canConsultantAccessClientWithHistoryPolicy,
  canManagerAccessConsultantOnDate as canManagerAccessConsultantOnDatePolicy,
  getAccessibleClientIdsForConsultant as getAccessibleClientIdsForConsultantPolicy,
  getAccessibleClientIdsForManager as getAccessibleClientIdsForManagerPolicy,
  getManagedConsultantIds as getManagedConsultantIdsPolicy,
} from '../../../shared/domain/policies/historical-access.policy.js';
import type { HistoricalAccessRepository } from '../domain/repositories/historical-access.repository.js';
import { historicalAccessRepository as defaultRepository } from '../infrastructure/repositories/prisma-historical-access.repository.js';

const toDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

export const getManagedConsultantIds = async (
  managerId: number,
  params?: { startDate?: Date; endDate?: Date },
  repository: HistoricalAccessRepository = defaultRepository
): Promise<number[]> => {
  const [currentConsultantIds, historicalConsultantIds] = await Promise.all([
    repository.findCurrentManagedConsultantIds(managerId),
    repository.findHistoricalManagedConsultantIds(managerId, params?.startDate, params?.endDate),
  ]);

  return getManagedConsultantIdsPolicy({ currentConsultantIds, historicalConsultantIds });
};

export const canManagerAccessConsultantOnDate = async (
  managerId: number,
  consultantId: number,
  date: Date,
  repository: HistoricalAccessRepository = defaultRepository
): Promise<boolean> => {
  if (managerId === consultantId) return true;

  const [currentLink, historicalAssignments] = await Promise.all([
    repository.findCurrentManagerLink(managerId, consultantId),
    repository.findHistoricalAssignmentWindows(managerId, consultantId, date),
  ]);

  return canManagerAccessConsultantOnDatePolicy({
    managerId,
    consultantId,
    currentLinkExists: Boolean(currentLink),
    assignmentWindows: historicalAssignments,
    date,
  });
};

export const syncManagerAssignmentHistory = async (
  params: {
    consultantId: number;
    previousManagerId: number | null;
    nextManagerId: number | null;
    effectiveDate?: Date;
  },
  repository: HistoricalAccessRepository = defaultRepository
): Promise<void> => {
  const effectiveDate = params.effectiveDate ?? new Date();
  const startDate = new Date(toDateOnly(effectiveDate));
  startDate.setUTCHours(0, 0, 0, 0);

  if (params.previousManagerId && params.previousManagerId !== params.nextManagerId) {
    const previousOpenAssignment = await repository.findOpenAssignment(
      params.previousManagerId,
      params.consultantId
    );

    if (previousOpenAssignment) {
      const previousEndDate = new Date(startDate);
      previousEndDate.setUTCDate(previousEndDate.getUTCDate() - 1);
      await repository.closeAssignment(previousOpenAssignment.id, previousEndDate);
    }
  }

  if (params.nextManagerId && params.previousManagerId !== params.nextManagerId) {
    const existingOpenAssignment = await repository.findOpenAssignment(
      params.nextManagerId,
      params.consultantId
    );

    if (!existingOpenAssignment) {
      await repository.createAssignment(params.nextManagerId, params.consultantId, startDate);
    }
  }
};

export const getAccessibleClientIdsForConsultant = async (
  userId: number,
  candidateClientIds?: number[],
  repository: HistoricalAccessRepository = defaultRepository
): Promise<number[]> => {
  const [linkedClientIds, historicalClientIds] = await Promise.all([
    repository.findLinkedClientIds(userId, candidateClientIds),
    repository.findClientIdsWithTimeEntries(userId, candidateClientIds),
  ]);

  return getAccessibleClientIdsForConsultantPolicy({ linkedClientIds, historicalClientIds });
};

export const canConsultantAccessClientWithHistory = async (
  userId: number,
  clientId: number,
  repository: HistoricalAccessRepository = defaultRepository
): Promise<boolean> => {
  const [linked, historical] = await Promise.all([
    repository.findClientLink(userId, clientId),
    repository.findAnyTimeEntry(userId, clientId),
  ]);

  return canConsultantAccessClientWithHistoryPolicy({
    linked: Boolean(linked),
    historical: Boolean(historical),
  });
};

export const getAccessibleClientIdsForManager = async (
  managerId: number,
  candidateClientIds?: number[],
  repository: HistoricalAccessRepository = defaultRepository
): Promise<number[]> => {
  const managedConsultantIds = await getManagedConsultantIds(managerId, undefined, repository);

  const [ownLinkedClientIds, managedLinkedClientIds, ownHistoricalClientIds, managedHistoricalClientIds] =
    await Promise.all([
      repository.findLinkedClientIds(managerId, candidateClientIds),
      repository.findLinkedClientIdsForUsers(managedConsultantIds, candidateClientIds),
      repository.findClientIdsWithTimeEntries(managerId, candidateClientIds),
      repository.findClientIdsWithTimeEntriesForUsers(managedConsultantIds, candidateClientIds),
    ]);

  return getAccessibleClientIdsForManagerPolicy({
    ownLinkedClientIds,
    managedLinkedClientIds,
    ownHistoricalClientIds,
    managedHistoricalClientIds,
  });
};
