import { z } from 'zod';

// ============================================
// 查询参数 & 路径参数
// ============================================

export const NotesListQuery = z.object({
  page_id: z.string().min(1).describe('页面 ID'),
});

export const NoteParams = z.object({
  id: z.string().describe('笔记 ID'),
});

// ============================================
// 请求体
// ============================================

export const NoteCreateBody = z.object({
  page_id: z.string().min(1).describe('页面 ID'),
  content: z.string().min(1).describe('笔记内容（markdown 格式）'),
});

export const NoteUpdateBody = z.object({
  content: z.string().min(1).describe('新的笔记内容（markdown 格式）'),
});

// ============================================
// 响应
// ============================================

export const NoteResponse = z.object({
  uid: z.string().describe('笔记唯一 ID（note_ 前缀）'),
  pageId: z.string().describe('所属页面 ID'),
  authorUserId: z.string().describe('作者用户 ID'),
  content: z.string().describe('笔记内容'),
  contentFormat: z.string().describe('内容格式（markdown）'),
  isPinned: z.boolean().describe('是否置顶'),
  createdAt: z.string().describe('创建时间'),
  updatedAt: z.string().describe('更新时间'),
});

export const NoteListResponse = z.object({
  notes: z.array(NoteResponse).describe('笔记列表'),
});

/** 单条笔记操作响应（note 字段包裹） */
export const NoteWrapperResponse = z.object({
  note: NoteResponse.describe('笔记详情'),
});
