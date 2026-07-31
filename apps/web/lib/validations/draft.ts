import { z } from 'zod';

// ============================================
// 请求体 / 查询参数 schemas
// ============================================

export const DraftsQuery = z.object({
  page: z.coerce.number().min(1).default(1).describe('页码'),
  limit: z.coerce.number().min(1).max(100).default(20).describe('每页数量'),
  packageType: z.enum(['mcp', 'skill']).nullish().transform(v => v ?? undefined).describe('包类型过滤'),
  includeExpired: z.coerce.boolean().default(false).describe('是否包含已过期'),
});

export const DraftCreateBody = z.object({
  packageType: z.enum(['mcp', 'skill']).describe('包类型'),
  data: z.record(z.string(), z.unknown()).default({}).describe('草稿数据'),
});

export const DraftUpdateBody = z.object({
  data: z.record(z.string(), z.unknown()).describe('草稿数据'),
});

/** MCP 草稿发布校验 */
export const McpDraftPublishBody = z.object({
  step: z.number().optional(),
  name: z.string().min(1).max(100).describe('包名称'),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .describe('URL 友好标识符'),
  version: z.string().default('1.0.0').describe('版本号'),
  description: z.string().min(1).max(500).describe('简短描述'),
  longDescription: z.string().max(10000).optional().describe('详细描述'),
  transport: z.enum(['stdio', 'sse', 'http']).default('stdio').describe('传输协议'),
  entryPoint: z.string().min(1).describe('入口点'),
  repositoryUrl: z.string().url().optional().or(z.literal('')).describe('仓库地址'),
  homepageUrl: z.string().url().optional().or(z.literal('')).describe('主页地址'),
  license: z.string().default('MIT').describe('许可证'),
  tags: z.array(z.string()).max(10).default([]).describe('标签'),
  category: z.string().default('general').describe('分类'),
  configSchema: z.record(z.string(), z.unknown()).optional().describe('配置 schema'),
  dependencies: z.array(z.string()).default([]).describe('依赖'),
});

/** Skill 草稿发布校验 */
export const SkillDraftPublishBody = z.object({
  step: z.number().optional(),
  importSource: z.enum(['upload', 'directory', 'github']).optional().describe('导入来源'),
  name: z.string().min(1).max(100).describe('名称'),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .describe('URL 友好标识符'),
  version: z.string().default('1.0.0').describe('版本号'),
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

// ============================================
// 类型别名
// ============================================

export type ListDraftsQuery = z.infer<typeof DraftsQuery>;
export type CreateDraftInput = z.infer<typeof DraftCreateBody>;
export type UpdateDraftInput = z.infer<typeof DraftUpdateBody>;
export type MCPDraftData = z.infer<typeof McpDraftPublishBody>;
export type SkillDraftData = z.infer<typeof SkillDraftPublishBody>;
