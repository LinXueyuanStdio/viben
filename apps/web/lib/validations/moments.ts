import { z } from 'zod';

// ============================================
// 查询参数
// ============================================

export const MomentsFeedQuery = z.object({
  feed_type: z.enum(['following', 'latest', 'recommended']).describe('动态类型'),
  limit: z.coerce.number().min(1).max(50).default(20).describe('每页数量'),
  cursor: z.string().optional().describe('分页游标'),
});

export const MomentsListQuery = z.object({
  feed_type: z.enum(['following', 'latest', 'recommended']).default('latest').describe('动态类型'),
  limit: z.coerce.number().min(1).max(30).default(10).describe('每页数量'),
  cursor: z.string().optional().describe('分页游标'),
});

// ============================================
// 请求体
// ============================================

export const MomentCreateBody = z.object({
  body: z.string().describe('动态内容'),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public').describe('可见性'),
  topics: z.array(z.string()).default([]).describe('话题标签'),
});

export const MomentRepostBody = z.object({
  moment_id: z.string().min(1).describe('要转发的动态 ID'),
});

// ============================================
// 响应
// ============================================

export const MomentRepostResponse = z.object({
  success: z.literal(true).describe('转发成功'),
  moment_id: z.string().describe('新动态 ID'),
});

export const MomentResponse = z.object({
  id: z.string().describe('动态 ID'),
  body: z.string().describe('动态内容'),
  visibility: z.string().describe('可见性'),
  topics: z.array(z.string()).describe('话题标签'),
  authorId: z.string().describe('作者 ID'),
  createdAt: z.string().describe('创建时间'),
});

export const MomentFeedResponse = z.object({
  items: z.array(MomentResponse).describe('动态列表'),
  nextCursor: z.string().nullable().describe('下一页游标'),
  hasMore: z.boolean().describe('是否有更多'),
});

/** 创建动态响应（moment 字段包裹） */
export const MomentCreateResponse = z.object({
  moment: MomentResponse.describe('创建的动态'),
});

// ============================================
// 类型别名
// ============================================

export type MomentFeedInput = z.infer<typeof MomentsFeedQuery>;
export type MomentListInput = z.infer<typeof MomentsListQuery>;
export type CreateMomentInput = z.infer<typeof MomentCreateBody>;
