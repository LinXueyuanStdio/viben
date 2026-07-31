import { describe, it, expect } from 'vitest';
import {
  RegisterBody,
  LoginBody,
  UpdateProfileBody,
  CreateApiKeyBody,
} from '../user';

describe('RegisterBody', () => {
  it('should validate valid registration data', () => {
    const data = {
      email: 'test@example.com',
      username: 'testuser123',
      password: 'password123',
      displayName: 'Test User',
    };
    const result = RegisterBody.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const data = {
      email: 'notanemail',
      username: 'testuser123',
      password: 'password123',
      displayName: 'Test User',
    };
    const result = RegisterBody.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const data = {
      email: 'test@example.com',
      username: 'testuser123',
      password: 'short',
      displayName: 'Test User',
    };
    const result = RegisterBody.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject invalid username', () => {
    const data = {
      email: 'test@example.com',
      username: 'a',
      password: 'password123',
      displayName: 'Test User',
    };
    const result = RegisterBody.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('LoginBody', () => {
  it('should validate valid login data', () => {
    const data = { email: 'test@example.com', password: 'password123' };
    const result = LoginBody.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject missing fields', () => {
    const data = { email: 'test@example.com' };
    const result = LoginBody.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('should reject invalid email', () => {
    const data = { email: 'invalid', password: 'password123' };
    const result = LoginBody.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe('UpdateProfileBody', () => {
  it('should validate full profile update', () => {
    const data = {
      displayName: 'New Name',
      bio: 'Hello world',
      websiteUrl: 'https://example.com',
      avatarUrl: 'https://example.com/avatar.png',
    };
    const result = UpdateProfileBody.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate partial update', () => {
    const data = { displayName: 'New Name' };
    const result = UpdateProfileBody.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should validate empty object', () => {
    const data = {};
    const result = UpdateProfileBody.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('CreateApiKeyBody', () => {
  it('should validate with default scopes', () => {
    const data = { name: 'My API Key' };
    const result = CreateApiKeyBody.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scopes).toEqual(['read']);
    }
  });

  it('should validate with custom scopes', () => {
    const data = { name: 'My API Key', scopes: ['read', 'write'] };
    const result = CreateApiKeyBody.safeParse(data);
    expect(result.success).toBe(true);
  });
});
