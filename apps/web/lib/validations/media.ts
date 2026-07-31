import { z } from 'zod';

// ============================================
// 查询参数 schemas
// ============================================

/** 媒体资源代理查询参数 */
export const MediaAssetQuery = z.object({
  pathname: z.string().min(1).describe('Vercel Blob 存储路径'),
});

// ============================================
// 请求体 schemas
// ============================================

/** 媒体上传请求体（FormData 字段描述，非 JSON body） */
export const MediaUploadBody = z.object({
  file: z.instanceof(File).describe('上传的文件，支持 PNG/JPEG/WebP/GIF，最大 10MB'),
  kind: z.enum(['media', 'avatar', 'page_cover']).default('media').describe('文件用途分类'),
  user_slug: z.string().optional().describe('用户 URL slug，默认使用当前用户'),
  uid: z.string().optional().describe('文件唯一标识，avatar/page_cover 必传'),
});

/** 媒体上传响应 */
export const MediaUploadResponse = z.object({
  url: z.string().describe('媒体资源代理 URL'),
  asset_id: z.string().describe('资源 ID'),
  thumbnail_url: z.string().nullable().describe('缩略图 URL'),
});
