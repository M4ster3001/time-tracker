import { describe, expect, it } from 'vitest';
import {
  canConfirmEntryForScope,
  partitionConfirmableEntries,
} from './confirm-duration-access.js';

describe('EST-02 confirm-duration access (estimates.confirm scope)', () => {
  it('self: so o dono do apontamento', () => {
    expect(
      canConfirmEntryForScope({
        actorUserId: 3,
        entryUserId: 3,
        confirmScope: 'self',
        isManagedByActor: false,
      })
    ).toBe(true);
    expect(
      canConfirmEntryForScope({
        actorUserId: 3,
        entryUserId: 9,
        confirmScope: 'self',
        isManagedByActor: true,
      })
    ).toBe(false);
  });

  it('team: proprios + gerenciados; nao libera nao-gerenciados', () => {
    expect(
      canConfirmEntryForScope({
        actorUserId: 2,
        entryUserId: 9,
        confirmScope: 'team',
        isManagedByActor: true,
      })
    ).toBe(true);
    expect(
      canConfirmEntryForScope({
        actorUserId: 2,
        entryUserId: 9,
        confirmScope: 'team',
        isManagedByActor: false,
      })
    ).toBe(false);
    expect(
      canConfirmEntryForScope({
        actorUserId: 2,
        entryUserId: 2,
        confirmScope: 'team',
        isManagedByActor: false,
      })
    ).toBe(true);
  });

  it('all: qualquer apontamento', () => {
    expect(
      canConfirmEntryForScope({
        actorUserId: 1,
        entryUserId: 99,
        confirmScope: 'all',
        isManagedByActor: false,
      })
    ).toBe(true);
  });

  it('sem concessao estimates.confirm: nega inclusive proprio', () => {
    expect(
      canConfirmEntryForScope({
        actorUserId: 3,
        entryUserId: 3,
        confirmScope: null,
        isManagedByActor: false,
      })
    ).toBe(false);
  });
});

describe('EST-02 partitionConfirmableEntries (partial multi-user)', () => {
  it('self: confirma so os proprios e marca partial quando ha terceiros', () => {
    const result = partitionConfirmableEntries({
      actorUserId: 3,
      confirmScope: 'self',
      managedUserIds: new Set(),
      entries: [
        { id: 1, userId: 3 },
        { id: 2, userId: 9 },
        { id: 3, userId: 3 },
      ],
    });

    expect(result.confirmable.map((e) => e.id)).toEqual([1, 3]);
    expect(result.skipped.map((e) => e.id)).toEqual([2]);
    expect(result.partial).toBe(true);
  });

  it('self: sem apontamentos proprios → confirmable vazio (Forbidden no servico)', () => {
    const result = partitionConfirmableEntries({
      actorUserId: 3,
      confirmScope: 'self',
      managedUserIds: new Set([9]),
      entries: [{ id: 2, userId: 9 }],
    });
    expect(result.confirmable).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.partial).toBe(false);
  });

  it('team: inclui gerenciados; deixa de fora nao-gerenciados (partial)', () => {
    const result = partitionConfirmableEntries({
      actorUserId: 2,
      confirmScope: 'team',
      managedUserIds: new Set([9]),
      entries: [
        { id: 1, userId: 2 },
        { id: 2, userId: 9 },
        { id: 3, userId: 44 },
      ],
    });
    expect(result.confirmable.map((e) => e.id)).toEqual([1, 2]);
    expect(result.skipped.map((e) => e.id)).toEqual([3]);
    expect(result.partial).toBe(true);
  });

  it('all: nenhum skipped', () => {
    const result = partitionConfirmableEntries({
      actorUserId: 1,
      confirmScope: 'all',
      managedUserIds: new Set(),
      entries: [
        { id: 1, userId: 3 },
        { id: 2, userId: 9 },
      ],
    });
    expect(result.confirmable).toHaveLength(2);
    expect(result.skipped).toEqual([]);
    expect(result.partial).toBe(false);
  });
});
