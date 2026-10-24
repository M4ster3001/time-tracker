import type { AuthUserRepository } from '../domain/repositories/auth-user.repository.js';

export interface AuthServiceDeps {
  users: AuthUserRepository;
}
