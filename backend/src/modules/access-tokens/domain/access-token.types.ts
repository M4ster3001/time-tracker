export const ACCESS_TOKEN_EXPIRY_DAYS_OPTIONS = [30, 90, 180, 365] as const;
export type AccessTokenExpiryDays = (typeof ACCESS_TOKEN_EXPIRY_DAYS_OPTIONS)[number];

export interface IAccessToken {
  id: number;
  userId: number;
  label: string;
  grantsJson?: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/** Token recem-criado: unica vez em que o valor bruto existe fora do hash salvo no banco. */
export interface ICreatedAccessToken extends IAccessToken {
  rawToken: string;
}

/** Item de listagem admin: inclui dados do dono do token. */
export interface IAccessTokenWithOwner extends IAccessToken {
  ownerName: string;
  ownerEmail: string;
}
