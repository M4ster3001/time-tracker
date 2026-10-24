import type { Request, Response } from 'express';
import type { IApiResponse } from '../../../shared/domain/api-response.types.js';
import { getErrorMessage, resolveErrorStatus } from '../../../app/errors/app-error.js';
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

export const listAdminConsultantAllocationsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params as AllocationRouteParams;
    const consultantId = Number(id);
    if (Number.isNaN(consultantId)) {
      res
        .status(400)
        .json({ success: false, error: 'Invalid consultant id' } as IApiResponse<null>);
      return;
    }

    const allocations = await listConsultantAllocations(consultantId);
    res.status(200).json({ success: true, data: allocations } as IApiResponse<typeof allocations>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const upsertAdminConsultantAllocationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id, clientId } = req.params as AllocationRouteParams;
    const consultantId = Number(id);
    const parsedClientId = Number(clientId);
    if (Number.isNaN(consultantId) || Number.isNaN(parsedClientId)) {
      res.status(400).json({ success: false, error: 'Invalid ids' } as IApiResponse<null>);
      return;
    }

    const { allocationType, hoursPerDay, hoursPerMonth, hourlyRate } = req.body;
    const allocation = await upsertConsultantAllocation({
      consultantId,
      clientId: parsedClientId,
      allocationType,
      hoursPerDay: parseAllocationNumber(hoursPerDay),
      hoursPerMonth: parseAllocationNumber(hoursPerMonth),
      hourlyRate: parseAllocationNumber(hourlyRate),
      effectiveFrom: getDefaultAllocationEffectiveFrom(),
      createdBy: req.user?.userId ?? null,
    });

    allocationRepository
      .createAuditLog({
        userId: req.user?.userId ?? null,
        endpoint: `/api/users/${consultantId}/allocations/${clientId}`,
        action: 'UPSERT_ALLOCATION',
        status: 'success',
        details: `type=${allocationType};effectiveFrom=${getDefaultAllocationEffectiveFrom()
          .toISOString()
          .slice(0, 10)};scope=admin`,
      })
      .catch((error) => {
        logger.error({ err: error }, 'Failed to log admin allocation update');
      });

    res.status(200).json({ success: true, data: allocation } as IApiResponse<typeof allocation>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};

export const deleteAdminConsultantAllocationController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id, clientId } = req.params as AllocationRouteParams;
    const consultantId = Number(id);
    const parsedClientId = Number(clientId);
    if (Number.isNaN(consultantId) || Number.isNaN(parsedClientId)) {
      res.status(400).json({ success: false, error: 'Invalid ids' } as IApiResponse<null>);
      return;
    }

    await deleteConsultantAllocation(consultantId, parsedClientId);

    allocationRepository
      .createAuditLog({
        userId: req.user?.userId ?? null,
        endpoint: `/api/users/${consultantId}/allocations/${parsedClientId}`,
        action: 'DELETE_ALLOCATION',
        status: 'success',
        details: 'scope=admin',
      })
      .catch((error) => {
        logger.error({ err: error }, 'Failed to log admin allocation delete');
      });
    res.status(200).json({ success: true } as IApiResponse<null>);
  } catch (error) {
    res
      .status(resolveErrorStatus(error))
      .json({ success: false, error: getErrorMessage(error) } as IApiResponse<null>);
  }
};
