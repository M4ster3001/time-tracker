import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { prisma } from '../shared/infrastructure/db/prisma.js';
import {
  createRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshTokens,
  rotateRefreshToken,
} from './refresh-token.service.js';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../shared/infrastructure/db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../shared/infrastructure/db/prisma.js', () => ({ prisma: prismaMock }));

describe('RefreshTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('a'.repeat(64)) as any);
  });

  it('cria refresh token com metadata', async () => {
    await createRefreshToken(10, { userAgent: 'ua', ip: '1.1.1.1', deviceLabel: 'mac' });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('cria refresh token sem metadata', async () => {
    await createRefreshToken(11);
    expect(prisma.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 11,
          userAgent: null,
          ipHash: null,
          deviceLabel: null,
        }),
      })
    );
  });

  it('rotaciona token valido', async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce({
      userId: 7,
      tokenHash: 'old',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
      userAgent: 'ua',
      ipHash: null,
      deviceLabel: null,
    } as any);
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([] as any);

    const result = await rotateRefreshToken('token', { userAgent: 'new' });

    expect(result?.userId).toBe(7);
    expect(result?.newToken).toBeDefined();
  });

  it('rejeita token expirado', async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce({
      userId: 7,
      tokenHash: 'old',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 10000),
    } as any);

    const result = await rotateRefreshToken('token');

    expect(result).toBeNull();
  });

  it('rejeita token revogado e revoga cadeia', async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce({
      userId: 7,
      tokenHash: 'old',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
    } as any);

    const result = await rotateRefreshToken('token');

    expect(result).toBeNull();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('rejeita token inexistente', async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(null);

    const result = await rotateRefreshToken('token');

    expect(result).toBeNull();
  });

  it('mantem metadata existente quando nao ha override', async () => {
    vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce({
      userId: 7,
      tokenHash: 'old',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 10000),
      userAgent: 'ua',
      ipHash: 'hash',
      deviceLabel: 'device',
    } as any);
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([] as any);

    await rotateRefreshToken('token');

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('revoga token especifico', async () => {
    await revokeRefreshToken('token');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('revoga tokens do usuario', async () => {
    await revokeUserRefreshTokens(1);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });
});
