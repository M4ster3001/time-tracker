import type { IUserWithRole } from '../../users/domain/user.types.js';

export interface IAuthPayload {
  userId: number;
  email: string;
  roleId: number;
  tokenGrants?: import('../../access-control/domain/permissions.js').Grant[];
}

export interface ILoginRequest {
  email: string;
  password: string;
}

export interface IRegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface IAuthResponse {
  token: string;
  user: IUserWithRole;
}
