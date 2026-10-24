import type { IAiContext, IAiSuggestion, IAiSuggestionRequest } from '../ai.types.js';

export interface AiProvider {
  generateSuggestions(context: IAiContext, request: IAiSuggestionRequest): Promise<IAiSuggestion[]>;
  summarizeActivity(description: string): Promise<string | null>;
}
