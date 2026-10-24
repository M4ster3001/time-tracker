import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { comparePassword, hashPassword } from './password.js';

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

describe('password crypto', () => {
  it('hashPassword usa bcrypt', async () => {
    vi.mocked(bcrypt.hash).mockResolvedValueOnce('hashed');
    const result = await hashPassword('secret');
    expect(result).toBe('hashed');
  });

  it('comparePassword delega ao bcrypt', async () => {
    vi.mocked(bcrypt.compare).mockResolvedValueOnce(true);
    const result = await comparePassword('secret', 'hash');
    expect(result).toBe(true);
  });
});
