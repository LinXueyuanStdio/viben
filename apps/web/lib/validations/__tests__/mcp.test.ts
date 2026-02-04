import { describe, it, expect } from 'vitest';
import {
  listMcpQuerySchema,
  searchMcpQuerySchema,
  createMcpSchema,
  updateMcpSchema,
} from '../mcp';

describe('listMcpQuerySchema', () => {
  it('should validate valid list query', () => {
    const validData = {
      page: 1,
      limit: 20,
      category: 'tools',
      sort: 'latest',
    };
    const result = listMcpQuerySchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should use defaults for empty object', () => {
    const result = listMcpQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort).toBe('latest');
    }
  });

  it('should coerce string numbers to numbers', () => {
    const result = listMcpQuerySchema.safeParse({
      page: '2',
      limit: '10',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(10);
    }
  });

  it('should reject page less than 1', () => {
    const result = listMcpQuerySchema.safeParse({
      page: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject limit greater than 100', () => {
    const result = listMcpQuerySchema.safeParse({
      limit: 101,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid sort value', () => {
    const result = listMcpQuerySchema.safeParse({
      sort: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid sort values', () => {
    const validSorts = ['latest', 'popular', 'downloads'];
    for (const sort of validSorts) {
      const result = listMcpQuerySchema.safeParse({ sort });
      expect(result.success).toBe(true);
    }
  });
});

describe('searchMcpQuerySchema', () => {
  it('should validate valid search query', () => {
    const result = searchMcpQuerySchema.safeParse({
      q: 'search term',
      page: 1,
      limit: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should require q parameter', () => {
    const result = searchMcpQuerySchema.safeParse({
      page: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty q parameter', () => {
    const result = searchMcpQuerySchema.safeParse({
      q: '',
    });
    expect(result.success).toBe(false);
  });

  it('should use defaults for page and limit', () => {
    const result = searchMcpQuerySchema.safeParse({
      q: 'test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });
});

describe('createMcpSchema', () => {
  const validMcp = {
    name: 'Test MCP',
    slug: 'test-mcp',
    description: 'A test MCP server',
    entryPoint: 'npx test-mcp',
  };

  it('should validate valid MCP creation', () => {
    const result = createMcpSchema.safeParse(validMcp);
    expect(result.success).toBe(true);
  });

  it('should use defaults for optional fields', () => {
    const result = createMcpSchema.safeParse(validMcp);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.transport).toBe('stdio');
      expect(result.data.license).toBe('MIT');
      expect(result.data.tags).toEqual([]);
      expect(result.data.category).toBe('general');
      expect(result.data.dependencies).toEqual([]);
    }
  });

  it('should accept valid slug with hyphens', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      slug: 'my-test-mcp-123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject slug with uppercase letters', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      slug: 'Test-MCP',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Slug must be lowercase alphanumeric with hyphens'
      );
    }
  });

  it('should reject slug with spaces', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      slug: 'test mcp',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid transport types', () => {
    const validTransports = ['stdio', 'sse', 'http'];
    for (const transport of validTransports) {
      const result = createMcpSchema.safeParse({
        ...validMcp,
        transport,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid transport type', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      transport: 'websocket',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid repository URL', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      repositoryUrl: 'https://github.com/user/repo',
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty string for repository URL', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      repositoryUrl: '',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid repository URL', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      repositoryUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('should reject more than 10 tags', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('should accept up to 10 tags', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      tags: Array.from({ length: 10 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(true);
  });

  it('should reject description longer than 500 characters', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      description: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject longDescription longer than 10000 characters', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      longDescription: 'a'.repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it('should accept configSchema as record', () => {
    const result = createMcpSchema.safeParse({
      ...validMcp,
      configSchema: {
        apiKey: { type: 'string', required: true },
        timeout: { type: 'number', default: 30 },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('updateMcpSchema', () => {
  it('should accept partial updates', () => {
    const result = updateMcpSchema.safeParse({
      name: 'Updated Name',
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = updateMcpSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should still validate fields when provided', () => {
    const result = updateMcpSchema.safeParse({
      slug: 'Invalid Slug',
    });
    expect(result.success).toBe(false);
  });
});
