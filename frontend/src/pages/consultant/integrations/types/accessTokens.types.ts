export const ACCESS_TOKEN_EXPIRY_DAYS_OPTIONS = [30, 90, 180, 365] as const;
export type AccessTokenExpiryDays = (typeof ACCESS_TOKEN_EXPIRY_DAYS_OPTIONS)[number];

export interface AccessToken {
  id: number;
  label: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreatedAccessToken extends AccessToken {
  rawToken: string;
}

export interface AccessTokenWithOwner extends AccessToken {
  ownerName: string;
  ownerEmail: string;
}
