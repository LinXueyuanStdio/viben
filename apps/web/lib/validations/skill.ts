import { z } from 'zod';

// ============================================
// 请求体 / 查询参数 schemas
// ============================================

export const SkillListQuery = z.object({
  page: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).default(1)).describe('页码'),
  limit: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).max(100).default(20)).describe('每页数量'),
  category: z.string().nullish().transform(v => v ?? undefined).describe('分类过滤'),
  type: z.enum(['command', 'prompt', 'agent']).nullish().transform(v => v ?? undefined).describe('Skill 类型过滤'),
  sort: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.enum(['latest', 'popular', 'downloads']).default('latest')).describe('排序方式'),
});

export const SkillSearchQuery = z.object({
  q: z.string().min(1).describe('搜索关键词'),
  page: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).default(1)).describe('页码'),
  limit: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).max(100).default(20)).describe('每页数量'),
});

export const SkillCreateBody = z.object({
  name: z.string().min(1).max(100).describe('名称'),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .describe('URL 友好标识符'),
  description: z.string().min(1).max(500).describe('简短描述'),
  longDescription: z.string().max(10000).optional().describe('详细描述'),
  skillType: z.enum(['command', 'prompt', 'agent']).default('command').describe('Skill 类型'),
  triggerPatterns: z.array(z.string()).default([]).describe('触发模式'),
  content: z.string().min(1).describe('内容'),
  tags: z.array(z.string()).max(10).default([]).describe('标签'),
  category: z.string().default('general').describe('分类'),
  compatibility: z.array(z.string()).default([]).describe('兼容性'),
  configSchema: z.record(z.string(), z.unknown()).optional().describe('配置 schema'),
  dependencies: z.array(z.string()).default([]).describe('依赖'),
});

export const SkillUpdateBody = SkillCreateBody.partial();

// ============================================
// 类型别名
// ============================================

export type ListSkillQuery = z.infer<typeof SkillListQuery>;
export type SearchSkillQuery = z.infer<typeof SkillSearchQuery>;
export type CreateSkillInput = z.infer<typeof SkillCreateBody>;
export type UpdateSkillInput = z.infer<typeof SkillUpdateBody>;
