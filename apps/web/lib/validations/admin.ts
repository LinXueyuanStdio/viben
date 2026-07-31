import { z } from 'zod';

// ============================================
// 请求体 / 查询参数 schemas
// ============================================

/** 管理后台 — 包列表查询 */
export const AdminPackagesQuery = z.object({
  type: z.enum(['mcp', 'skill']).nullish().transform(v => v ?? undefined).describe('包类型'),
  status: z.enum(['pending', 'approved', 'rejected', 'featured']).nullish().transform(v => v ?? undefined).describe('审核状态'),
  page: z.coerce.number().min(1).default(1).describe('页码'),
  limit: z.coerce.number().min(1).max(100).default(20).describe('每页数量'),
  sort: z.enum(['newest', 'oldest']).default('oldest').describe('排序方式'),
});

/** 审核通过 */
export const ApprovePackageBody = z.object({
  note: z.string().max(1000).optional().describe('审核备注'),
});

/** 审核拒绝 */
export const RejectPackageBody = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(1000).describe('拒绝原因'),
});

/** 精选/取消精选 */
export const FeaturePackageBody = z.object({
  featured: z.boolean().describe('是否精选'),
});

/** 管理后台 — 操作日志查询 */
export const AdminLogsQuery = z.object({
  entityType: z
    .enum(['mcp', 'skill', 'comment', 'collection', 'user', 'report'])
    .nullish().transform(v => v ?? undefined)
    .describe('实体类型'),
  entityId: z.string().nullish().transform(v => v ?? undefined).describe('实体 ID'),
  adminId: z.string().nullish().transform(v => v ?? undefined).describe('管理员 ID'),
  action: z
    .enum([
      'approve',
      'reject',
      'feature',
      'unfeature',
      'delete',
      'warn',
      'ban',
      'unban',
    ])
    .nullish().transform(v => v ?? undefined)
    .describe('操作类型'),
  page: z.coerce.number().min(1).default(1).describe('页码'),
  limit: z.coerce.number().min(1).max(100).default(20).describe('每页数量'),
});

// ============================================
// 类型别名
// ============================================

export type ListAdminPackagesQuery = z.infer<typeof AdminPackagesQuery>;
export type ApprovePackageInput = z.infer<typeof ApprovePackageBody>;
export type RejectPackageInput = z.infer<typeof RejectPackageBody>;
export type FeaturePackageInput = z.infer<typeof FeaturePackageBody>;
export type ListLogsQuery = z.infer<typeof AdminLogsQuery>;
