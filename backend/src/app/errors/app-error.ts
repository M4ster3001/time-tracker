import { Prisma } from '@prisma/client';

export type FieldError = { field: string; message: string };

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly fieldErrors?: FieldError[];

  constructor(params: {
    message: string;
    statusCode: number;
    code: string;
    isOperational?: boolean;
    fieldErrors?: FieldError[];
  }) {
    super(params.message);
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.isOperational = params.isOperational ?? true;
    this.fieldErrors = params.fieldErrors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', fieldErrors?: FieldError[]) {
    super({ message, statusCode: 400, code: 'BAD_REQUEST', fieldErrors });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super({ message, statusCode: 401, code: 'UNAUTHORIZED' });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access denied') {
    super({ message, statusCode: 403, code: 'FORBIDDEN' });
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super({ message, statusCode: 404, code: 'NOT_FOUND' });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super({ message, statusCode: 409, code: 'CONFLICT' });
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', fieldErrors: FieldError[] = []) {
    super({ message, statusCode: 422, code: 'VALIDATION_ERROR', fieldErrors });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests, please try again later') {
    super({ message, statusCode: 429, code: 'RATE_LIMIT' });
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super({ message, statusCode: 500, code: 'INTERNAL_ERROR', isOperational: false });
  }
}

export const toAppError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return new ConflictError('Resource already exists');
    }
    if (error.code === 'P2025') {
      return new NotFoundError('Resource not found');
    }
    return new InternalError('Database operation failed');
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new BadRequestError('Invalid database request');
  }

  if (error instanceof Error) return new InternalError();

  return new InternalError();
};

export const resolveErrorStatus = (error: unknown): number => toAppError(error).statusCode;
export const getErrorMessage = (error: unknown): string => toAppError(error).message;
