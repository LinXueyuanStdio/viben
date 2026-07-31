import { z } from 'zod';

/** 通用错误响应 */
export const ErrorResponse = z.object({
  error: z.string().describe('错误信息'),
});

/** 通用成功标记响应 */
export const SuccessResponse = z.object({
  success: z.literal(true).describe('操作成功'),
});
