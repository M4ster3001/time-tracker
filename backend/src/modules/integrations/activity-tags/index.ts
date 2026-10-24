import { prisma } from '../../../shared/infrastructure/db/prisma.js';
import { PrismaActivityTagRepository } from './infrastructure/repositories/prisma-activity-tag.repository.js';

export const activityTagRepository = new PrismaActivityTagRepository(prisma);

export { listActivityTagsController } from './http/controller.js';
export { listActivityTags, recordActivityTag } from './application/activity-tag.service.js';
