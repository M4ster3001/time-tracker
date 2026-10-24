import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { config } from '../../../config.js';
import { logger } from '../logger/logger.js';
import {
  allowsDerivedFieldEncryptionKey,
  assertFieldEncryptionKeyConfigured,
} from './encryption-key-policy.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

const getEncryptionKey = (): Buffer => {
  const keyHex = process.env.FIELD_ENCRYPTION_KEY;
  assertFieldEncryptionKeyConfigured({
    env: config.env,
    fieldEncryptionKey: keyHex,
  });

  if (!keyHex) {
    if (!allowsDerivedFieldEncryptionKey(config.env)) {
      throw new Error(`FATAL: FIELD_ENCRYPTION_KEY is required in ${config.env}`);
    }
    logger.warn(
      '[ENCRYPTION] FIELD_ENCRYPTION_KEY not set - deriving from JWT_SECRET (dev/test only)'
    );
    return createHash('sha256').update(config.jwt.secret).digest();
  }

  if (keyHex.length !== 64) {
    throw new Error('FATAL: FIELD_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }

  return Buffer.from(keyHex, 'hex');
};

export const encrypt = (plaintext: string): string => {
  if (!plaintext) return plaintext;

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decrypt = (encryptedText: string): string => {
  if (!encryptedText || !encryptedText.includes(':')) return encryptedText;

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;

    const [ivHex, authTagHex, encrypted] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    logger.warn({ err: error }, '[ENCRYPTION] Decryption failed - data may not be encrypted');
    return encryptedText;
  }
};

export const isEncrypted = (text: string): boolean => {
  if (!text) return false;
  const parts = text.split(':');
  return parts.length === 3 && parts[0].length === IV_LENGTH * 2;
};

export const hashForLookup = (plaintext: string): string => {
  if (!plaintext) return plaintext;
  const salt = process.env.HASH_SALT || config.jwt.secret;
  return createHash('sha256')
    .update(plaintext + salt)
    .digest('hex');
};

export const encryptIfNeeded = (text: string): string => {
  if (!text || isEncrypted(text)) return text;
  return encrypt(text);
};

export const decryptIfNeeded = (text: string): string => {
  if (!text || !isEncrypted(text)) return text;
  return decrypt(text);
};
