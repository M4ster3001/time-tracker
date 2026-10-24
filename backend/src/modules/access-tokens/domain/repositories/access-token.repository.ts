import type { IAccessToken, IAccessTokenWithOwner } from '../access-token.types.js';

export interface AccessTokenRepository {
  create(userId: number, label: string, tokenHash: string, expiresAt: Date, grantsJson?: string): Promise<IAccessToken>;
  findActiveByHash(tokenHash: string): Promise<IAccessToken | null>;
  listByUser(userId: number): Promise<IAccessToken[]>;
  listAll(): Promise<IAccessTokenWithOwner[]>;
  findById(id: number): Promise<IAccessToken | null>;
  revoke(id: number): Promise<void>;
  touchLastUsed(id: number): Promise<void>;
}
