import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  createApiKeySchema,
} from '../user';

describe('registerSchema', () => {
  it('should validate valid registration data', () => {
    const validData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      displayName: 'Test User',
    };
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      username: 'testuser',
      password: 'password123',
      displayName: 'Test User',
    };
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email address');
    }
  });

  it('should reject username shorter than 3 characters', () => {
    const invalidData = {
      email: 'test@example.com',
      username: 'ab',
      password: 'password123',
      displayName: 'Test User',
    };
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Username must be at least 3 characters'
      );
    }
  });

  it('should reject username longer than 30 characters', () => {
    const invalidData = {
      email: 'test@example.com',
      username: 'a'.repeat(31),
      password: 'password123',
      displayName: 'Test User',
    };
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject username with invalid characters', () => {
    const invalidData = {
      email: 'test@example.com',
      username: 'test user!',
      password: 'password123',
      displayName: 'Test User',
    };
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Username must start with a letter or underscore and contain only letters, numbers, underscores, and hyphens'
      );
    }
  });

  it('should reject username that starts with a number', () => {
    const invalidData = {
      email: 'test@example.com',
      username: '1testuser',
      password: 'password123',
      displayName: 'Test User',
    };
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Username must start with a letter or underscore and contain only letters, numbers, underscores, and hyphens'
      );
    }
  });

  it('should accept username with underscores and hyphens', () => {
    const validData = {
      email: 'test@example.com',
      username: 'test_user-123',
      password: 'password123',
      displayName: 'Test User',
    };
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject password shorter than 8 characters', () => {
    const invalidData = {
      email: 'test@example.com',
      username: 'testuser',
      password: '1234567',
      displayName: 'Test User',
    };
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Password must be at least 8 characters'
      );
    }
  });

  it('should reject empty display name', () => {
    const invalidData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      displayName: '',
    };
    const result = registerSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('should validate valid login data', () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
    };
    const result = loginSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const invalidData = {
      email: 'invalid-email',
      password: 'password123',
    };
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject empty password', () => {
    const invalidData = {
      email: 'test@example.com',
      password: '',
    };
    const result = loginSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('should validate valid profile update', () => {
    const validData = {
      displayName: 'New Name',
      bio: 'This is my bio',
      websiteUrl: 'https://example.com',
    };
    const result = updateProfileSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should accept empty object (all fields optional)', () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept empty string for websiteUrl', () => {
    const result = updateProfileSchema.safeParse({
      websiteUrl: '',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid URL', () => {
    const result = updateProfileSchema.safeParse({
      websiteUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('should reject bio longer than 500 characters', () => {
    const result = updateProfileSchema.safeParse({
      bio: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject displayName longer than 100 characters', () => {
    const result = updateProfileSchema.safeParse({
      displayName: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe('createApiKeySchema', () => {
  it('should validate valid API key creation', () => {
    const validData = {
      name: 'My API Key',
      scopes: ['read', 'write'],
      expiresIn: 30,
    };
    const result = createApiKeySchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should use default scopes when not provided', () => {
    const result = createApiKeySchema.safeParse({
      name: 'My API Key',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scopes).toEqual(['read']);
    }
  });

  it('should reject invalid scope', () => {
    const result = createApiKeySchema.safeParse({
      name: 'My API Key',
      scopes: ['read', 'invalid'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject expiresIn greater than 365 days', () => {
    const result = createApiKeySchema.safeParse({
      name: 'My API Key',
      expiresIn: 400,
    });
    expect(result.success).toBe(false);
  });

  it('should reject expiresIn less than 1 day', () => {
    const result = createApiKeySchema.safeParse({
      name: 'My API Key',
      expiresIn: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty name', () => {
    const result = createApiKeySchema.safeParse({
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject name longer than 100 characters', () => {
    const result = createApiKeySchema.safeParse({
      name: 'a'.repeat(101),
    });
    expect(result.success).toBe(false);
  });
});
