import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { PrismaAiContextRepository } from './infrastructure/repositories/prisma-ai-context.repository.js';

export const aiContextRepository = new PrismaAiContextRepository(prisma);

export { createAiProvider } from './infrastructure/providers/ai-provider.factory.js';
export { aiStatusController, aiSuggestionsController } from './http/controller.js';
export {
  generateSuggestions,
  clearUserSuggestionsCache,
  getAiStatus,
  summarizeActivity,
} from './application/ai.service.js';
