import { describe, it, expect } from 'vitest';
import {
  McpListQuery,
  McpSearchQuery,
  McpCreateBody,
  McpUpdateBody,
} from '../mcp';

describe('McpListQuery', () => {
  it('should validate valid list query', () => {
    const data = { page: 1, limit: 20 };
    const result = McpListQuery.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const result = McpListQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort).toBe('latest');
    }
  });

  it('should reject invalid page', () => {
    const result = McpListQuery.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });
});

describe('McpSearchQuery', () => {
  it('should validate valid search query', () => {
    const data = { q: 'test', page: 1, limit: 20 };
    const result = McpSearchQuery.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject empty search', () => {
    const result = McpSearchQuery.safeParse({ q: '' });
    expect(result.success).toBe(false);
  });
});

describe('McpCreateBody', () => {
  it('should validate valid create data', () => {
    const data = {
      name: 'Test MCP',
      slug: 'test-mcp',
      description: 'A test MCP package',
      transport: 'stdio',
      entryPoint: './server.js',
    };
    const result = McpCreateBody.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should reject missing required fields', () => {
    const result = McpCreateBody.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('McpUpdateBody', () => {
  it('should allow partial update', () => {
    const result = McpUpdateBody.safeParse({ name: 'Updated Name' });
    expect(result.success).toBe(true);
  });

  it('should validate empty object', () => {
    const result = McpUpdateBody.safeParse({});
    expect(result.success).toBe(true);
  });
});
