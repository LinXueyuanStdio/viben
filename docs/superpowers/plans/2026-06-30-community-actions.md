# 举报 + 反馈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为阅读模式 topbar ReadMoreMenu 的举报和反馈按钮实现完整功能。举报扩展已有 `reports` 表，反馈新建 `feedbacks` 表。两者均关联当前阅读页面。

**Architecture:** 两个独立 Dialog 组件 + 两个 API 路由 + 数据库 schema 修改。举报复用 reports 表，反馈新建表。ReadMoreMenu 需要接收 pageId 来透传给 Dialog。

**Tech Stack:** React, Radix Dialog, Radix Select (for dropdowns), Drizzle ORM, PostgreSQL

## Global Constraints

- 举报和反馈均需登录，未登录时跳转登录页
- 举报关联 `entityType: "published_page"` + entityId
- 反馈包含 category (bug/suggestion/other) + rating (1-5) + content
- 不包含后台管理界面、举报自动处理、反馈回复功能
- `reports` 表新增 `published_page` 到 entity_type enum
- `feedbacks` 表为新建

---

### Task 1: 修改数据库 Schema

**Files:**
- Modify: `apps/web/lib/db/schema.ts`

**Interfaces:**
- Consumes: existing `reports` table definition, `users` table
- Produces: updated `reports` entity_type enum, new `feedbacks` table and relations

- [ ] **Step 1: 修改 reports 表的 entity_type enum**

找到 `reports` 表定义（约第 448 行），将：

```typescript
entityType: text('entity_type', {
  enum: ['mcp', 'skill', 'comment', 'collection', 'user'],
}).notNull(),
```

改为：

```typescript
entityType: text('entity_type', {
  enum: ['mcp', 'skill', 'comment', 'collection', 'user', 'published_page'],
}).notNull(),
```

- [ ] **Step 2: 新增 feedbacks 表**

在 `reports` 表定义之后（约第 486 行 `);` 之后），添加：

```typescript
export const feedbacks = pgTable(
  'feedbacks',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    pageId: text('page_id').notNull(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category', {
      enum: ['bug', 'suggestion', 'other'],
    }).notNull(),
    rating: integer('rating').notNull(), // 1-5
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('feedbacks_page_id_idx').on(table.pageId),
    index('feedbacks_reporter_idx').on(table.reporterId),
  ]
);
```

- [ ] **Step 3: 添加 feedbacks 的 relations**

在文件末尾 relations 定义区域，添加：

```typescript
export const feedbacksRelations = relations(feedbacks, ({ one }) => ({
  reporter: one(users, {
    fields: [feedbacks.reporterId],
    references: [users.id],
  }),
}));
```

- [ ] **Step 4: 运行数据库迁移**

```bash
cd apps/web && pnpm db:push
```

需要手动确认 schema 变更。Expected: 成功添加 `published_page` 到 reports entity_type enum，创建 `feedbacks` 表。

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/db/schema.ts
git commit -m "feat: add published_page to reports enum, add feedbacks table"
```

---

### Task 2: 创建举报 API

**Files:**
- Create: `apps/web/app/api/reports/route.ts`

**Interfaces:**
- Produces: `POST /api/reports` — `{ entity_type, entity_id, reason, description? }` → `{ id, status }`

- [ ] **Step 1: 写入举报 API**

```typescript
// apps/web/app/api/reports/route.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/middleware"
import { db } from "@/lib/db"
import { reports } from "@/lib/db/schema"

const VALID_REASONS = ["spam", "inappropriate", "copyright", "security", "other"]

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
    const { entity_type, entity_id, reason, description } = body

    if (!entity_type || !entity_id) {
      return NextResponse.json({ error: "missing_entity" }, { status: 400 })
    }

    if (!VALID_REASONS.includes(reason)) {
      return NextResponse.json({ error: "invalid_reason" }, { status: 400 })
    }

    const [report] = await db
      .insert(reports)
      .values({
        entityType: entity_type,
        entityId: entity_id,
        reporterId: session.userId,
        reason,
        description: typeof description === "string" ? description.slice(0, 500) : null,
        status: "pending",
      })
      .returning({ id: reports.id, status: reports.status })

    return NextResponse.json({ id: report.id, status: report.status })
  } catch (error) {
    console.error("Report creation failed:", error)
    return NextResponse.json({ error: "report_failed" }, { status: 500 })
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
git add apps/web/app/api/reports/route.ts
git commit -m "feat: add POST /api/reports endpoint"
```

---

### Task 3: 创建反馈 API

**Files:**
- Create: `apps/web/app/api/feedbacks/route.ts`

**Interfaces:**
- Produces: `POST /api/feedbacks` — `{ page_id, category, rating, content }` → `{ id }`

- [ ] **Step 1: 写入反馈 API**

```typescript
// apps/web/app/api/feedbacks/route.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/middleware"
import { db } from "@/lib/db"
import { feedbacks } from "@/lib/db/schema"

const VALID_CATEGORIES = ["bug", "suggestion", "other"]

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
    const { page_id, category, rating, content } = body

    if (!page_id) {
      return NextResponse.json({ error: "missing_page_id" }, { status: 400 })
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "invalid_category" }, { status: 400 })
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "invalid_rating" }, { status: 400 })
    }

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "missing_content" }, { status: 400 })
    }

    const [fb] = await db
      .insert(feedbacks)
      .values({
        pageId: page_id,
        reporterId: session.userId,
        category,
        rating: Math.round(rating),
        content: content.slice(0, 1000),
      })
      .returning({ id: feedbacks.id })

    return NextResponse.json({ id: fb.id })
  } catch (error) {
    console.error("Feedback creation failed:", error)
    return NextResponse.json({ error: "feedback_failed" }, { status: 500 })
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
git add apps/web/app/api/feedbacks/route.ts
git commit -m "feat: add POST /api/feedbacks endpoint"
```

---

### Task 4: 创建 ReportDialog

**Files:**
- Create: `apps/web/components/content/report-dialog.tsx`

**Interfaces:**
- Produces: `export function ReportDialog({ open, onOpenChange, entityType, entityId }: ReportDialogProps)`
- Props: `{ open: boolean; onOpenChange: (open: boolean) => void; entityType: string; entityId: string }`

- [ ] **Step 1: 写入 ReportDialog**

```tsx
// apps/web/components/content/report-dialog.tsx
"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Flag } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const REASONS = [
  { value: "spam", key: "community.reportReasonSpam" },
  { value: "inappropriate", key: "community.reportReasonInappropriate" },
  { value: "copyright", key: "community.reportReasonCopyright" },
  { value: "security", key: "community.reportReasonSecurity" },
  { value: "other", key: "community.reportReasonOther" },
] as const

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: string
  entityId: string
}

export function ReportDialog({ open, onOpenChange, entityType, entityId }: ReportDialogProps) {
  const { t } = useTranslation()
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setReason("")
      setDescription("")
    }
  }, [open])

  const handleSubmit = async () => {
    if (!reason || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          reason,
          description: description.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? t("community.reportFailed"))
      }
      toast.success(t("community.reportSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("community.reportFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-4" />
            {t("community.report")}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t("community.reportReason")}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder={t("community.reportReason")} />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {t(r.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="report-desc">{t("community.reportDescription")}</Label>
            <Textarea
              id="report-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder={t("community.reportDescriptionPlaceholder")}
              className="min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("community.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || submitting}>
            {submitting ? t("community.submitting") : t("community.reportSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
git add apps/web/components/content/report-dialog.tsx
git commit -m "feat: add ReportDialog component"
```

---

### Task 5: 创建 FeedbackDialog

**Files:**
- Create: `apps/web/components/content/feedback-dialog.tsx`

**Interfaces:**
- Produces: `export function FeedbackDialog({ open, onOpenChange, pageId }: FeedbackDialogProps)`
- Props: `{ open: boolean; onOpenChange: (open: boolean) => void; pageId: string }`

- [ ] **Step 1: 写入 FeedbackDialog**

```tsx
// apps/web/components/content/feedback-dialog.tsx
"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { MessageSquare, Star } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  { value: "bug", key: "community.feedbackCategoryBug" },
  { value: "suggestion", key: "community.feedbackCategorySuggestion" },
  { value: "other", key: "community.feedbackCategoryOther" },
] as const

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageId: string
}

export function FeedbackDialog({ open, onOpenChange, pageId }: FeedbackDialogProps) {
  const { t } = useTranslation()
  const [category, setCategory] = useState("")
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setCategory("")
      setRating(0)
      setContent("")
    }
  }, [open])

  const handleSubmit = async () => {
    if (!category || rating === 0 || !content.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          category,
          rating,
          content: content.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? t("community.feedbackFailed"))
      }
      toast.success(t("community.feedbackSuccess"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("community.feedbackFailed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" />
            {t("community.feedback")}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* 分类 */}
          <div className="grid gap-2">
            <Label>{t("community.feedbackCategory")}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t("community.feedbackCategory")} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {t(c.key)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 星级评分 */}
          <div className="grid gap-2">
            <Label>{t("community.feedbackRating")}</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-0.5"
                >
                  <Star
                    className={cn(
                      "size-6 transition-colors",
                      star <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30 hover:text-amber-400/50"
                    )}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* 描述 */}
          <div className="grid gap-2">
            <Label htmlFor="feedback-content">{t("community.feedbackContent")}</Label>
            <Textarea
              id="feedback-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={1000}
              placeholder={t("community.feedbackContentPlaceholder")}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("community.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!category || rating === 0 || !content.trim() || submitting}>
            {submitting ? t("community.submitting") : t("community.feedbackSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
git add apps/web/components/content/feedback-dialog.tsx
git commit -m "feat: add FeedbackDialog component with category, rating, and content"
```

---

### Task 6: 修改 ReadMoreMenu 接入 Dialog

**Files:**
- Modify: `apps/web/components/layout/topbar.tsx`

**Interfaces:**
- Consumes: `ReportDialog`, `FeedbackDialog`
- ReadMoreMenu needs `pageId` — 从当前 URL 路由参数解析

- [ ] **Step 1: 修改 topbar.tsx**

`ReadMoreMenu` 需要获取当前页面的 `entityId`。在 `ReadMoreMenu` 函数体内最上方添加：

```tsx
function ReadMoreMenu() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [feedbackOpen, setFeedbackOpen] = React.useState(false)

  // 从 pathname 解析 pageId：/read/[user_slug]/[page_id]
  const pageId = React.useMemo(() => {
    const parts = pathname.split("/")
    // 例如 pathname = "/read/alice/my-article"
    if (parts[1] === "read" && parts.length >= 4) {
      return parts[3]
    }
    return ""
  }, [pathname])
  // ...
```

然后修改举报按钮（约第 201-206 行）：

```tsx
<button
  onClick={() => {
    setOpen(false)
    setReportOpen(true)
  }}
  className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
>
  <Flag className="h-4 w-4" /> {t("community.report")}
</button>
```

修改反馈按钮（约第 207-212 行）：

```tsx
<button
  onClick={() => {
    setOpen(false)
    setFeedbackOpen(true)
  }}
  className="grid grid-cols-[18px_1fr] items-center gap-2 min-h-[38px] rounded-[9px] px-2.5 text-left font-extrabold text-muted-foreground hover:bg-surface-secondary hover:text-foreground"
>
  <MessageSquare className="h-4 w-4" /> {t("community.feedback")}
</button>
```

在 `</div>` 之前（ReadMoreMenu return 的最外层 div 之后）添加 Dialog：

```tsx
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        entityType="published_page"
        entityId={pageId}
      />
      <FeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        pageId={pageId}
      />
    </div>
  )
}
```

完整修改：需要将 `usePathname` 已经在 topbar.tsx 顶部 import（第 5 行），确保 ReadMoreMenu 中新增：
- `usePathname()` 调用
- `useMemo` 计算 pageId
- `useState` 管理两个 Dialog 的 open 状态
- 两个按钮的 onClick 替换
- 两个 Dialog 组件添加

- [ ] **Step 2: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/topbar.tsx
git commit -m "feat: wire ReportDialog and FeedbackDialog into ReadMoreMenu"
```

---

### Task 7: 添加 i18n keys

**Files:**
- Modify: `apps/web/lib/i18n/locales/zh-CN.json`
- Modify: `apps/web/lib/i18n/locales/en.json`

- [ ] **Step 1: 添加中文翻译**

在 `zh-CN.json` 的 `community` 对象中，替换 `reportFeatureSoon` / `feedbackFeatureSoon`：

```json
"report": "举报",
"reportReason": "举报原因",
"reportDescription": "补充说明（选填）",
"reportDescriptionPlaceholder": "请描述具体问题...",
"reportSubmit": "提交举报",
"reportSuccess": "举报已提交",
"reportFailed": "举报提交失败",
"reportReasonSpam": "垃圾内容",
"reportReasonInappropriate": "不当内容",
"reportReasonCopyright": "版权问题",
"reportReasonSecurity": "安全问题",
"reportReasonOther": "其他",
"feedback": "反馈",
"feedbackCategory": "反馈类型",
"feedbackRating": "评分",
"feedbackContent": "详细描述",
"feedbackContentPlaceholder": "请描述你的建议或遇到的问题...",
"feedbackSubmit": "提交反馈",
"feedbackSuccess": "反馈已提交，感谢！",
"feedbackFailed": "反馈提交失败",
"feedbackCategoryBug": "Bug 反馈",
"feedbackCategorySuggestion": "功能建议",
"feedbackCategoryOther": "其他",
"submitting": "提交中...",
"cancel": "取消"
```

删除：
```json
"reportFeatureSoon": "举报功能即将上线",
"feedbackFeatureSoon": "反馈功能即将上线",
```

- [ ] **Step 2: 添加英文翻译**

```json
"report": "Report",
"reportReason": "Reason",
"reportDescription": "Additional details (optional)",
"reportDescriptionPlaceholder": "Describe the issue...",
"reportSubmit": "Submit Report",
"reportSuccess": "Report submitted",
"reportFailed": "Failed to submit report",
"reportReasonSpam": "Spam",
"reportReasonInappropriate": "Inappropriate Content",
"reportReasonCopyright": "Copyright Violation",
"reportReasonSecurity": "Security Issue",
"reportReasonOther": "Other",
"feedback": "Feedback",
"feedbackCategory": "Category",
"feedbackRating": "Rating",
"feedbackContent": "Description",
"feedbackContentPlaceholder": "Describe your suggestion or issue...",
"feedbackSubmit": "Submit Feedback",
"feedbackSuccess": "Feedback submitted, thank you!",
"feedbackFailed": "Failed to submit feedback",
"feedbackCategoryBug": "Bug Report",
"feedbackCategorySuggestion": "Feature Suggestion",
"feedbackCategoryOther": "Other",
"submitting": "Submitting...",
"cancel": "Cancel"
```

删除：
```json
"reportFeatureSoon": "Report feature coming soon",
"feedbackFeatureSoon": "Feedback feature coming soon",
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/i18n/locales/zh-CN.json apps/web/lib/i18n/locales/en.json
git commit -m "feat: add i18n keys for report and feedback"
```

---

### Task 8: 全流程验证

- [ ] **Step 1: 验证编译**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无错误。

- [ ] **Step 2: 验证数据库迁移**

```bash
cd apps/web && pnpm db:push
```

确认 schema 变更已应用。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: final typecheck fixes for community actions"
```
