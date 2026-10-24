import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { config } from '../../../config.js';
import type { AdminBulkRepository } from '../domain/repositories/admin-bulk.repository.js';
import type {
  BulkImportResult,
  BulkStatusUpdateResult,
  CsvUserRow,
} from './admin-bulk.service.interfaces.js';

const generateRandomPassword = (): string => {
  return `Aa1!${randomBytes(18).toString('base64url')}`;
};

export const parseCsvContent = (csvContent: string): CsvUserRow[] => {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2)
    throw new Error('CSV deve ter pelo menos uma linha de cabecalho e uma de dados');

  const header = lines[0].split(',').map((item) => item.trim().toLowerCase());
  const nameIdx = header.indexOf('name');
  const emailIdx = header.indexOf('email');
  const passwordIdx = header.indexOf('password');
  const roleIdIdx = header.indexOf('roleid');
  const managerIdIdx = header.indexOf('managerid');
  if (nameIdx === -1 || emailIdx === -1 || roleIdIdx === -1) {
    throw new Error('CSV deve ter colunas: name, email, roleId');
  }

  return lines
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const values = line.split(',').map((item) => item.trim());
      return {
        name: values[nameIdx] || '',
        email: values[emailIdx] || '',
        password: passwordIdx !== -1 ? values[passwordIdx] : undefined,
        roleId: values[roleIdIdx] || '',
        managerId: managerIdIdx !== -1 ? values[managerIdIdx] : undefined,
      };
    });
};

export const bulkImportUsers = async (
  rows: CsvUserRow[],
  adminUserId: number,
  deps: { repository: AdminBulkRepository }
): Promise<BulkImportResult> => {
  const result: BulkImportResult = { success: 0, failed: 0, errors: [], created: [] };
  const existingEmails = new Set(await deps.repository.listUserEmails());

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNum = index + 2;
    try {
      if (!row.name || !row.email || !row.roleId) {
        result.failed += 1;
        result.errors.push({
          row: rowNum,
          email: row.email || 'N/A',
          error: 'Campos obrigatorios: name, email, roleId',
        });
        continue;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(row.email)) {
        result.failed += 1;
        result.errors.push({ row: rowNum, email: row.email, error: 'Email invalido' });
        continue;
      }
      if (existingEmails.has(row.email.toLowerCase())) {
        result.failed += 1;
        result.errors.push({ row: rowNum, email: row.email, error: 'Email ja existe no sistema' });
        continue;
      }
      const roleId = parseInt(row.roleId, 10);
      if (Number.isNaN(roleId) || roleId < 1 || roleId > 3) {
        result.failed += 1;
        result.errors.push({
          row: rowNum,
          email: row.email,
          error: 'roleId invalido (deve ser 1, 2 ou 3)',
        });
        continue;
      }

      let managerId: number | null = null;
      if (row.managerId) {
        managerId = parseInt(row.managerId, 10);
        if (Number.isNaN(managerId)) {
          result.failed += 1;
          result.errors.push({ row: rowNum, email: row.email, error: 'managerId invalido' });
          continue;
        }
        const manager = await deps.repository.findManagerById(managerId);
        if (!manager) {
          result.failed += 1;
          result.errors.push({ row: rowNum, email: row.email, error: 'Manager nao encontrado' });
          continue;
        }
      }

      const password = row.password || generateRandomPassword();
      const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);
      const user = await deps.repository.createUser({
        name: row.name.trim(),
        email: row.email.toLowerCase().trim(),
        passwordHash,
        roleId,
        managerId,
      });
      await deps.repository.logAudit({
        userId: adminUserId,
        endpoint: '/api/admin/users/bulk-import',
        action: 'BULK_CREATE_USER',
        status: 'SUCCESS',
        details: JSON.stringify({ createdUserId: user.id, email: user.email }),
      });
      existingEmails.add(user.email.toLowerCase());
      result.success += 1;
      result.created.push(user);
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        row: rowNum,
        email: row.email || 'N/A',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }

  return result;
};

const bulkUpdateUserStatus = async (
  userIds: number[],
  adminUserId: number,
  isActive: boolean,
  deps: { repository: AdminBulkRepository }
): Promise<BulkStatusUpdateResult> => {
  const result: BulkStatusUpdateResult = { success: 0, failed: 0, errors: [] };

  for (const userId of userIds) {
    try {
      if (userId == adminUserId) {
        result.failed += 1;
        result.errors.push({ userId, error: 'Nao pode modificar proprio usuario' });
        continue;
      }
      const user = await deps.repository.findUserById(userId);
      if (!user || user.deletedAt) {
        result.failed += 1;
        result.errors.push({ userId, error: 'Usuario nao encontrado' });
        continue;
      }
      if (!isActive && user.roleId === 1) {
        result.failed += 1;
        result.errors.push({ userId, error: 'Nao pode desativar administradores' });
        continue;
      }
      await deps.repository.updateUserActive(userId, isActive);
      await deps.repository.logAudit({
        userId: adminUserId,
        endpoint: isActive ? '/api/admin/users/bulk-activate' : '/api/admin/users/bulk-deactivate',
        action: isActive ? 'BULK_ACTIVATE_USER' : 'BULK_DEACTIVATE_USER',
        status: 'SUCCESS',
        details: JSON.stringify({ targetUserId: userId }),
      });
      result.success += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({
        userId,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    }
  }

  return result;
};

export const bulkActivateUsers = (
  userIds: number[],
  adminUserId: number,
  deps: { repository: AdminBulkRepository }
) => bulkUpdateUserStatus(userIds, adminUserId, true, deps);

export const bulkDeactivateUsers = (
  userIds: number[],
  adminUserId: number,
  deps: { repository: AdminBulkRepository }
) => bulkUpdateUserStatus(userIds, adminUserId, false, deps);
