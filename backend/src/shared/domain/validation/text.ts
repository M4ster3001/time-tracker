export const sanitizeText = (input: string, maxLength = 1000): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  let sanitized = input.trim().slice(0, maxLength);
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');
  sanitized = sanitized.replace(/\0/g, '');

  return sanitized;
};

export const sanitizeActivityDescription = (description: string): string => {
  if (!description || typeof description !== 'string') {
    return '';
  }

  let sanitized = description.trim().slice(0, 500);
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  sanitized = sanitized.replace(/data:/gi, '');
  sanitized = sanitized.replace(/on\w+=/gi, '');
  sanitized = sanitized.replace(/\0/g, '');
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
};
