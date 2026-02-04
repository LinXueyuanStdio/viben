import { describe, it, expect } from 'vitest';
import {
  listSkillQuerySchema,
  searchSkillQuerySchema,
  createSkillSchema,
  updateSkillSchema,
} from '../skill';

describe('listSkillQuerySchema', () => {
  it('should validate valid list query', () => {
    const result = listSkillQuerySchema.safeParse({
      page: 1,
      limit: 20,
      category: 'automation',
      type: 'command',
      sort: 'latest',
    });
    expect(result.success).toBe(true);
  });

  it('should use defaults for empty object', () => {
    const result = listSkillQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort).toBe('latest');
    }
  });

  it('should coerce string numbers to numbers', () => {
    const result = listSkillQuerySchema.safeParse({
      page: '3',
      limit: '15',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(15);
    }
  });

  it('should accept valid type values', () => {
    const validTypes = ['command', 'prompt', 'agent'];
    for (const type of validTypes) {
      const result = listSkillQuerySchema.safeParse({ type });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid type value', () => {
    const result = listSkillQuerySchema.safeParse({
      type: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should reject page less than 1', () => {
    const result = listSkillQuerySchema.safeParse({
      page: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject limit greater than 100', () => {
    const result = listSkillQuerySchema.safeParse({
      limit: 101,
    });
    expect(result.success).toBe(false);
  });

  it('should accept all valid sort values', () => {
    const validSorts = ['latest', 'popular', 'downloads'];
    for (const sort of validSorts) {
      const result = listSkillQuerySchema.safeParse({ sort });
      expect(result.success).toBe(true);
    }
  });
});

describe('searchSkillQuerySchema', () => {
  it('should validate valid search query', () => {
    const result = searchSkillQuerySchema.safeParse({
      q: 'search term',
      page: 1,
      limit: 10,
    });
    expect(result.success).toBe(true);
  });

  it('should require q parameter', () => {
    const result = searchSkillQuerySchema.safeParse({
      page: 1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty q parameter', () => {
    const result = searchSkillQuerySchema.safeParse({
      q: '',
    });
    expect(result.success).toBe(false);
  });

  it('should use defaults for page and limit', () => {
    const result = searchSkillQuerySchema.safeParse({
      q: 'test',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });
});

describe('createSkillSchema', () => {
  const validSkill = {
    name: 'Test Skill',
    slug: 'test-skill',
    description: 'A test skill',
    content: '# Test Skill Content\n\nThis is the skill content.',
  };

  it('should validate valid skill creation', () => {
    const result = createSkillSchema.safeParse(validSkill);
    expect(result.success).toBe(true);
  });

  it('should use defaults for optional fields', () => {
    const result = createSkillSchema.safeParse(validSkill);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skillType).toBe('command');
      expect(result.data.triggerPatterns).toEqual([]);
      expect(result.data.tags).toEqual([]);
      expect(result.data.category).toBe('general');
      expect(result.data.compatibility).toEqual([]);
      expect(result.data.dependencies).toEqual([]);
    }
  });

  it('should accept valid slug with hyphens', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      slug: 'my-test-skill-123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject slug with uppercase letters', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      slug: 'Test-Skill',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Slug must be lowercase alphanumeric with hyphens'
      );
    }
  });

  it('should reject slug with spaces', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      slug: 'test skill',
    });
    expect(result.success).toBe(false);
  });

  it('should accept valid skillType values', () => {
    const validTypes = ['command', 'prompt', 'agent'];
    for (const skillType of validTypes) {
      const result = createSkillSchema.safeParse({
        ...validSkill,
        skillType,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid skillType', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      skillType: 'invalid',
    });
    expect(result.success).toBe(false);
  });

  it('should accept trigger patterns array', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      triggerPatterns: ['trigger1', 'trigger2'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject more than 10 tags', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      tags: Array.from({ length: 11 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('should accept up to 10 tags', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      tags: Array.from({ length: 10 }, (_, i) => `tag${i}`),
    });
    expect(result.success).toBe(true);
  });

  it('should reject description longer than 500 characters', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      description: 'a'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('should reject longDescription longer than 10000 characters', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      longDescription: 'a'.repeat(10001),
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty content', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      content: '',
    });
    expect(result.success).toBe(false);
  });

  it('should accept configSchema as record', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      configSchema: {
        model: { type: 'string', default: 'gpt-4' },
        temperature: { type: 'number', min: 0, max: 2 },
      },
    });
    expect(result.success).toBe(true);
  });

  it('should accept compatibility array', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      compatibility: ['claude-code', 'cursor'],
    });
    expect(result.success).toBe(true);
  });

  it('should accept dependencies array', () => {
    const result = createSkillSchema.safeParse({
      ...validSkill,
      dependencies: ['mcp-server-1', 'mcp-server-2'],
    });
    expect(result.success).toBe(true);
  });
});

describe('updateSkillSchema', () => {
  it('should accept partial updates', () => {
    const result = updateSkillSchema.safeParse({
      name: 'Updated Name',
    });
    expect(result.success).toBe(true);
  });

  it('should accept empty object', () => {
    const result = updateSkillSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should still validate fields when provided', () => {
    const result = updateSkillSchema.safeParse({
      slug: 'Invalid Slug',
    });
    expect(result.success).toBe(false);
  });

  it('should allow updating only content', () => {
    const result = updateSkillSchema.safeParse({
      content: 'New content here',
    });
    expect(result.success).toBe(true);
  });

  it('should validate skillType when updating', () => {
    const result = updateSkillSchema.safeParse({
      skillType: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});
