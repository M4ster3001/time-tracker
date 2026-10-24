import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { BadRequestError, ForbiddenError } from '../../../app/errors/app-error.js';
import { getFlows } from '../../access-control/application/access-control.service.js';
import {
  DEFAULT_CALIBRATION_THRESHOLDS,
  parseCalibrationThresholdConfig,
  type CalibrationThresholdConfig,
} from '../domain/calibration-thresholds.js';

const POLICY_ID = 1;

export const getCalibrationThresholdConfig = async (): Promise<CalibrationThresholdConfig> => {
  const row = await prisma.calibrationPolicy.findUnique({ where: { id: POLICY_ID } });
  if (!row) return { ...DEFAULT_CALIBRATION_THRESHOLDS };
  return {
    minSampleSize: row.minSampleSize,
    minMeasuredSampleSize: row.minMeasuredSampleSize,
    maxMedianAbsoluteErrorMinutes: row.maxMedianAbsoluteErrorMinutes,
    maxAbsoluteBiasMinutes: row.maxAbsoluteBiasMinutes,
  };
};

export const saveCalibrationThresholdConfig = async (input: {
  actorUserId: number;
  config: unknown;
}): Promise<CalibrationThresholdConfig> => {
  const flows = await getFlows();
  if (!flows.estimates) throw new ForbiddenError('FLOW_DISABLED');

  let parsed: CalibrationThresholdConfig;
  try {
    parsed = parseCalibrationThresholdConfig(input.config);
  } catch (error) {
    if (error instanceof Error) throw new BadRequestError(error.message);
    throw error;
  }

  await prisma.calibrationPolicy.upsert({
    where: { id: POLICY_ID },
    create: {
      id: POLICY_ID,
      minSampleSize: parsed.minSampleSize,
      minMeasuredSampleSize: parsed.minMeasuredSampleSize,
      maxMedianAbsoluteErrorMinutes: parsed.maxMedianAbsoluteErrorMinutes,
      maxAbsoluteBiasMinutes: parsed.maxAbsoluteBiasMinutes,
      updatedByUserId: input.actorUserId,
    },
    update: {
      minSampleSize: parsed.minSampleSize,
      minMeasuredSampleSize: parsed.minMeasuredSampleSize,
      maxMedianAbsoluteErrorMinutes: parsed.maxMedianAbsoluteErrorMinutes,
      maxAbsoluteBiasMinutes: parsed.maxAbsoluteBiasMinutes,
      updatedByUserId: input.actorUserId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: input.actorUserId,
      endpoint: '/api/estimates/calibration/policy',
      action: 'CALIBRATION_POLICY_UPDATE',
      status: 'success',
      details: JSON.stringify(parsed).slice(0, 4000),
    },
  });

  return parsed;
};
