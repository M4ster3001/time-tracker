import type { NextFunction, Request, Response } from 'express';
import { BadRequestError, UnauthorizedError } from '../../../../app/errors/app-error.js';
import { logger } from '../../../../shared/infrastructure/logger/logger.js';
import { sendSuccess } from '../../../../app/http/presenters/api.presenter.js';
import type { AiTriggerType } from '../domain/ai.types.js';
import { generateSuggestions, getAiStatus } from '../application/ai.service.js';
import { aiContextRepository, createAiProvider } from '../index.js';

export const aiStatusController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    sendSuccess(res, 200, getAiStatus());
  } catch (error) {
    next(error);
  }
};

export const aiSuggestionsController = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedError('Unauthorized');
    }

    const { clientId, prompt, triggerType, partialText } = req.body as {
      clientId?: number;
      prompt?: string;
      triggerType?: AiTriggerType;
      partialText?: string;
    };

    const validTriggerTypes: AiTriggerType[] = ['client_select', 'button', 'typing'];
    if (!triggerType || !validTriggerTypes.includes(triggerType)) {
      throw new BadRequestError('Invalid triggerType. Must be: client_select, button, or typing');
    }
    if (clientId !== undefined && (!Number.isInteger(clientId) || clientId <= 0)) {
      throw new BadRequestError('clientId must be a positive number');
    }
    if (prompt && (typeof prompt !== 'string' || prompt.length > 500)) {
      throw new BadRequestError('prompt must be a string with max 500 characters');
    }
    if (partialText && (typeof partialText !== 'string' || partialText.length > 200)) {
      throw new BadRequestError('partialText must be a string with max 200 characters');
    }

    logger.info(
      `[AI] suggestions requested user=${userId} trigger=${triggerType} client=${clientId ?? 'all'}`
    );
    const result = await generateSuggestions(
      userId,
      { clientId, prompt, triggerType, partialText },
      { contextRepository: aiContextRepository, providerFactory: createAiProvider }
    );
    logger.info(
      `[AI] suggestions response user=${userId} count=${result.suggestions.length} cache=${result.fromCache} provider=${result.provider}`
    );
    sendSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
};
