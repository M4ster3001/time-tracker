export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'email' | 'date' | 'array';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  message?: string;
}
