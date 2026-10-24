export type RefreshTokenMetadata = {
  userAgent?: string | null;
  ip?: string | null;
  deviceLabel?: string | null;
};

export interface RefreshTokenRepository {
  create(userId: number, metadata?: RefreshTokenMetadata): Promise<{ token: string }>;
  rotate(
    token: string,
    metadata?: RefreshTokenMetadata
  ): Promise<{ userId: number; newToken: string } | null>;
  revoke(token: string): Promise<void>;
  revokeUserSessions(userId: number): Promise<void>;
}
