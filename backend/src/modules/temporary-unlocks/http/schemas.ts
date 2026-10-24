import { z } from 'zod';

export const grantTemporaryUnlockSchema = z.object({
  userId: z.coerce.number().int().positive(),
  clientId: z.coerce.number().int().positive(),
  periodYear: z.coerce.number().int(),
  periodMonth: z.coerce.number().int(),
  reason: z.string().trim().min(1),
  durationHours: z.coerce.number().positive().optional(),
});

export const temporaryUnlockListQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  clientId: z.coerce.number().int().positive().optional(),
  activeOnly: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export const temporaryUnlockIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
