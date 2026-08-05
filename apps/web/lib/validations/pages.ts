import { z } from 'zod';

// ============================================
// 路径参数 schemas
// ============================================

export const PagesParams = z.object({
  id: z.string().describe('页面 ID'),
});

export const PagesRawParams = z.object({
  user_slug: z.string().describe('用户 slug'),
  page_id: z.string().describe('页面 ID'),
});

// ============================================
// 请求体 schemas
// ============================================

export const PublishPageBody = z.object({
  uid: z.string().min(1).describe('页面唯一标识符'),
  title: z.string().min(1).describe('页面标题'),
  icon: z
    .object({
      type: z.string(),
      value: z.string(),
    })
    .optional()
    .nullable()
    .describe('页面图标'),
  description: z.string().optional().nullable().describe('页面描述'),
  html: z.string().min(1).describe('HTML 内容'),
  cover_url: z.string().optional().nullable().describe('封面图 URL'),
  category_id: z.string().optional().describe('分类 ID'),
  tags: z.array(z.string()).max(12).optional().describe('标签列表'),
  visibility: z.enum(['public', 'unlisted', 'private']).default('public').describe('可见性'),
  importance: z.enum(['normal', 'major']).default('normal').describe('重要性'),
  collection_slug: z.string().optional().describe('合集 slug'),
  collection_name: z.string().optional().describe('合集名称'),
  scheduled_at: z.string().optional().describe('定时发布时间（ISO 日期字符串）'),
});

export const PublishRollbackBody = z.object({
  uid: z.string().min(1).describe('页面唯一标识符'),
  version: z.number().int().min(1).describe('要回滚到的版本号'),
});

export const PagesSettingsBody = z.object({
  uid: z.string().min(1).describe('页面唯一标识符'),
  seo_title: z.string().optional().nullable().describe('SEO 标题'),
  seo_description: z.string().optional().nullable().describe('SEO 描述'),
  seo_keywords: z.string().optional().nullable().describe('SEO 关键词'),
  is_discoverable: z.boolean().optional().describe('是否可发现'),
});

/** 置顶页面请求体 */
export const PinPageBody = z.object({
  pinned: z.boolean().describe('是否置顶'),
});

/** 发布历史查询请求体 */
export const PublishHistoryBody = z.object({
  uid: z.string().min(1).describe('发布页面的唯一标识'),
});

/** 发布版本查询请求体 */
export const PublishVersionBody = z.object({
  uid: z.string().min(1).describe('发布页面的唯一标识'),
  version: z.number().int().min(1).describe('版本号'),
});

/** 创建页面合集请求体 */
export const CreatePageCollectionBody = z.object({
  name: z.string().min(1).max(100).describe('合集名称'),
});

// ============================================
// 响应 schemas
// ============================================

/** 发布页面响应 */
export const PublishPageResponse = z.object({
  success: z.literal(true).describe('发布成功'),
  page_uid: z.string().describe('页面唯一标识符'),
  url: z.string().describe('页面访问 URL'),
  read_url: z.string().describe('阅读模式 URL'),
  updated: z.boolean().describe('是否为更新操作'),
});

/** 发布历史响应 */
export const PublishHistoryResponse = z.object({
  success: z.literal(true).describe('查询成功'),
  page_uid: z.string().describe('页面唯一标识符'),
  current_version: z.number().describe('当前版本号'),
  records: z.array(z.object({
    id: z.string().describe('记录 ID'),
    record_number: z.number().describe('记录序号'),
    version: z.number().describe('版本号'),
    action: z.string().describe('操作类型（publish/rollback）'),
    title: z.string().describe('页面标题'),
    icon: z.unknown().nullable().describe('页面图标'),
    description: z.string().nullable().describe('页面描述'),
    created_at: z.string().describe('创建时间（ISO 字符串）'),
    is_current: z.boolean().describe('是否为当前版本'),
    url: z.string().describe('版本详情页 URL'),
  })).describe('发布记录列表'),
});

/** 回滚发布响应 */
export const PublishRollbackResponse = z.object({
  success: z.literal(true).describe('回滚成功'),
  page_uid: z.string().describe('页面唯一标识符'),
  version: z.number().describe('回滚到的版本号'),
  url: z.string().describe('页面访问 URL'),
});

/** 发布版本详情响应 */
export const PublishVersionResponse = z.object({
  success: z.literal(true).describe('查询成功'),
  page_uid: z.string().describe('页面唯一标识符'),
  version: z.number().describe('版本号'),
  title: z.string().describe('页面标题'),
  icon: z.unknown().nullable().describe('页面图标'),
  description: z.string().nullable().describe('页面描述'),
  html: z.string().describe('HTML 内容'),
  created_at: z.string().describe('创建时间（ISO 字符串）'),
  url: z.string().describe('版本详情页 URL'),
});

/** 置顶页面响应 */
export const PinPageResponse = z.object({
  success: z.literal(true).describe('操作成功'),
  pinned: z.boolean().describe('当前置顶状态'),
});
