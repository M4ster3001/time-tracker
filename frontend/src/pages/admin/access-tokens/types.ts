export interface AccessTokenWithOwner {
  id: number;
  label: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
}
