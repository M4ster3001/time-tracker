import { Request, Response } from 'express';
import { logger } from '../../../shared/infrastructure/logger/logger.js';
import { adminBulkRepository } from '../index.js';
import {
  bulkActivateUsers,
  bulkDeactivateUsers,
  bulkImportUsers,
  parseCsvContent,
} from '../application/admin-bulk.service.js';

export const bulkImportController = async (req: Request, res: Response): Promise<void> => {
  try {
    const { csvContent } = req.body;
    const adminUserId = req.user!.userId;
    if (!csvContent || typeof csvContent !== 'string') {
      res.status(400).json({ success: false, message: 'csvContent e obrigatorio' });
      return;
    }
    const rows = parseCsvContent(csvContent);
    if (rows.length === 0) {
      res.status(400).json({ success: false, message: 'Nenhuma linha de dados encontrada no CSV' });
      return;
    }
    if (rows.length > 100) {
      res.status(400).json({ success: false, message: 'Maximo de 100 usuarios por importacao' });
      return;
    }
    const result = await bulkImportUsers(rows, adminUserId, { repository: adminBulkRepository });
    res.json({
      success: true,
      data: result,
      message: `Importacao concluida: ${result.success} criados, ${result.failed} falhas`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Bulk import error');
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao importar usuarios',
    });
  }
};

const parseUserIds = (userIds: unknown): number[] | null =>
  Array.isArray(userIds) && userIds.every((id) => typeof id === 'number' && id > 0)
    ? userIds
    : null;

export const bulkActivateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userIds = parseUserIds(req.body.userIds);
    if (!userIds || userIds.length === 0) {
      res.status(400).json({ success: false, message: 'userIds deve ser um array nao vazio' });
      return;
    }
    if (userIds.length > 50) {
      res.status(400).json({ success: false, message: 'Maximo de 50 usuarios por operacao' });
      return;
    }
    const result = await bulkActivateUsers(userIds, req.user!.userId, {
      repository: adminBulkRepository,
    });
    res.json({
      success: true,
      data: result,
      message: `Ativacao concluida: ${result.success} ativados, ${result.failed} falhas`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Bulk activate error');
    res.status(500).json({ success: false, message: 'Erro ao ativar usuarios' });
  }
};

export const bulkDeactivateController = async (req: Request, res: Response): Promise<void> => {
  try {
    const userIds = parseUserIds(req.body.userIds);
    if (!userIds || userIds.length === 0) {
      res.status(400).json({ success: false, message: 'userIds deve ser um array nao vazio' });
      return;
    }
    if (userIds.length > 50) {
      res.status(400).json({ success: false, message: 'Maximo de 50 usuarios por operacao' });
      return;
    }
    const result = await bulkDeactivateUsers(userIds, req.user!.userId, {
      repository: adminBulkRepository,
    });
    res.json({
      success: true,
      data: result,
      message: `Desativacao concluida: ${result.success} desativados, ${result.failed} falhas`,
    });
  } catch (error) {
    logger.error({ err: error }, 'Bulk deactivate error');
    res.status(500).json({ success: false, message: 'Erro ao desativar usuarios' });
  }
};

export const csvTemplateController = async (_req: Request, res: Response): Promise<void> => {
  const template = `name,email,password,roleId,managerId
Demo Consultant 1,consultant1@example.test,replace-with-a-unique-password,3,
Demo Manager 1,manager1@example.test,replace-with-a-unique-password,2,
Demo Consultant 2,consultant2@example.test,replace-with-a-unique-password,3,2`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="users_template.csv"');
  res.send(template);
};
