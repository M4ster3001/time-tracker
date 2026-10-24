import { z } from 'zod';

export const pullQuerySchema = z.object({
  since: z.string().datetime().optional(),
});

const syncTimeEntrySchema = z.object({
  uuid: z.string().uuid(),
  userUuid: z.string().uuid(),
  clientUuid: z.string().uuid(),
  projectUuid: z.string().uuid().nullable().optional(),
  date: z.string().datetime(),
  activityDescription: z.string().trim().min(1).max(5000),
  durationMinutes: z.number().int().min(15).max(480),
  estimatedDurationMinutes: z.number().int().min(0).max(480).nullable().optional(),
  confirmedDurationMinutes: z.number().int().min(0).max(480).nullable().optional(),
  actualTrackedDurationMinutes: z.number().int().min(0).max(480).nullable().optional(),
  deletedAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime(),
  baseUpdatedAt: z.string().datetime().nullable().optional(),
});

/** PRJ-01: only timeEntries; projects/memberships push not accepted yet (strict). */
export const pushBodySchema = z
  .object({
    timeEntries: z.array(syncTimeEntrySchema).max(1000),
  })
  .strict();

export const connectBodySchema = z.object({
  remoteUrl: z.string().url().optional(),
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

export const updateSettingsBodySchema = z.object({
  backupDir: z.string().max(1000).optional(),
});

export const restoreBodySchema = z.object({
  file: z.string().min(1).max(1000),
  mode: z.enum(['replace', 'merge']),
});
