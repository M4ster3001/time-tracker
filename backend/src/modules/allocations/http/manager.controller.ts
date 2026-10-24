import type { Request, Response } from 'express';
import type { IApiResponse } from '../../../shared/domain/api-response.types.js';
import {
  ForbiddenError,
  getErrorMessage,
  resolveErrorStatus,
} from '../../../app/errors/app-error.js';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import {
  deleteConsultantAllocation,
  getDefaultAllocationEffectiveFrom,
  listConsultantAllocations,
  upsertConsultantAllocation,
} from '../application/allocation.service.js';
import { allocationRepository } from '../infrastructure/repositories/prisma-allocation.repository.js';
import type { AllocationRouteParams } from './allocation.http.interfaces.js';

const parseAllocationNumber = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const assertManagerAccessToConsultant = async (
  managerId: number,
  consultantId: number
): Promise<void> => {
  const hasAccess = await allocationRepository.hasManagerAccessToConsultant(
    managerId,
    consultantId
  );
  if (!hasAccess) {
    throw new ForbiddenError('Manager does not have access to this consultant');
  }
};

export const listManagedConsultantAllocationsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const { id } = req.params as AllocationRouteParams;
    const consultantId = Number(id);
    if (Number.isNaN(consultantId)) {
      res
        .status(400)
        .json({ success: false, error: 'Invalid consultant id' } as IApiResponse<null>);
      return;
    }

    await assertManagerAccessToConsultant(req.user.userId, consultantId);
    const allocations = await listConsultantAllocations(consultantId);
    res.status(200).json({ success: true, data: allocations } as IApiResponse<typeof allocations>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const upsertManagedConsultantAllocationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const { id, clientId } = req.params as AllocationRouteParams;
    const consultantId = Number(id);
    const parsedClientId = Number(clientId);
    if (Number.isNaN(consultantId) || Number.isNaN(parsedClientId)) {
      res.status(400).json({ success: false, error: 'Invalid ids' } as IApiResponse<null>);
      return;
    }

    await assertManagerAccessToConsultant(req.user.userId, consultantId);

    const { allocationType, hoursPerDay, hoursPerMonth, hourlyRate } = req.body;
    const effectiveFrom = getDefaultAllocationEffectiveFrom().toISOString().slice(0, 10);
    const allocation = await upsertConsultantAllocation({
      consultantId,
      clientId: parsedClientId,
      allocationType,
      hoursPerDay: parseAllocationNumber(hoursPerDay),
      hoursPerMonth: parseAllocationNumber(hoursPerMonth),
      hourlyRate: parseAllocationNumber(hourlyRate),
      effectiveFrom: getDefaultAllocationEffectiveFrom(),
      createdBy: req.user.userId,
    });

    allocationRepository
      .createAuditLog({
        userId: req.user.userId,
        endpoint: `/api/manager/consultants/${consultantId}/allocations/${clientId}`,
        action: 'UPSERT_ALLOCATION',
        status: 'success',
        details: `type=${allocationType};effectiveFrom=${effectiveFrom};scope=manager`,
      })
      .catch((error) => {
        logger.error({ err: error }, 'Failed to log manager allocation update');
      });

    res.status(200).json({ success: true, data: allocation } as IApiResponse<typeof allocation>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};

export const deleteManagedConsultantAllocationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' } as IApiResponse<null>);
      return;
    }

    const { id, clientId } = req.params as AllocationRouteParams;
    const consultantId = Number(id);
    const parsedClientId = Number(clientId);
    if (Number.isNaN(consultantId) || Number.isNaN(parsedClientId)) {
      res.status(400).json({ success: false, error: 'Invalid ids' } as IApiResponse<null>);
      return;
    }

    await assertManagerAccessToConsultant(req.user.userId, consultantId);
    await deleteConsultantAllocation(consultantId, parsedClientId);

    allocationRepository
      .createAuditLog({
        userId: req.user.userId,
        endpoint: `/api/manager/consultants/${consultantId}/allocations/${parsedClientId}`,
        action: 'DELETE_ALLOCATION',
        status: 'success',
        details: 'scope=manager',
      })
      .catch((error) => {
        logger.error({ err: error }, 'Failed to log manager allocation delete');
      });

    res.status(200).json({ success: true } as IApiResponse<null>);
  } catch (error) {
    const message = getErrorMessage(error);
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: message } as IApiResponse<null>);
  }
};
