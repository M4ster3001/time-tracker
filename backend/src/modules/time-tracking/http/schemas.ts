import { z } from 'zod';

export const createTimeEntrySchema = z.object({
  clientId: z.coerce.number().int().positive(),
  date: z.string().trim().min(1),
  activityDescription: z.string().trim().min(1).max(5000),
  durationMinutes: z.union([z.coerce.number().int().min(15).max(480), z.string().trim().min(1)]),
  projectId: z.coerce.number().int().positive().nullable().optional(),
});

export const updateTimeEntrySchema = z
  .object({
    clientId: z.coerce.number().int().positive().optional(),
    date: z.string().trim().min(1).optional(),
    activityDescription: z.string().trim().min(1).max(5000).optional(),
    durationMinutes: z
      .union([z.coerce.number().int().min(15).max(480), z.string().trim().min(1)])
      .optional(),
    projectId: z.coerce.number().int().positive().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: 'At least one field must be provided',
  });

export const timeEntryIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listTimeEntriesQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(3000),
  clientId: z.coerce.number().int().positive().optional(),
});
