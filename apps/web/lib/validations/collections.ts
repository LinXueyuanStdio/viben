import { z } from 'zod';

// ============================================
// 请求体 / 查询参数 / 路径参数 schemas
// ============================================

export const CollectionsListQuery = z.object({
  mine: z.coerce.boolean().optional().describe('仅查看当前用户的合集'),
});

export const CollectionsParams = z.object({
  id: z.string().describe('合集 ID'),
});

export const CollectionsCreateBody = z.object({
  name: z.string().min(1).max(100).describe('合集名称'),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only')
    .optional()
    .describe('URL 友好标识符，不提供则自动生成'),
  description: z.string().max(500).optional().describe('描述'),
  isPublic: z.boolean().optional().describe('是否公开'),
});

export const CollectionsUpdateBody = z.object({
  name: z.string().min(1).max(100).optional().describe('合集名称'),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only')
    .optional()
    .describe('URL 友好标识符'),
  description: z.string().max(500).optional().describe('描述'),
  isPublic: z.boolean().optional().describe('是否公开'),
});

// ============================================
// 响应 schemas
// ============================================

export const CollectionOwnerResponse = z.object({
  id: z.string().describe('用户 ID'),
  username: z.string().describe('用户名'),
  userSlug: z.string().describe('用户 URL slug'),
  displayName: z.string().describe('显示名称'),
  avatarUrl: z.string().nullable().describe('头像地址'),
});

export const CollectionResponse = z.object({
  id: z.string().describe('合集 ID'),
  name: z.string().describe('合集名称'),
  slug: z.string().describe('合集 URL slug'),
  description: z.string().nullable().describe('描述'),
  ownerId: z.string().describe('所有者 ID'),
  isPublic: z.boolean().describe('是否公开'),
  itemCount: z.number().describe('条目数量'),
  forksCount: z.number().describe('Fork 数量'),
  bookmarksCount: z.number().describe('收藏数量'),
  createdAt: z.string().describe('创建时间'),
  updatedAt: z.string().describe('更新时间'),
  owner: CollectionOwnerResponse.optional().describe('所有者信息'),
});

export const CollectionsListResponse = z.object({
  collections: z.array(CollectionResponse).describe('合集列表'),
});

export const CollectionsCreateResponse = z.object({
  collection: CollectionResponse.describe('创建的合集'),
});

export const CollectionItemResponse = z.object({
  id: z.string().describe('条目 ID'),
  itemId: z.string().describe('关联包 ID'),
  itemType: z.enum(['mcp', 'skill']).describe('包类型'),
  note: z.string().nullable().describe('备注'),
  position: z.number().describe('排序位置'),
  addedAt: z.string().describe('添加时间'),
  package: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    version: z.string(),
  }).optional().describe('关联的包信息'),
});

export const CollectionsDetailResponse = z.object({
  collection: CollectionResponse.describe('合集信息'),
  items: z.array(CollectionItemResponse).describe('合集条目列表'),
});

// ============================================
// 合集条目请求体
// ============================================

export const AddCollectionItemBody = z.object({
  itemId: z.string().uuid().describe('关联包 ID'),
  itemType: z.enum(['mcp', 'skill']).describe('包类型'),
  note: z.string().max(500).optional().describe('备注'),
});

export const BatchDeleteCollectionItemBody = z.object({
  itemIds: z.array(z.string()).describe('要删除的条目 ID 列表'),
});

export const ReorderCollectionItemBody = z.object({
  itemIds: z.array(z.string()).describe('新的排序顺序 ID 列表'),
});

export const MoveCollectionItemBody = z.object({
  itemIds: z.array(z.string()).describe('要移动的条目 ID 列表'),
  targetCollectionId: z.string().describe('目标合集 ID'),
});

export const ReorderByPositionBody = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().describe('条目 ID'),
        position: z.number().int().min(0).describe('新位置（从 0 开始）'),
      }),
    )
    .describe('带有位置的条目列表'),
});

// ============================================
// 合集条目响应
// ============================================

export const AddCollectionItemResponse = z.object({
  success: z.literal(true).describe('操作成功'),
  item: CollectionItemResponse.describe('添加的条目'),
});

// ============================================
// 类型别名
// ============================================

export type CreateCollectionInput = z.infer<typeof CollectionsCreateBody>;
export type UpdateCollectionInput = z.infer<typeof CollectionsUpdateBody>;
