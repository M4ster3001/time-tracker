import { config } from '../../../../config.js';
import { logger } from '../../../../shared/infrastructure/logger/logger.js';
import type {
  AiProvider as AiProviderName,
  IAiSuggestion,
  IAiSuggestionRequest,
  IAiSuggestionsResponse,
} from '../domain/ai.types.js';
import type { AiContextRepository } from '../domain/repositories/ai-context.repository.js';
import type { AiProvider } from '../domain/providers/ai-provider.js';

interface CacheEntry {
  data: IAiSuggestion[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const MIN_DESCRIPTION_LENGTH = 50;

const getCacheKey = (userId: number, request: IAiSuggestionRequest): string =>
  `${userId}:${request.clientId || 'all'}:${request.triggerType}:${request.prompt || ''}`;

const cleanExpiredCache = (): void => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt < now) cache.delete(key);
  }
};

setInterval(cleanExpiredCache, 5 * 60 * 1000);

export const generateSuggestions = async (
  userId: number,
  request: IAiSuggestionRequest,
  deps: {
    contextRepository: AiContextRepository;
    providerFactory: () => AiProvider;
  }
): Promise<IAiSuggestionsResponse> => {
  if (!config.ai.enabled) {
    throw new Error('AI suggestions are not enabled');
  }

  if (request.triggerType !== 'typing') {
    const cacheKey = getCacheKey(userId, request);
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return {
        suggestions: cached.data,
        fromCache: true,
        provider: config.ai.provider as AiProviderName,
      };
    }
  }

  const context = await deps.contextRepository.buildContext(userId, request.clientId);
  const provider = deps.providerFactory();

  let suggestions: IAiSuggestion[];
  try {
    suggestions = await provider.generateSuggestions(context, request);
  } catch (error) {
    logger.error({ err: error }, '[AI] Provider error');
    suggestions = [];
  }

  const limitedSuggestions = suggestions.slice(0, config.ai.maxSuggestions);
  if (request.triggerType !== 'typing' && limitedSuggestions.length > 0) {
    cache.set(getCacheKey(userId, request), {
      data: limitedSuggestions,
      expiresAt: Date.now() + config.ai.cacheTtlSeconds * 1000,
    });
  }

  return {
    suggestions: limitedSuggestions,
    fromCache: false,
    provider: config.ai.provider as AiProviderName,
  };
};

export const clearUserSuggestionsCache = (userId: number): void => {
  for (const key of cache.keys()) {
    if (key.startsWith(`${userId}:`)) {
      cache.delete(key);
    }
  }
};

export const getAiStatus = (): { enabled: boolean; provider: AiProviderName | null } => ({
  enabled: config.ai.enabled,
  provider: config.ai.enabled ? (config.ai.provider as AiProviderName) : null,
});

export const summarizeActivity = async (
  description: string,
  deps: { providerFactory: () => AiProvider }
): Promise<string | null> => {
  if (!config.ai.enabled || !description || description.length < MIN_DESCRIPTION_LENGTH) {
    return null;
  }

  try {
    const summary = await deps.providerFactory().summarizeActivity(description);
    if (!summary || summary.length < 3 || summary.length > 50) return null;
    if (summary.toLowerCase() === description.toLowerCase().slice(0, summary.length)) return null;
    return summary;
  } catch (error) {
    logger.error({ err: error }, '[AI] Summarization error');
    return null;
  }
};
