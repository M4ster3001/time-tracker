import type { AllocationType, IClientAllocation } from '../domain/allocation.types.js';
import { BadRequestError, ForbiddenError } from '../../../app/errors/app-error.js';
import { getWorkingDaysInMonth } from '../../../shared/domain/date.js';
import {
  addDaysUTC,
  getStartOfNextMonthUTC,
  normalizeDateOnlyUTC,
} from '../../../services/date/utc-date.service.js';
import type { AllocationRepository } from '../domain/repositories/allocation.repository.js';
import type {
  AllocationTargetInput,
  UpsertConsultantAllocationInput,
} from './allocation.service.interfaces.js';
import type { ConsultantAllocationListItem } from '../domain/repositories/allocation.repository.types.js';
import { allocationRepository } from '../infrastructure/repositories/prisma-allocation.repository.js';

const MAX_DAILY_HOURS = 24;
const MAX_MONTHLY_HOURS = 744;
const MAX_HOURLY_RATE = 100000;

const defaultRepository = allocationRepository;

const validateAllocationInput = (
  allocationType: AllocationType,
  hoursPerDay?: number | null,
  hoursPerMonth?: number | null,
  hourlyRate?: number | null
): void => {
  if (allocationType === 'DAILY') {
    if (hoursPerDay == null || hoursPerDay < 0 || hoursPerDay > MAX_DAILY_HOURS) {
      throw new BadRequestError('Invalid daily allocation');
    }
  } else if (hoursPerMonth == null || hoursPerMonth < 0 || hoursPerMonth > MAX_MONTHLY_HOURS) {
    throw new BadRequestError('Invalid monthly allocation');
  }

  if (hourlyRate != null && (hourlyRate < 0 || hourlyRate > MAX_HOURLY_RATE)) {
    throw new BadRequestError('Invalid hourly rate');
  }
};

const assertUserClientAccess = async (
  repository: AllocationRepository,
  userId: number,
  clientId: number
): Promise<void> => {
  const hasLink = await repository.hasUserClientLink(userId, clientId);
  if (!hasLink) {
    throw new ForbiddenError('User is not assigned to this client');
  }
};

export const getDefaultAllocationEffectiveFrom = (): Date => getStartOfNextMonthUTC();

export const listConsultantAllocations = async (
  consultantId: number,
  repository: AllocationRepository = defaultRepository
): Promise<ConsultantAllocationListItem[]> => repository.listConsultantAllocations(consultantId);

export const upsertConsultantAllocation = async (
  params: UpsertConsultantAllocationInput,
  repository: AllocationRepository = defaultRepository
): Promise<IClientAllocation> => {
  validateAllocationInput(
    params.allocationType,
    params.hoursPerDay,
    params.hoursPerMonth,
    params.hourlyRate
  );
  await assertUserClientAccess(repository, params.consultantId, params.clientId);

  const effectiveFrom = normalizeDateOnlyUTC(
    params.effectiveFrom ? params.effectiveFrom : getDefaultAllocationEffectiveFrom()
  );

  return repository.upsertConsultantAllocation({
    consultantId: params.consultantId,
    clientId: params.clientId,
    allocationType: params.allocationType,
    hoursPerDay: params.allocationType === 'DAILY' ? (params.hoursPerDay ?? null) : null,
    hoursPerMonth: params.allocationType === 'MONTHLY' ? (params.hoursPerMonth ?? null) : null,
    hourlyRate: params.hourlyRate,
    effectiveFrom,
    createdBy: params.createdBy ?? null,
  });
};

export const deleteConsultantAllocation = async (
  consultantId: number,
  clientId: number,
  repository: AllocationRepository = defaultRepository
): Promise<void> => {
  await assertUserClientAccess(repository, consultantId, clientId);
  await repository.deleteConsultantAllocation(consultantId, clientId);
};

export const getAllocationAtDate = async (
  userId: number,
  clientId: number,
  date: Date,
  repository: AllocationRepository = defaultRepository
): Promise<IClientAllocation | null> => repository.getAllocationAtDate(userId, clientId, date);

export const getAllocationsInRange = async (
  userId: number,
  clientId: number,
  startDate: Date,
  endDate: Date,
  repository: AllocationRepository = defaultRepository
): Promise<IClientAllocation[]> =>
  repository.getAllocationsInRange(userId, clientId, startDate, endDate);

export const getAllocationTargetMinutes = (
  allocation: AllocationTargetInput,
  year: number,
  month: number
): number => {
  if (allocation.allocationType === 'DAILY') {
    const daily = allocation.hoursPerDay ?? 0;
    return Math.round(daily * getWorkingDaysInMonth(year, month) * 60);
  }
  const monthly = allocation.hoursPerMonth ?? 0;
  return Math.round(monthly * 60);
};

export const normalizeAllocationDate = (date: Date): Date => normalizeDateOnlyUTC(date);

export { addDaysUTC };
