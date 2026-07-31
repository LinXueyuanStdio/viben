import { z } from 'zod';

// ============================================
// 请求体 / 查询参数 schemas
// ============================================

export const McpListQuery = z.object({
  page: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).default(1)).describe('页码'),
  limit: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).max(100).default(20)).describe('每页数量'),
  category: z.string().nullish().transform(v => v ?? undefined).describe('分类过滤'),
  sort: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.enum(['latest', 'popular', 'downloads']).default('latest')).describe('排序方式'),
});

export const McpSearchQuery = z.object({
  q: z.string().min(1).describe('搜索关键词'),
  page: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).default(1)).describe('页码'),
  limit: z.preprocess((v) => (v === null || v === '' ? undefined : v), z.coerce.number().min(1).max(100).default(20)).describe('每页数量'),
});

export const McpCreateBody = z.object({
  name: z.string().min(1).max(100).describe('包名称'),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .describe('URL 友好标识符'),
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

export const McpUpdateBody = McpCreateBody.partial();

// ============================================
// 类型别名
// ============================================

export type ListMcpQuery = z.infer<typeof McpListQuery>;
export type SearchMcpQuery = z.infer<typeof McpSearchQuery>;
export type CreateMcpInput = z.infer<typeof McpCreateBody>;
export type UpdateMcpInput = z.infer<typeof McpUpdateBody>;
