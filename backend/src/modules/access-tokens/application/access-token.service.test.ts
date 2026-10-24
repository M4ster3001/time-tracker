import { describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_PREFIX,
  adminRevokeAccessToken,
  generateAccessToken,
  revokeOwnAccessToken,
  verifyAccessToken,
} from './access-token.service.js';
import type { AccessTokenRepository } from '../domain/repositories/access-token.repository.js';
import type { IAccessToken } from '../domain/access-token.types.js';
import { userRepository } from '../../users/infrastructure/repositories/prisma-user.repository.js';

vi.mock('../../users/infrastructure/repositories/prisma-user.repository.js', () => ({
  userRepository: {
    findUserById: vi.fn(),
  },
}));

const buildToken = (overrides: Partial<IAccessToken> = {}): IAccessToken => ({
  id: 1,
  userId: 42,
  label: 'Cursor',
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  revokedAt: null,
  lastUsedAt: null,
  createdAt: new Date(),
  ...overrides,
});

const buildRepository = (
  overrides: Partial<AccessTokenRepository> = {}
): AccessTokenRepository => ({
  create: vi.fn().mockResolvedValue(buildToken()),
  findActiveByHash: vi.fn().mockResolvedValue(null),
  listByUser: vi.fn().mockResolvedValue([]),
  listAll: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(null),
  revoke: vi.fn().mockResolvedValue(undefined),
  touchLastUsed: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const defaultGrants = [
  { permission: 'time.read' as const, scope: 'self' as const },
  { permission: 'time.write' as const, scope: 'self' as const },
  { permission: 'clients.read' as const, scope: 'self' as const },
];

describe('access-token.service', () => {
  describe('generateAccessToken', () => {
    it('gera um token bruto com o prefixo esperado e persiste o hash via repositorio', async () => {
      const repository = buildRepository();

      const result = await generateAccessToken(42, 'Cursor', 90, repository, defaultGrants);

      expect(result.rawToken.startsWith(ACCESS_TOKEN_PREFIX)).toBe(true);
      expect(repository.create).toHaveBeenCalledWith(
        42,
        'Cursor',
        expect.any(String),
        expect.any(Date),
        JSON.stringify(defaultGrants)
      );
    });

    it('calcula expiresAt como agora + expiresInDays', async () => {
      const repository = buildRepository();
      const before = Date.now();

      await generateAccessToken(42, 'Cursor', 30, repository, defaultGrants);

      const [, , , expiresAt] = vi.mocked(repository.create).mock.calls[0];
      const diffDays = (expiresAt.getTime() - before) / (24 * 60 * 60 * 1000);
      expect(diffDays).toBeGreaterThan(29.9);
      expect(diffDays).toBeLessThan(30.1);
    });

    it('rejeita criacao sem grants explicitos', async () => {
      const repository = buildRepository();
      await expect(generateAccessToken(42, 'Cursor', 30, repository)).rejects.toMatchObject({
        message: 'PAT_GRANTS_REQUIRED',
      });
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyAccessToken', () => {
    it('retorna null quando o token nao existe', async () => {
      const repository = buildRepository({ findActiveByHash: vi.fn().mockResolvedValue(null) });

      const result = await verifyAccessToken('ttpat_inexistente', repository);

      expect(result).toBeNull();
    });

    it('retorna null quando o token foi revogado', async () => {
      const repository = buildRepository({
        findActiveByHash: vi.fn().mockResolvedValue(buildToken({ revokedAt: new Date() })),
      });

      const result = await verifyAccessToken('ttpat_revogado', repository);

      expect(result).toBeNull();
    });

    it('retorna null quando o token esta expirado', async () => {
      const repository = buildRepository({
        findActiveByHash: vi.fn().mockResolvedValue(
          buildToken({ expiresAt: new Date(Date.now() - 1000) })
        ),
      });

      const result = await verifyAccessToken('ttpat_expirado', repository);

      expect(result).toBeNull();
    });

    it('retorna null quando o usuario dono nao existe mais ou esta inativo', async () => {
      const repository = buildRepository({
        findActiveByHash: vi.fn().mockResolvedValue(buildToken()),
      });
      vi.mocked(userRepository.findUserById).mockResolvedValueOnce(null);

      const result = await verifyAccessToken('ttpat_valido', repository);

      expect(result).toBeNull();
    });

    it('retorna o payload de auth e atualiza lastUsedAt quando o token e valido', async () => {
      const repository = buildRepository({
        findActiveByHash: vi.fn().mockResolvedValue(buildToken({ id: 7, userId: 42 })),
      });
      vi.mocked(userRepository.findUserById).mockResolvedValueOnce({
        id: 42,
        name: 'Fulano',
        email: 'test-user-1@example.test',
        roleId: 3,
        managerId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: { id: 3, name: 'Consultant' },
      });

      const result = await verifyAccessToken('ttpat_valido', repository);

      expect(result).toEqual({ userId: 42, email: 'test-user-1@example.test', roleId: 3 });
      expect(repository.touchLastUsed).toHaveBeenCalledWith(7);
    });
  });

  describe('revokeOwnAccessToken', () => {
    it('revoga quando o token pertence ao usuario', async () => {
      const repository = buildRepository({
        findById: vi.fn().mockResolvedValue(buildToken({ id: 5, userId: 42 })),
      });

      await revokeOwnAccessToken(42, 5, repository);

      expect(repository.revoke).toHaveBeenCalledWith(5);
    });

    it('rejeita quando o token pertence a outro usuario', async () => {
      const repository = buildRepository({
        findById: vi.fn().mockResolvedValue(buildToken({ id: 5, userId: 999 })),
      });

      await expect(revokeOwnAccessToken(42, 5, repository)).rejects.toThrow();
      expect(repository.revoke).not.toHaveBeenCalled();
    });

    it('rejeita quando o token nao existe', async () => {
      const repository = buildRepository({ findById: vi.fn().mockResolvedValue(null) });

      await expect(revokeOwnAccessToken(42, 5, repository)).rejects.toThrow();
    });
  });

  describe('adminRevokeAccessToken', () => {
    it('revoga o token de qualquer usuario', async () => {
      const repository = buildRepository({
        findById: vi.fn().mockResolvedValue(buildToken({ id: 5, userId: 999 })),
      });

      await adminRevokeAccessToken(5, repository);

      expect(repository.revoke).toHaveBeenCalledWith(5);
    });

    it('rejeita quando o token nao existe', async () => {
      const repository = buildRepository({ findById: vi.fn().mockResolvedValue(null) });

      await expect(adminRevokeAccessToken(5, repository)).rejects.toThrow();
    });
  });
});
