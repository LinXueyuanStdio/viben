import { z } from 'zod';

// ============================================
// 路径参数 / 查询参数 schemas
// ============================================

export const ReadPageParams = z.object({
  user_slug: z.string().describe('用户 URL slug'),
  page_id: z.string().describe('页面 ID'),
});

export const ReadPageQuery = z.object({
  fields: z.enum(['meta', 'html', 'all']).default('all').describe('返回字段范围'),
});
