const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const MAX_EMAIL_LENGTH = 254;

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateEmail = (email: string): EmailValidationResult => {
  if (!email) {
    return { isValid: false, error: 'Email is required' };
  }

  if (typeof email !== 'string') {
    return { isValid: false, error: 'Email must be a string' };
  }

  const trimmedEmail = email.trim();

  if (trimmedEmail.length === 0) {
    return { isValid: false, error: 'Email cannot be empty' };
  }

  if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
    return { isValid: false, error: `Email must be at most ${MAX_EMAIL_LENGTH} characters` };
  }

  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  const [localPart, domain] = trimmedEmail.split('@');

  if (!localPart || localPart.length > 64) {
    return { isValid: false, error: 'Email local part must be at most 64 characters' };
  }

  if (!domain || domain.length > 253) {
    return { isValid: false, error: 'Email domain must be at most 253 characters' };
  }

  if (trimmedEmail.includes('..')) {
    return { isValid: false, error: 'Email cannot contain consecutive dots' };
  }

  return { isValid: true };
};

export const validateAndNormalizeEmail = (email: string): string => {
  const validation = validateEmail(email);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }
  return email.trim().toLowerCase();
};
