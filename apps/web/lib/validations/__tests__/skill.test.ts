import { describe, it, expect } from 'vitest';
import {
  SkillListQuery,
  SkillSearchQuery,
  SkillCreateBody,
  SkillUpdateBody,
} from '../skill';

describe('SkillListQuery', () => {
  it('should validate valid list query', () => {
    const data = { page: 1, limit: 20 };
    const result = SkillListQuery.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const result = SkillListQuery.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
      expect(result.data.sort).toBe('latest');
    }
  });
});

describe('SkillSearchQuery', () => {
  it('should validate valid search query', () => {
    const data = { q: 'test', page: 1, limit: 20 };
    const result = SkillSearchQuery.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('SkillCreateBody', () => {
  it('should validate valid create data', () => {
    const data = {
      name: 'Test Skill',
      slug: 'test-skill',
      description: 'A test skill',
      skillType: 'command' as const,
      content: 'echo hello',
    };
    const result = SkillCreateBody.safeParse(data);
    expect(result.success).toBe(true);
  });

  it('should apply defaults', () => {
    const data = {
      name: 'Test',
      slug: 'test',
      description: 'Test',
      content: 'echo',
    };
    const result = SkillCreateBody.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.skillType).toBe('command');
      expect(result.data.category).toBe('general');
    }
  });
});

describe('SkillUpdateBody', () => {
  it('should allow partial update', () => {
    const result = SkillUpdateBody.safeParse({ name: 'Updated' });
    expect(result.success).toBe(true);
  });
});
