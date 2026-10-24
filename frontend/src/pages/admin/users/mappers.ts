import type { UserRow } from './types';

export const inferUserRoleId = (user: UserRow) => {
  const roleName = (user.role?.name ?? '').toLowerCase();
  if (roleName.includes('manager') || roleName.includes('gerente')) return 2;
  if (roleName.includes('consult')) return 3;
  return user.roleId;
};
