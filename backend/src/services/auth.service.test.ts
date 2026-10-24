import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as authService from './auth.service.js';
import * as passwordCrypto from '../shared/infrastructure/crypto/password.js';
import * as jwtCrypto from '../shared/infrastructure/crypto/jwt.js';
import { prisma } from '../shared/infrastructure/db/prisma.js';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock do Prisma
vi.mock('../shared/infrastructure/db/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../shared/infrastructure/db/prisma.js', () => ({ prisma: prismaMock }));

// Mock dos utilitários de autenticação
vi.mock('../shared/infrastructure/crypto/password.js', () => ({
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
}));

vi.mock('../shared/infrastructure/crypto/jwt.js', () => ({
  generateToken: vi.fn(),
}));

const resetPrismaMocks = () => {
  prismaMock.user.findUnique.mockReset();
  prismaMock.user.create.mockReset();
  prismaMock.user.update.mockReset();
};

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPrismaMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('register', () => {
    it('deve registrar um novo usuário com sucesso', async () => {
      const newUser = {
        name: 'Test User',
        email: 'test-user-1@example.test',
        password: 'SecurePass123!', // SEC-04: Strong password
      };

      const hashedPassword = 'hashed_password_123';
      const createdUser = {
        id: 1,
        name: newUser.name,
        email: newUser.email,
        passwordHash: hashedPassword,
        roleId: 3,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: 3,
          name: 'Consultant',
        },
      };

      const token = 'jwt_token_123';

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(passwordCrypto.hashPassword).mockResolvedValueOnce(hashedPassword);
      vi.mocked(prisma.user.create).mockResolvedValueOnce(createdUser as any);
      vi.mocked(jwtCrypto.generateToken).mockReturnValueOnce(token);

      const result = await authService.register(newUser);

      expect(result.token).toBe(token);
      expect(result.user.email).toBe(newUser.email);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: newUser.email },
        include: { role: true },
      });
      expect(passwordCrypto.hashPassword).toHaveBeenCalledWith(newUser.password);
    });

    it('deve lançar erro se o usuário já existe', async () => {
      const newUser = {
        name: 'Test User',
        email: 'test-user-2@example.test',
        password: 'password123',
      };

      const existingUser = {
        id: 1,
        name: 'Existing User',
        email: newUser.email,
        passwordHash: 'hashed',
        roleId: 3,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(existingUser as any);

      await expect(authService.register(newUser)).rejects.toThrow('User already exists');
    });

    it('deve lançar erro se a senha for muito curta', async () => {
      const newUser = {
        name: 'Test User',
        email: 'test-user-1@example.test',
        password: '123', // Muito curta
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      await expect(authService.register(newUser)).rejects.toThrow(
        'Password must be at least 12 characters'
      );
    });
  });

  describe('login', () => {
    it('deve fazer login com sucesso com credenciais válidas', async () => {
      const credentials = {
        email: 'test-user-3@example.test',
        password: 'StrongPassword123!',
      };

      const user = {
        id: 1,
        name: 'Test User',
        email: credentials.email,
        passwordHash: 'hashed_password',
        roleId: 3,
        managerId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: 3,
          name: 'Consultant',
        },
      };

      const token = 'jwt_token_123';

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(user as any);
      vi.mocked(passwordCrypto.comparePassword).mockResolvedValueOnce(true);
      vi.mocked(jwtCrypto.generateToken).mockReturnValueOnce(token);

      const result = await authService.login(credentials);

      expect(result.token).toBe(token);
      expect(result.user.email).toBe(credentials.email);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: credentials.email },
        include: { role: true },
      });
      expect(passwordCrypto.comparePassword).toHaveBeenCalledWith(
        credentials.password,
        user.passwordHash
      );
    });

    it('deve lançar erro se o usuário não existe', async () => {
      const credentials = {
        email: 'test-user-4@example.test',
        password: 'StrongPassword123!',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
      // SEC-HIGH-02: comparePassword always runs (dummy hash) to prevent timing attacks
      vi.mocked(passwordCrypto.comparePassword).mockResolvedValueOnce(false);

      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');
      expect(passwordCrypto.comparePassword).toHaveBeenCalled();
    });

    it('deve lançar erro se a senha está incorreta', async () => {
      const credentials = {
        email: 'test-user-3@example.test',
        password: 'wrong_password',
      };

      const user = {
        id: 1,
        name: 'Test User',
        email: credentials.email,
        passwordHash: 'hashed_password',
        roleId: 3,
        managerId: null,
        isActive: true,
        failedLoginAttempts: 0, // SEC-03: Account lockout tracking
        lockedUntil: null,
        lastFailedLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: 3,
          name: 'Consultant',
        },
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(user as any);
      vi.mocked(passwordCrypto.comparePassword).mockResolvedValueOnce(false);
      vi.mocked(prisma.user.update).mockResolvedValueOnce(user as any);

      await expect(authService.login(credentials)).rejects.toThrow('Invalid credentials');
    });

    it('deve lançar erro se o usuário está inativo', async () => {
      const credentials = {
        email: 'test-user-3@example.test',
        password: 'StrongPassword123!',
      };

      const user = {
        id: 1,
        name: 'Test User',
        email: credentials.email,
        passwordHash: 'hashed_password',
        roleId: 3,
        managerId: null,
        isActive: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: 3,
          name: 'Consultant',
        },
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(user as any);
      // SEC-HIGH-02: comparePassword runs before inactive check
      vi.mocked(passwordCrypto.comparePassword).mockResolvedValueOnce(true);

      await expect(authService.login(credentials)).rejects.toThrow('User is inactive');
    });
  });

  describe('getUserById', () => {
    it('deve retornar o usuário por ID', async () => {
      const user = {
        id: 1,
        name: 'Test User',
        email: 'test-user-1@example.test',
        passwordHash: 'hashed_password',
        roleId: 3,
        managerId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: {
          id: 3,
          name: 'Consultant',
        },
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(user as any);

      const result = await authService.getUserById(1);

      // O hash da senha nunca pode sair do backend.
      const { passwordHash: _passwordHash, ...publicUser } = user;
      expect(result).toEqual(publicUser);
      expect(result).not.toHaveProperty('passwordHash');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: { role: true },
      });
    });

    it('deve retornar null se o usuário não existe', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

      const result = await authService.getUserById(999);

      expect(result).toBeNull();
    });
  });
});
