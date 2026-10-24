import { aiContextRepository, createAiProvider } from '../modules/integrations/ai/index.js';
import {
  clearUserSuggestionsCache,
  generateSuggestions as generateSuggestionsUseCase,
  getAiStatus,
  summarizeActivity as summarizeActivityUseCase,
} from '../modules/integrations/ai/application/ai.service.js';
import type { IAiSuggestionRequest, IAiSuggestionsResponse } from '../modules/integrations/ai/domain/ai.types.js';

export { clearUserSuggestionsCache, getAiStatus };

export const generateSuggestions = async (
  userId: number,
  request: IAiSuggestionRequest
): Promise<IAiSuggestionsResponse> =>
  generateSuggestionsUseCase(userId, request, {
    contextRepository: aiContextRepository,
    providerFactory: createAiProvider,
  });

export const summarizeActivity = async (description: string): Promise<string | null> =>
  summarizeActivityUseCase(description, { providerFactory: createAiProvider });
