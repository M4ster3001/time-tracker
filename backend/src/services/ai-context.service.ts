import { prisma } from '../shared/infrastructure/db/prisma.js';
import { PrismaAiContextRepository } from '../modules/integrations/ai/infrastructure/repositories/prisma-ai-context.repository.js';

const repository = new PrismaAiContextRepository(prisma);

export const buildAiContext = (userId: number, clientId?: number) =>
  repository.buildContext(userId, clientId);
