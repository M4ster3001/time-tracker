import { describe, expect, it } from 'vitest';
import { pushBodySchema } from '../http/schemas.js';
import { PROJECTS_PUSH_SUPPORTED } from './project-push-policy.js';

describe('PRJ-01 project push policy (stub)', () => {
  it('marca push de projetos/memberships como ainda nao suportado', () => {
    expect(PROJECTS_PUSH_SUPPORTED).toBe(false);
  });

  it('pushBodySchema rejeita payload com projects (strict; sem push de catalogo)', () => {
    const parsed = pushBodySchema.safeParse({
      timeEntries: [],
      projects: [{ uuid: '00000000-0000-4000-8000-000000000001' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('pushBodySchema aceita apenas timeEntries', () => {
    const parsed = pushBodySchema.safeParse({ timeEntries: [] });
    expect(parsed.success).toBe(true);
  });
});
