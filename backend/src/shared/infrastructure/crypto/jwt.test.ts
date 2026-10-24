import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { config } from '../../../config.js';
import { extractTokenFromHeader, generateToken, verifyToken } from './jwt.js';

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

describe('jwt crypto', () => {
  it('generateToken usa jwt.sign', () => {
    vi.mocked(jwt.sign).mockReturnValueOnce('token' as never);
    const result = generateToken({ userId: 1, email: 'test-user-1@example.test', roleId: 3 });
    expect(result).toBe('token');
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: 1, email: 'test-user-1@example.test', roleId: 3 },
      config.jwt.secret,
      { expiresIn: config.jwt.expiration }
    );
  });

  it('verifyToken retorna payload quando valido', () => {
    vi.mocked(jwt.verify).mockReturnValueOnce({ userId: 1 } as never);
    const result = verifyToken('token');
    expect(result?.userId).toBe(1);
  });

  it('verifyToken retorna null quando invalido', () => {
    vi.mocked(jwt.verify).mockImplementationOnce(() => {
      throw new Error('invalid');
    });
    const result = verifyToken('token');
    expect(result).toBeNull();
  });

  it('extractTokenFromHeader parseia bearer', () => {
    expect(extractTokenFromHeader('Bearer abc')).toBe('abc');
    expect(extractTokenFromHeader('abc')).toBeNull();
    expect(extractTokenFromHeader(undefined)).toBeNull();
  });
});
