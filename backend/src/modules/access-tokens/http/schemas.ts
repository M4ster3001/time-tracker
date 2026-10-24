import { z } from 'zod';
import { ACCESS_TOKEN_EXPIRY_DAYS_OPTIONS } from '../domain/access-token.types.js';
import { permissionKeys } from '../../access-control/domain/permissions.js';

export const createAccessTokenSchema = z.object({
  label: z.string().trim().min(1).max(100),
  /** New PATs must declare grants explicitly (no silent default at create). */
  grants: z
    .array(z.object({ permission: z.enum(permissionKeys), scope: z.enum(['self', 'team', 'all']) }))
    .min(1)
    .max(50),
  expiresInDays: z.coerce
    .number()
    .int()
    .refine((value) => (ACCESS_TOKEN_EXPIRY_DAYS_OPTIONS as readonly number[]).includes(value), {
      message: 'expiresInDays must be one of 30, 90, 180, 365',
    }),
});

export const accessTokenIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
