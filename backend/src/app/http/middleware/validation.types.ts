import type { FieldError } from '../../errors/app-error.js';
import type { ValidationRule } from '../../../shared/domain/validation/validation.contracts.js';

export type ValidationSource = 'body' | 'query' | 'params';
export type ValidationSchema = Record<string, ValidationRule>;
export type FieldValidationError = FieldError;
