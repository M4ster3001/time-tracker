import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { PrismaGoogleCalendarRepository } from './infrastructure/repositories/prisma-google-calendar.repository.js';
import { GoogleOAuthProvider } from './infrastructure/providers/google-oauth.provider.js';

export const googleCalendarRepository = new PrismaGoogleCalendarRepository(prisma);
export const googleCalendarProvider = new GoogleOAuthProvider();

export {
  GoogleTokenExpiredError,
  getAuthUrl,
  handleCallback,
  getConnectionStatus,
  disconnect,
  fetchEvents,
  recordImports,
} from './application/google-calendar.service.js';
export {
  googleCalendarAuthUrlController,
  googleCalendarCallbackController,
  googleCalendarStatusController,
  googleCalendarDisconnectController,
  googleCalendarEventsController,
  googleCalendarImportController,
} from './http/controller.js';
