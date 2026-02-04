import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../password';

describe('hashPassword', () => {
  it('should hash a password', async () => {
    const password = 'mySecurePassword123';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2b$')).toBe(true); // bcrypt hash format
  });

  it('should produce different hashes for the same password', async () => {
    const password = 'mySecurePassword123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2); // Different salts produce different hashes
  });

  it('should handle empty string', async () => {
    const hash = await hashPassword('');
    expect(hash).toBeDefined();
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  it('should handle unicode characters', async () => {
    const password = '密码123!@#';
    const hash = await hashPassword(password);
    expect(hash).toBeDefined();
    expect(hash.startsWith('$2b$')).toBe(true);
  });

  it('should handle very long passwords', async () => {
    const password = 'a'.repeat(100);
    const hash = await hashPassword(password);
    expect(hash).toBeDefined();
  });
});

describe('verifyPassword', () => {
  it('should verify correct password', async () => {
    const password = 'mySecurePassword123';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'mySecurePassword123';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword('wrongPassword', hash);
    expect(isValid).toBe(false);
  });

  it('should reject similar but different passwords', async () => {
    const password = 'mySecurePassword123';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword('mySecurePassword124', hash);
    expect(isValid).toBe(false);
  });

  it('should be case sensitive', async () => {
    const password = 'MySecurePassword123';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword('mysecurepassword123', hash);
    expect(isValid).toBe(false);
  });

  it('should handle empty password verification', async () => {
    const hash = await hashPassword('');

    const isValidEmpty = await verifyPassword('', hash);
    expect(isValidEmpty).toBe(true);

    const isValidNonEmpty = await verifyPassword('something', hash);
    expect(isValidNonEmpty).toBe(false);
  });

  it('should handle unicode character verification', async () => {
    const password = '密码123!@#';
    const hash = await hashPassword(password);

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('密码123!@$', hash);
    expect(isInvalid).toBe(false);
  });
});
