import { z } from 'zod';

const optionalPositiveInt = z.coerce.number().int().positive().optional();

export const consultantPerformanceQuerySchema = z
  .object({
    userId: optionalPositiveInt,
    managerId: optionalPositiveInt,
    clientId: optionalPositiveInt,
    startDate: z.string().trim().min(1),
    endDate: z.string().trim().min(1),
    includeInactive: z.enum(['true', 'false']).optional(),
  })
  .strict();

export const clientCapacityQuerySchema = z
  .object({
    clientId: optionalPositiveInt,
    startDate: z.string().trim().min(1),
    endDate: z.string().trim().min(1),
    includeInactive: z.enum(['true', 'false']).optional(),
  })
  .strict();

export const hourPoolQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(3000),
    month: z.coerce.number().int().min(1).max(12),
    clientId: optionalPositiveInt,
    consultantId: optionalPositiveInt,
  })
  .strict();

export const hourPoolExportQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(3000),
    month: z.coerce.number().int().min(1).max(12),
    clientId: z.coerce.number().int().positive(),
  })
  .strict();

export type ConsultantPerformanceQuery = z.infer<typeof consultantPerformanceQuerySchema>;
export type ClientCapacityQuery = z.infer<typeof clientCapacityQuerySchema>;
export type HourPoolQuery = z.infer<typeof hourPoolQuerySchema>;
export type HourPoolExportQuery = z.infer<typeof hourPoolExportQuerySchema>;
