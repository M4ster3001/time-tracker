import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../../../../config.js';
import type {
  AiProvider as AiProviderName,
  IAiContext,
  IAiSuggestion,
  IAiSuggestionRequest,
} from '../../domain/ai.types.js';
import type { AiProvider } from '../../domain/providers/ai-provider.js';

const buildSystemPrompt = (context: IAiContext): string => {
  const clientPart = context.clientName ? `\nCliente atual: ${context.clientName}` : '';
  const userActivitiesPart =
    context.userRecentActivities.length > 0
      ? `\nAtividades recentes do usuario: ${context.userRecentActivities.slice(0, 5).join('; ')}`
      : '';
  const clientActivitiesPart =
    context.clientRecentActivities.length > 0
      ? `\nAtividades comuns deste cliente: ${context.clientRecentActivities.slice(0, 5).join('; ')}`
      : '';
  const tagsPart =
    context.userActivityTags.length > 0
      ? `\nTags frequentes do usuario: ${context.userActivityTags.join(', ')}`
      : '';

  return `Voce e um assistente que ajuda usuarios a registrar horas de trabalho.
Baseado no contexto fornecido, sugira descricoes de atividades breves e objetivas.
${clientPart}${userActivitiesPart}${clientActivitiesPart}${tagsPart}

Responda APENAS com um array JSON no formato:
[{"text": "descricao da atividade", "confidence": 0.8}]

Regras:
- Sugira entre 3 e 5 atividades
- Cada descricao deve ter no maximo 80 caracteres
- Confidence deve ser entre 0.0 e 1.0 (maior = mais relevante ao contexto)
- Nao inclua explicacoes, apenas o JSON`;
};

const buildUserPrompt = (request: IAiSuggestionRequest): string => {
  if (request.triggerType === 'typing' && request.partialText) {
    return `Complete esta descricao de atividade: "${request.partialText}"`;
  }
  if (request.prompt) {
    return `Sugira descricoes de atividades baseadas em: "${request.prompt}"`;
  }
  return 'Sugira descricoes de atividades relevantes para um novo lancamento de horas.';
};

const buildSummarizePrompt = (description: string): string => {
  return `Resuma a seguinte descricao de atividade de trabalho em uma tag curta e objetiva.

Descricao original: "${description}"

Regras:
- A tag deve ter no maximo 40 caracteres
- Deve ser clara e descritiva
- Use palavras-chave principais
- Nao use artigos desnecessarios
- Responda APENAS com a tag resumida, sem aspas ou explicacoes`;
};

const parseSummarizeResponse = (content: string | null): string | null => {
  if (!content) return null;
  let tag = content.trim();
  tag = tag.replace(/^["']|["']$/g, '');
  tag = tag.replace(/^(tag:|resumo:|resposta:)\s*/i, '');
  tag = tag.slice(0, 50).trim();
  return tag.length >= 3 ? tag : null;
};

const parseAiResponse = (content: string | null): IAiSuggestion[] => {
  if (!content) return [];

  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{ text: string; confidence?: number }>;
    return parsed
      .filter((item) => item.text && typeof item.text === 'string')
      .map((item) => ({
        text: item.text.slice(0, 100),
        confidence:
          typeof item.confidence === 'number' ? Math.min(1, Math.max(0, item.confidence)) : 0.5,
        source: 'ai_generated' as const,
      }));
  } catch {
    return content
      .split('\n')
      .filter((line) => line.trim().length > 5 && line.trim().length < 100)
      .slice(0, 5)
      .map((line) => ({
        text: line.replace(/^[-*\d.)\s]+/, '').trim(),
        confidence: 0.5,
        source: 'ai_generated' as const,
      }));
  }
};

class OpenAiProvider implements AiProvider {
  private readonly client = new OpenAI({ apiKey: config.ai.openai.apiKey });

  async generateSuggestions(
    context: IAiContext,
    request: IAiSuggestionRequest
  ): Promise<IAiSuggestion[]> {
    const response = await this.client.chat.completions.create({
      model: config.ai.openai.model,
      messages: [
        { role: 'system', content: buildSystemPrompt(context) },
        { role: 'user', content: buildUserPrompt(request) },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    return parseAiResponse(response.choices[0]?.message?.content ?? null);
  }

  async summarizeActivity(description: string): Promise<string | null> {
    const response = await this.client.chat.completions.create({
      model: config.ai.openai.model,
      messages: [{ role: 'user', content: buildSummarizePrompt(description) }],
      max_tokens: 60,
      temperature: 0.3,
    });

    return parseSummarizeResponse(response.choices[0]?.message?.content ?? null);
  }
}

class GeminiProvider implements AiProvider {
  private readonly client = new GoogleGenerativeAI(config.ai.gemini.apiKey);

  async generateSuggestions(
    context: IAiContext,
    request: IAiSuggestionRequest
  ): Promise<IAiSuggestion[]> {
    const model = this.client.getGenerativeModel({ model: config.ai.gemini.model });
    const result = await model.generateContent(
      `${buildSystemPrompt(context)}\n\nUsuario: ${buildUserPrompt(request)}`
    );
    return parseAiResponse(result.response.text());
  }

  async summarizeActivity(description: string): Promise<string | null> {
    const model = this.client.getGenerativeModel({ model: config.ai.gemini.model });
    const result = await model.generateContent(buildSummarizePrompt(description));
    return parseSummarizeResponse(result.response.text());
  }
}

class AnthropicProvider implements AiProvider {
  private readonly client = new Anthropic({ apiKey: config.ai.anthropic.apiKey });

  async generateSuggestions(
    context: IAiContext,
    request: IAiSuggestionRequest
  ): Promise<IAiSuggestion[]> {
    const response = await this.client.messages.create({
      model: config.ai.anthropic.model,
      max_tokens: 300,
      system: buildSystemPrompt(context),
      messages: [{ role: 'user', content: buildUserPrompt(request) }],
    });

    const textContent = response.content.find((chunk) => chunk.type === 'text');
    return parseAiResponse(textContent?.type === 'text' ? textContent.text : null);
  }

  async summarizeActivity(description: string): Promise<string | null> {
    const response = await this.client.messages.create({
      model: config.ai.anthropic.model,
      max_tokens: 60,
      messages: [{ role: 'user', content: buildSummarizePrompt(description) }],
    });

    const textContent = response.content.find((chunk) => chunk.type === 'text');
    return parseSummarizeResponse(textContent?.type === 'text' ? textContent.text : null);
  }
}

export const createAiProvider = (): AiProvider => {
  if (!config.ai.enabled) {
    throw new Error('AI suggestions are not enabled');
  }

  switch (config.ai.provider) {
    case 'openai':
      return new OpenAiProvider();
    case 'gemini':
      return new GeminiProvider();
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new Error(`Unsupported AI provider: ${String(config.ai.provider as AiProviderName)}`);
  }
};
