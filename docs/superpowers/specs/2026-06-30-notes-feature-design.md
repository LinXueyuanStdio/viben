# S3: 阅读页笔记功能

## 概述

为阅读页面右侧抽屉的"笔记"Tab 实现完整功能。笔记为页面级私人笔记，支持 Markdown 格式，每个页面可有多条笔记，仅自己可见。

## 当前状态

`app/(dashboard)/read/[user_slug]/[page_id]/read-page-client.tsx` 中 `notesTab` 显示"笔记功能开发中..."占位文本，新建笔记按钮无实际功能。

## 设计

### 数据库

新增 `notes` 表：
```sql
notes (
  id              text primary key,
  uid             text not null unique,
  page_id         text not null,            -- 关联的 published_page uid
  author_user_id  text not null references users(id),
  content         text not null,
  content_format  text not null default 'markdown',
  is_pinned       boolean default false,
  created_at      timestamp default now(),
  updated_at      timestamp default now()
)

-- 索引
unique index notes_uid_idx on (uid)
index notes_page_author_idx on (page_id, author_user_id, created_at desc)
```

### 前端

#### NotesPanel

替换 `read-page-client.tsx` 中的占位 `notesTab`：

```
┌─────────────────────────────┐
│ 📝 笔记          + 新建笔记  │  ← header
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 笔记内容预览...  2小时前 │ │  ← NoteCard
│ │ ✏️ 编辑  🗑️ 删除       │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ ... 另一条笔记 ...      │ │
│ └─────────────────────────┘ │
│                             │
│ 暂无笔记（空态）             │
└─────────────────────────────┘
```

- 初始加载：GET `/api/notes?page_id=xxx`
- "新建笔记"按钮：展开内联 `NoteComposer`
- 空态："暂无笔记，点击上方按钮创建第一条笔记"

#### NoteComposer

内联编辑器（不弹出 Dialog）：
- textarea（纯文本，不引入编辑器库），支持 Markdown 输入
- 提交按钮 → POST `/api/notes`
- 编辑模式：预填已有内容 → PATCH `/api/notes/[id]`
- 取消按钮（编辑模式）或收起（新建模式）

#### NoteCard

笔记卡片：
- `content` 的 Markdown 渲染（去除 HTML 标签的前 100 字预览）
- 时间戳（相对时间：2小时前，3天前）
- 操作按钮：编辑（展开 NoteComposer 编辑模式）、删除（确认弹窗）

### 后端

#### GET /api/notes?page_id=xxx

- 返回当前用户在此页面的所有笔记
- 按 `created_at desc` 排序
- 需要登录

#### POST /api/notes

- 接收：`{ page_id: string, content: string }`
- `content_format` 固定为 `markdown`
- 返回创建的笔记对象
- 需要登录

#### PATCH /api/notes/[id]

- 接收：`{ content: string }`
- 验证笔记归属（只能编辑自己的笔记）
- 更新 `updated_at`
- 返回更新后的笔记对象

#### DELETE /api/notes/[id]

- 验证笔记归属（只能删除自己的笔记）
- 软删除或硬删除
- 返回 204

### 权限

- 所有笔记接口仅操作当前登录用户自己的笔记
- 笔记完全私人，无公开/分享功能

## 涉及文件

| 层 | 文件 | 操作 |
|----|------|------|
| UI | `app/(dashboard)/read/.../read-page-client.tsx` | 修改（notesTab 替换） |
| UI | `components/content/notes-panel.tsx` | 新增 |
| UI | `components/content/note-composer.tsx` | 新增 |
| UI | `components/content/note-card.tsx` | 新增 |
| DB | `lib/db/schema.ts` | 新增（notes 表） |
| API | `app/api/notes/route.ts` | 新增（GET + POST） |
| API | `app/api/notes/[id]/route.ts` | 新增（PATCH + DELETE） |

## 不在范围内

- 不引入 `@uiw/react-md-editor` 或任何编辑器库（纯 textarea）
- 不支持划选/段落级批注（只有页面级笔记）
- 笔记不公开，不支持分享、评论、点赞
- 不支持图片上传（笔记内只存 Markdown 文本）

## i18n

需要新增的 key（zh-CN）：
- `community.notes` — "笔记"
- `community.newNote` — "新建笔记"
- `community.noNotes` — "暂无笔记"
- `community.noNotesHint` — "点击上方按钮创建第一条笔记"
- `community.noteSave` — "保存"
- `community.noteCancel` — "取消"
- `community.noteEdit` — "编辑"
- `community.noteDelete` — "删除"
- `community.noteDeleteConfirm` — "确定删除这条笔记？"
- `community.noteSaved` — "笔记已保存"
- `community.noteDeleted` — "笔记已删除"
- `community.notePlaceholder` — "写下你的笔记...（支持 Markdown）"
