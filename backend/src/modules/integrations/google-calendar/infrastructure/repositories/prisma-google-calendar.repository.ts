import type { PrismaClient } from '@prisma/client';
import type {
  GoogleCalendarConnectionRecord,
  GoogleCalendarRepository,
} from '../../domain/repositories/google-calendar.repository.js';

export class PrismaGoogleCalendarRepository implements GoogleCalendarRepository {
  constructor(
    private readonly db: Pick<PrismaClient, 'googleCalendarConnection' | 'googleCalendarImport'>
  ) {}

  upsertConnection(params: {
    userId: number;
    accessTokenEnc: string;
    refreshTokenEnc: string;
    tokenExpiresAt: Date;
    calendarEmail: string | null;
  }): Promise<GoogleCalendarConnectionRecord> {
    return this.db.googleCalendarConnection.upsert({
      where: { userId: params.userId },
      update: {
        accessTokenEnc: params.accessTokenEnc,
        refreshTokenEnc: params.refreshTokenEnc,
        tokenExpiresAt: params.tokenExpiresAt,
        calendarEmail: params.calendarEmail,
      },
      create: {
        userId: params.userId,
        accessTokenEnc: params.accessTokenEnc,
        refreshTokenEnc: params.refreshTokenEnc,
        tokenExpiresAt: params.tokenExpiresAt,
        calendarEmail: params.calendarEmail,
      },
    });
  }

  findConnectionByUserId(userId: number): Promise<GoogleCalendarConnectionRecord | null> {
    return this.db.googleCalendarConnection.findUnique({ where: { userId } });
  }

  async updateAccessToken(
    userId: number,
    accessTokenEnc: string,
    tokenExpiresAt: Date
  ): Promise<void> {
    await this.db.googleCalendarConnection.update({
      where: { userId },
      data: { accessTokenEnc, tokenExpiresAt },
    });
  }

  async deleteConnection(userId: number): Promise<void> {
    await this.db.googleCalendarConnection.delete({ where: { userId } });
  }

  async findImportedEventIds(userId: number, googleEventIds: string[]): Promise<Set<string>> {
    const imports = await this.db.googleCalendarImport.findMany({
      where: { userId, googleEventId: { in: googleEventIds } },
      select: { googleEventId: true },
    });
    return new Set(imports.map((item) => item.googleEventId));
  }

  async recordImports(
    userId: number,
    imports: Array<{ googleEventId: string; timeEntryId: number }>
  ): Promise<void> {
    await this.db.googleCalendarImport.createMany({
      data: imports.map((item) => ({ userId, ...item })),
      skipDuplicates: true,
    });
  }
}
