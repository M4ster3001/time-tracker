export interface IUser {
  deletedAt?: Date | null;
  id: number;
  name: string;
  email: string;
  roleId: number;
  managerId: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserWithRole extends IUser {
  role: {
    id: number;
    name: string;
  };
}
