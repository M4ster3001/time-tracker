import { BadRequestError } from '../../../../app/errors/app-error.js';

export type ListTimeEntriesBounds = {
  month?: number;
  year?: number;
  clientId?: number;
};

/** Public list handlers must always scope by calendar month (and optional client). */
export const assertListTimeEntriesBounded = (params: ListTimeEntriesBounds): void => {
  if (!params.year || !params.month) {
    throw new BadRequestError('year and month query params are required');
  }
};
