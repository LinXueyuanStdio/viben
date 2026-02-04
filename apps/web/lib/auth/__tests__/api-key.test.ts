import { describe, it, expect, vi } from 'vitest';

// Mock the db module before importing api-key
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      apiKeys: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
  apiKeys: {},
}));

import { generateApiKey } from '../api-key';

describe('generateApiKey', () => {
  it('should generate an API key with correct format', async () => {
    const result = await generateApiKey();

    // Key should start with bmcp_
    expect(result.key.startsWith('bmcp_')).toBe(true);

    // Key format: bmcp_XXXXXXXX_YYYYYYYYYYYY
    const parts = result.key.split('_');
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe('bmcp');
    expect(parts[1].length).toBe(8);
    expect(parts[2].length).toBe(12);

    // Verify all properties are returned
    expect(result.keyHash).toBeDefined();
    expect(result.keyPrefix).toBeDefined();
  });

  it('should generate correct keyPrefix', async () => {
    const result = await generateApiKey();

    // keyPrefix should be first 13 characters
    expect(result.keyPrefix).toBe(result.key.slice(0, 13));
    expect(result.keyPrefix.startsWith('bmcp_')).toBe(true);
  });

  it('should generate a valid bcrypt hash', async () => {
    const { keyHash } = await generateApiKey();

    // bcrypt hashes start with $2b$
    expect(keyHash.startsWith('$2b$')).toBe(true);
    expect(keyHash.length).toBeGreaterThan(50);
  });

  it('should generate unique keys each time', async () => {
    const key1 = await generateApiKey();
    const key2 = await generateApiKey();
    const key3 = await generateApiKey();

    expect(key1.key).not.toBe(key2.key);
    expect(key2.key).not.toBe(key3.key);
    expect(key1.key).not.toBe(key3.key);
  });

  it('should generate unique prefixes each time', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, () => generateApiKey())
    );

    const prefixes = results.map((r) => r.keyPrefix);
    const uniquePrefixes = new Set(prefixes);

    expect(uniquePrefixes.size).toBe(10);
  });

  it('should only contain alphanumeric characters in random parts', async () => {
    const { key } = await generateApiKey();
    const parts = key.split('_');

    // Both random parts should be alphanumeric
    expect(/^[a-f0-9]+$/.test(parts[1])).toBe(true);
    expect(/^[a-f0-9]+$/.test(parts[2])).toBe(true);
  });

  it('should generate hash that can be verified with bcrypt', async () => {
    const bcrypt = await import('bcrypt');
    const { key, keyHash } = await generateApiKey();

    const isValid = await bcrypt.compare(key, keyHash);
    expect(isValid).toBe(true);
  });

  it('should generate hash that fails for wrong key', async () => {
    const bcrypt = await import('bcrypt');
    const { keyHash } = await generateApiKey();

    const isValid = await bcrypt.compare('wrong-key', keyHash);
    expect(isValid).toBe(false);
  });
});
