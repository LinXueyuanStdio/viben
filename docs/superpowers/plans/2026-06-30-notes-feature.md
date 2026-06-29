# 阅读页笔记功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为阅读页面右侧抽屉的"笔记"Tab 实现完整的私人笔记功能。支持 Markdown 格式、多条笔记、CRUD 操作，仅自己可见。

**Architecture:** 新 `notes` 表 + 完整 REST API（GET/POST/PATCH/DELETE）+ 三个前端组件（NotesPanel、NoteComposer、NoteCard）。纯 textarea 输入，不引入编辑器库。

**Tech Stack:** React, Drizzle ORM, PostgreSQL, Next.js API routes

## Global Constraints

- 笔记完全私人，所有 API 仅返回当前用户自己的笔记
- 使用纯 textarea 输入，不引入 `@uiw/react-md-editor` 或任何编辑器库
- 页面级笔记（不支持划选/段落级批注）
- 不支持图片上传（笔记内只存 Markdown 文本）
- `content_format` 固定为 `markdown`

---

### Task 1: 新增 notes 表到数据库 Schema

**Files:**
- Modify: `apps/web/lib/db/schema.ts`

**Interfaces:**
- Produces: `notes` table, `notesRelations`

- [ ] **Step 1: 添加 notes 表定义**

在 schema.ts 末尾（所有现有表定义之后），添加：

```typescript
export const notes = pgTable(
  'notes',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    uid: text('uid').notNull(),
    pageId: text('page_id').notNull(),
    authorUserId: text('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    contentFormat: text('content_format').default('markdown').notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('notes_uid_idx').on(table.uid),
    index('notes_page_author_idx').on(table.pageId, table.authorUserId, table.createdAt.desc()),
  ]
);
```

- [ ] **Step 2: 添加 notes relations**

在 relations 定义区域添加：

```typescript
export const notesRelations = relations(notes, ({ one }) => ({
  author: one(users, {
    fields: [notes.authorUserId],
    references: [users.id],
  }),
}));
```

同时在 `usersRelations` 中添加（如果存在）：

```typescript
notes: many(notes),
```

- [ ] **Step 3: 运行数据库迁移**

```bash
cd apps/web && pnpm db:push
```

手动确认。Expected: 创建 `notes` 表及索引。

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/db/schema.ts
git commit -m "feat: add notes table to schema"
```

---

### Task 2: 创建 Notes API — GET + POST

**Files:**
- Create: `apps/web/app/api/notes/route.ts`

**Interfaces:**
- Produces: `GET /api/notes?page_id=xxx` → `{ notes: Note[] }`
- Produces: `POST /api/notes` with `{ page_id, content }` → `{ note: Note }`

- [ ] **Step 1: 写入 GET + POST 路由**

```typescript
// apps/web/app/api/notes/route.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/middleware"
import { db } from "@/lib/db"
import { notes } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import crypto from "crypto"

// GET /api/notes?page_id=xxx
export async function GET(request: NextRequest) {
  let session
  try {
    session = await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get("page_id")
  if (!pageId) {
    return NextResponse.json({ error: "missing_page_id" }, { status: 400 })
  }

  const results = await db
    .select()
    .from(notes)
    .where(and(
      eq(notes.pageId, pageId),
      eq(notes.authorUserId, session.userId)
    ))
    .orderBy(desc(notes.isPinned), desc(notes.createdAt))

  return NextResponse.json({ notes: results })
}

// POST /api/notes
export async function POST(request: NextRequest) {
  let session
  try {
    session = await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { page_id, content } = body

    if (!page_id) {
      return NextResponse.json({ error: "missing_page_id" }, { status: 400 })
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "missing_content" }, { status: 400 })
    }

    const uid = `note_${crypto.randomUUID().slice(0, 12)}`

    const [note] = await db
      .insert(notes)
      .values({
        uid,
        pageId: page_id,
        authorUserId: session.userId,
        content: content.trim(),
        contentFormat: "markdown",
      })
      .returning()

    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    console.error("Note create failed:", error)
    return NextResponse.json({ error: "create_failed" }, { status: 500 })
  }
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/notes/route.ts
git commit -m "feat: add GET and POST /api/notes endpoints"
```

---

### Task 3: 创建 Notes API — PATCH + DELETE

**Files:**
- Create: `apps/web/app/api/notes/[id]/route.ts`

**Interfaces:**
- Produces: `PATCH /api/notes/[id]` with `{ content }` → `{ note: Note }`
- Produces: `DELETE /api/notes/[id]` → 204

- [ ] **Step 1: 写入 PATCH + DELETE 路由**

```typescript
// apps/web/app/api/notes/[id]/route.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/middleware"
import { db } from "@/lib/db"
import { notes } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

// PATCH /api/notes/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let session
  try {
    session = await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { content } = body

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "missing_content" }, { status: 400 })
    }

    const [updated] = await db
      .update(notes)
      .set({ content: content.trim(), updatedAt: new Date() })
      .where(and(
        eq(notes.id, id),
        eq(notes.authorUserId, session.userId)
      ))
      .returning()

    if (!updated) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    return NextResponse.json({ note: updated })
  } catch (error) {
    console.error("Note update failed:", error)
    return NextResponse.json({ error: "update_failed" }, { status: 500 })
  }
}

// DELETE /api/notes/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let session
  try {
    session = await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const [deleted] = await db
      .delete(notes)
      .where(and(
        eq(notes.id, id),
        eq(notes.authorUserId, session.userId)
      ))
      .returning({ id: notes.id })

    if (!deleted) {
      return NextResponse.json({ error: "not_found" }, { status: 404 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Note delete failed:", error)
    return NextResponse.json({ error: "delete_failed" }, { status: 500 })
  }
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/notes/[id]/route.ts
git commit -m "feat: add PATCH and DELETE /api/notes/[id] endpoints"
```

---

### Task 4: 创建 NoteCard 组件

**Files:**
- Create: `apps/web/components/content/note-card.tsx`

**Interfaces:**
- Produces: `export function NoteCard({ note, onEdit, onDelete }: NoteCardProps)`
- Note type: `{ id: string; content: string; createdAt: string; updatedAt: string }`
- Props: `{ note: Note; onEdit: () => void; onDelete: () => void }`

- [ ] **Step 1: 写入 NoteCard**

```tsx
// apps/web/components/content/note-card.tsx
"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface NoteData {
  id: string
  content: string
  createdAt: string
  updatedAt: string
}

interface NoteCardProps {
  note: NoteData
  onEdit: () => void
  onDelete: () => void
}

function relativeTime(dateStr: string): string {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "刚刚"
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}天前`
  return `${Math.floor(days / 30)}个月前`
}

/** 截取纯文本预览（去除 Markdown 标记） */
function previewMarkdown(md: string, maxLen = 100): string {
  const plain = md
    .replace(/[#*`>\[\]()!_~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return plain.length > maxLen ? plain.slice(0, maxLen) + "..." : plain
}

export function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const { t } = useTranslation()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    onDelete()
    setConfirmDelete(false)
  }

  return (
    <div className="rounded-[10px] border border-border bg-background p-3 grid gap-2">
      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
        {previewMarkdown(note.content)}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">
          {relativeTime(note.createdAt)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-[7px] text-[12px] text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
          >
            <Pencil className="size-3" />
            {t("community.noteEdit")}
          </button>
          <button
            onClick={handleDelete}
            className={cn(
              "inline-flex items-center gap-1 h-7 px-2 rounded-[7px] text-[12px]",
              confirmDelete
                ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                : "text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
            )}
          >
            <Trash2 className="size-3" />
            {confirmDelete ? t("community.noteDeleteConfirm") : t("community.noteDelete")}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/content/note-card.tsx
git commit -m "feat: add NoteCard component"
```

---

### Task 5: 创建 NoteComposer 组件

**Files:**
- Create: `apps/web/components/content/note-composer.tsx`

**Interfaces:**
- Produces: `export function NoteComposer({ pageId, initialContent, noteId, onSave, onCancel }: NoteComposerProps)`
- Props: `{ pageId: string; initialContent?: string; noteId?: string; onSave: () => void; onCancel: () => void }`

- [ ] **Step 1: 写入 NoteComposer**

```tsx
// apps/web/components/content/note-composer.tsx
"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

interface NoteComposerProps {
  pageId: string
  initialContent?: string
  noteId?: string   // 编辑模式时传入
  onSave: () => void
  onCancel: () => void
}

export function NoteComposer({ pageId, initialContent = "", noteId, onSave, onCancel }: NoteComposerProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const isEdit = !!noteId

  const handleSave = async () => {
    if (!content.trim() || saving) return
    setSaving(true)
    try {
      const url = isEdit ? `/api/notes/${noteId}` : "/api/notes"
      const method = isEdit ? "PATCH" : "POST"
      const body = isEdit
        ? JSON.stringify({ content: content.trim() })
        : JSON.stringify({ page_id: pageId, content: content.trim() })

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? t("community.noteSaveFailed"))
      }
      toast.success(t(isEdit ? "community.noteUpdated" : "community.noteSaved"))
      onSave()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("community.noteSaveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid gap-2 rounded-[10px] border border-primary/30 bg-background p-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("community.notePlaceholder")}
        autoFocus
        className="w-full min-h-[100px] rounded-[8px] border border-border bg-background p-2.5 text-sm resize-y focus:outline-none focus:border-primary placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t("community.noteCancel")}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!content.trim() || saving}>
          {saving ? t("community.saving") : t("community.noteSave")}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/content/note-composer.tsx
git commit -m "feat: add NoteComposer component"
```

---

### Task 6: 创建 NotesPanel 组件

**Files:**
- Create: `apps/web/components/content/notes-panel.tsx`

**Interfaces:**
- Consumes: `NoteCard`, `NoteComposer`
- Produces: `export function NotesPanel({ pageId }: { pageId: string })`

- [ ] **Step 1: 写入 NotesPanel**

```tsx
// apps/web/components/content/notes-panel.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { NoteCard } from "@/components/content/note-card"
import { NoteComposer } from "@/components/content/note-composer"

interface NoteData {
  id: string
  uid: string
  pageId: string
  content: string
  contentFormat: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

export function NotesPanel({ pageId }: { pageId: string }) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<NoteData[]>([])
  const [loading, setLoading] = useState(true)
  const [showComposer, setShowComposer] = useState(false)
  const [editingNote, setEditingNote] = useState<NoteData | null>(null)

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/notes?page_id=${encodeURIComponent(pageId)}`)
      if (res.ok) {
        const data = await res.json()
        setNotes(data.notes ?? [])
      }
    } catch (err) {
      console.error("Failed to fetch notes:", err)
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const handleDelete = async (noteId: string) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" })
      if (res.ok || res.status === 204) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId))
      }
    } catch (err) {
      console.error("Failed to delete note:", err)
    }
  }

  const handleSaved = () => {
    setShowComposer(false)
    setEditingNote(null)
    fetchNotes()
  }

  return (
    <div className="grid gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-['Lexend'] text-[17px] font-bold">{t("community.notes")}</h2>
        {!showComposer && !editingNote && (
          <button
            onClick={() => setShowComposer(true)}
            className="inline-flex items-center gap-1 text-[14px] font-bold text-primary hover:underline"
          >
            <Plus className="size-3.5" />
            {t("community.newNote")}
          </button>
        )}
      </div>

      {/* New composer */}
      {showComposer && (
        <NoteComposer
          pageId={pageId}
          onSave={handleSaved}
          onCancel={() => setShowComposer(false)}
        />
      )}

      {/* Note list */}
      {loading ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">
          {t("community.loading")}
        </p>
      ) : notes.length === 0 && !showComposer ? (
        <div className="py-6 text-center">
          <p className="text-[13px] text-muted-foreground">{t("community.noNotes")}</p>
          <p className="mt-1 text-[12px] text-muted-foreground/60">
            {t("community.noNotesHint")}
          </p>
        </div>
      ) : (
        <div className="grid gap-2">
          {notes.map((note) =>
            editingNote?.id === note.id ? (
              <NoteComposer
                key={note.id}
                pageId={pageId}
                noteId={note.id}
                initialContent={note.content}
                onSave={handleSaved}
                onCancel={() => setEditingNote(null)}
              />
            ) : (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => {
                  setShowComposer(false)
                  setEditingNote(note)
                }}
                onDelete={() => handleDelete(note.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/content/notes-panel.tsx
git commit -m "feat: add NotesPanel component"
```

---

### Task 7: 修改 read-page-client 接入 NotesPanel

**Files:**
- Modify: `apps/web/app/(dashboard)/read/[user_slug]/[page_id]/read-page-client.tsx`

**Interfaces:**
- Consumes: `NotesPanel`

- [ ] **Step 1: 替换 notesTab**

在 `read-page-client.tsx` 中：

1. 在 import 区域添加：
```tsx
import { NotesPanel } from "@/components/content/notes-panel"
```

2. 将 `notesTab` 的定义（约第 394-402 行）替换为：

```tsx
const notesTab = <NotesPanel pageId={pageUid} />
```

3. 同时将 ReadDrawer tabs 中笔记的 badge 从硬编码的 `2` 改为动态（可选优化）或保持 `badge: undefined`。

修改后的 tabs 定义：
```tsx
tabs={[
  { value: "details", label: "详情", content: detailsTab },
  { value: "comments", label: "评论", badge: pageCommentCount, content: commentsTab },
  { value: "notes", label: "笔记", content: notesTab },
]}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/read/\[user_slug\]/\[page_id\]/read-page-client.tsx
git commit -m "feat: wire NotesPanel into read page client"
```

---

### Task 8: 添加 i18n keys

**Files:**
- Modify: `apps/web/lib/i18n/locales/zh-CN.json`
- Modify: `apps/web/lib/i18n/locales/en.json`

- [ ] **Step 1: 添加中文翻译**

在 `zh-CN.json` 的 `community` 对象中，替换 `notesFeatureSoon`：

```json
"notes": "笔记",
"newNote": "新建笔记",
"noNotes": "暂无笔记",
"noNotesHint": "点击上方按钮创建第一条笔记",
"noteSave": "保存",
"noteCancel": "取消",
"noteEdit": "编辑",
"noteDelete": "删除",
"noteDeleteConfirm": "确认删除？",
"noteSaved": "笔记已保存",
"noteUpdated": "笔记已更新",
"noteDeleted": "笔记已删除",
"noteSaveFailed": "保存失败，请重试",
"notePlaceholder": "写下你的笔记...（支持 Markdown）",
"saving": "保存中...",
"loading": "加载中..."
```

删除：
```json
"notesFeatureSoon": "笔记功能开发中...",
```

- [ ] **Step 2: 添加英文翻译**

```json
"notes": "Notes",
"newNote": "New Note",
"noNotes": "No notes yet",
"noNotesHint": "Click the button above to create your first note",
"noteSave": "Save",
"noteCancel": "Cancel",
"noteEdit": "Edit",
"noteDelete": "Delete",
"noteDeleteConfirm": "Confirm delete?",
"noteSaved": "Note saved",
"noteUpdated": "Note updated",
"noteDeleted": "Note deleted",
"noteSaveFailed": "Save failed, please try again",
"notePlaceholder": "Write your note... (Markdown supported)",
"saving": "Saving...",
"loading": "Loading..."
```

删除：
```json
"notesFeatureSoon": "Notes feature coming soon...",
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/i18n/locales/zh-CN.json apps/web/lib/i18n/locales/en.json
git commit -m "feat: add i18n keys for notes feature"
```

---

### Task 9: 全流程验证

- [ ] **Step 1: 验证编译**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无错误。

- [ ] **Step 2: 验证数据库迁移**

```bash
cd apps/web && pnpm db:push
```

确认 notes 表创建成功。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: final typecheck fixes for notes feature"
```
