export type AiProvider = 'openai' | 'gemini' | 'anthropic';
export type AiTriggerType = 'client_select' | 'button' | 'typing';

export interface IAiSuggestionRequest {
  clientId?: number;
  prompt?: string;
  triggerType: AiTriggerType;
  partialText?: string;
}

export interface IAiSuggestion {
  text: string;
  confidence: number; // 0-1
  source: 'user_history' | 'client_history' | 'ai_generated';
}

export interface IAiSuggestionsResponse {
  suggestions: IAiSuggestion[];
  fromCache: boolean;
  provider: AiProvider;
}

export interface IAiContext {
  userRecentActivities: string[];
  clientRecentActivities: string[];
  userActivityTags: string[];
  clientName?: string;
}
