import { z } from 'zod';

/** 通用错误响应 */
export const ErrorResponse = z.object({
  error: z.string().describe('错误信息'),
});

/** 通用成功标记响应 */
export const SuccessResponse = z.object({
  success: z.literal(true).describe('操作成功'),
});

/** 健康检查响应 */
export const HealthCheckResponse = z.object({
  status: z.enum(['healthy', 'unhealthy']).describe('服务整体状态'),
  checks: z.record(z.string(), z.object({
    status: z.enum(['ok', 'error', 'skipped', 'unknown']).describe('检查项状态'),
    message: z.string().optional().describe('检查项详情'),
  })).describe('各项检查结果'),
});
