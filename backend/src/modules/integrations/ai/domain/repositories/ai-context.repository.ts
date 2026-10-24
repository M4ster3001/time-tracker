import type { IAiContext } from '../ai.types.js';

export interface AiContextRepository {
  buildContext(userId: number, clientId?: number): Promise<IAiContext>;
}
