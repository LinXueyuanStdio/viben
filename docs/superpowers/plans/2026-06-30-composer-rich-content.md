# Composer 链接 + 图片插入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Composer 动态发布器添加链接和图片插入功能，保持纯 textarea，通过 Dialog 输入 URL/上传文件后以文本标记格式插入光标位置。

**Architecture:** 纯前端 Dialog + textarea 光标操作 + 一个图片上传 API。不引入编辑器库，不修改后端 moment 存储格式。

**Tech Stack:** React, Radix Dialog, Drizzle ORM, S3 兼容存储

## Global Constraints

- 不引入 `@uiw/react-md-editor` 或任何富文本编辑器
- 不修改 `bodyFormat`（保持 `plain_text`）
- 不添加 bold / italic / strikethrough 按钮
- 链接/图片以 `[text](url)` / `![](url)` 纯文本内联存储
- 图片上传到 S3 兼容存储，文件限制 10MB，类型 png/jpeg/webp/gif

---

### Task 1: 创建 insertAtCursor 工具函数

**Files:**
- Create: `apps/web/lib/utils/textarea.ts`

**Interfaces:**
- Produces: `export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void`

- [ ] **Step 1: 写入工具函数**

```typescript
// apps/web/lib/utils/textarea.ts
/**
 * 在 textarea 光标位置插入文本，如果存在选区则替换选区。
 */
export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const before = textarea.value.slice(0, start)
  const after = textarea.value.slice(end)

  textarea.value = before + text + after

  // 恢复焦点并将光标移到插入文本之后
  const newCursor = start + text.length
  textarea.focus()
  textarea.setSelectionRange(newCursor, newCursor)

  // 触发 input 事件以适配 React 受控组件
  const event = new Event("input", { bubbles: true })
  textarea.dispatchEvent(event)
}
```

- [ ] **Step 2: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```
Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/utils/textarea.ts
git commit -m "feat: add insertAtCursor textarea utility"
```

---

### Task 2: 创建 InsertLinkDialog

**Files:**
- Create: `apps/web/components/content/insert-link-dialog.tsx`

**Interfaces:**
- Consumes: `insertAtCursor` from `@/lib/utils/textarea`
- Produces: `export function InsertLinkDialog({ open, onOpenChange, textareaRef }: InsertLinkDialogProps)`
- Props type: `{ open: boolean; onOpenChange: (open: boolean) => void; textareaRef: React.RefObject<HTMLTextAreaElement | null> }`

- [ ] **Step 1: 写入 InsertLinkDialog 组件**

```tsx
// apps/web/components/content/insert-link-dialog.tsx
"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link as LinkIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { insertAtCursor } from "@/lib/utils/textarea"

interface InsertLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

export function InsertLinkDialog({ open, onOpenChange, textareaRef }: InsertLinkDialogProps) {
  const { t } = useTranslation()
  const [url, setUrl] = useState("")
  const [displayText, setDisplayText] = useState("")

  // 每次打开时清空输入
  useEffect(() => {
    if (open) {
      setUrl("")
      setDisplayText("")
    }
  }, [open])

  const handleInsert = () => {
    const ta = textareaRef.current
    if (!ta || !url.trim()) return

    const text = displayText.trim()
      ? `[${displayText.trim()}](${url.trim()})`
      : `[${url.trim()}](${url.trim()})`

    insertAtCursor(ta, text)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="size-4" />
            {t("community.insertLink")}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="link-url">{t("community.linkUrl")}</Label>
            <Input
              id="link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="link-text">{t("community.linkText")}</Label>
            <Input
              id="link-text"
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
              placeholder={t("community.linkTextPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("community.cancel")}
          </Button>
          <Button onClick={handleInsert} disabled={!url.trim()}>
            {t("community.insert")}
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
git add apps/web/components/content/insert-link-dialog.tsx
git commit -m "feat: add InsertLinkDialog component"
```

---

### Task 3: 创建 InsertImageDialog

**Files:**
- Create: `apps/web/components/content/insert-image-dialog.tsx`

**Interfaces:**
- Consumes: `insertAtCursor` from `@/lib/utils/textarea`
- Produces: `export function InsertImageDialog({ open, onOpenChange, textareaRef }: InsertImageDialogProps)`
- Props type: `{ open: boolean; onOpenChange: (open: boolean) => void; textareaRef: React.RefObject<HTMLTextAreaElement | null> }`

- [ ] **Step 1: 写入 InsertImageDialog 组件**

```tsx
// apps/web/components/content/insert-image-dialog.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { Image as ImageIcon, Upload, Link as LinkIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { insertAtCursor } from "@/lib/utils/textarea"

interface InsertImageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

export function InsertImageDialog({ open, onOpenChange, textareaRef }: InsertImageDialogProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<"url" | "upload">("url")
  const [imageUrl, setImageUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setImageUrl("")
      setTab("url")
    }
  }, [open])

  // === URL 插入 ===
  const handleUrlInsert = () => {
    const ta = textareaRef.current
    if (!ta || !imageUrl.trim()) return
    insertAtCursor(ta, `![](${imageUrl.trim()})`)
    onOpenChange(false)
  }

  // === 文件上传 ===
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 客户端验证
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"]
    if (!allowed.includes(file.type)) {
      toast.error(t("community.imageInvalidType"))
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("community.imageTooLarge"))
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/media/upload", { method: "POST", body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? t("community.uploadFailed"))
      }
      const data = await res.json()
      const ta = textareaRef.current
      if (ta) {
        insertAtCursor(ta, `![](${data.url})`)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("community.uploadFailed"))
    } finally {
      setUploading(false)
      // 重置 input 以便重复选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="size-4" />
            {t("community.insertImage")}
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "url" | "upload")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url" className="gap-1.5">
              <LinkIcon className="size-3.5" />
              {t("community.imageUrl")}
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5">
              <Upload className="size-3.5" />
              {t("community.imageUpload")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="image-url">{t("community.imageUrlInput")}</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://...jpg"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("community.cancel")}
              </Button>
              <Button onClick={handleUrlInsert} disabled={!imageUrl.trim()}>
                {t("community.insert")}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="upload" className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label>{t("community.imageUploadLabel")}</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90"
              />
              <p className="text-xs text-muted-foreground">
                {t("community.imageUploadHint")}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("community.cancel")}
              </Button>
              <Button disabled={uploading}>
                {uploading ? t("community.uploading") : t("community.upload")}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
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
git add apps/web/components/content/insert-image-dialog.tsx
git commit -m "feat: add InsertImageDialog component with URL and upload tabs"
```

---

### Task 4: 创建图片上传 API

**Files:**
- Create: `apps/web/app/api/media/upload/route.ts`

**Interfaces:**
- Produces: `POST /api/media/upload` — multipart upload → `{ url: string }`

- [ ] **Step 1: 写入 API 路由**

```typescript
// apps/web/app/api/media/upload/route.ts
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { AuthError, requireAuth } from "@/lib/auth/middleware"

// 允许的图片类型
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request)
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "missing_file" }, { status: 400 })
    }

    // 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "invalid_file_type" }, { status: 400 })
    }

    // 验证文件大小
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "file_too_large" }, { status: 400 })
    }

    // 读取文件内容
    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.type.split("/")[1] || "png"
    const key = `media/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    // 上传到 S3 兼容存储
    // 注意：此处需要根据项目已有的 S3 客户端实现
    // 如果 packages/core 中有 S3 模块，从此处导入
    const url = await uploadToStorage(key, buffer, file.type)

    return NextResponse.json({ url })
  } catch (error) {
    console.error("Media upload failed:", error)
    return NextResponse.json({ error: "upload_failed" }, { status: 500 })
  }
}

/**
 * 上传文件到 S3 兼容存储。
 * 替换此函数体为项目实际的 S3 客户端调用。
 */
async function uploadToStorage(key: string, body: Buffer, contentType: string): Promise<string> {
  // TODO: 替换为项目已有的 S3 客户端
  // 示例：使用 @aws-sdk/client-s3
  // const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3")
  // const client = new S3Client({ ... })
  // await client.send(new PutObjectCommand({ Bucket: "viben", Key: key, Body: body, ContentType: contentType }))
  // return `${endpoint}/${bucket}/${key}`

  throw new Error(
    "S3 storage client not configured. Please implement uploadToStorage() in apps/web/app/api/media/upload/route.ts"
  )
}
```

- [ ] **Step 2: 实现 S3 上传逻辑**

在 `uploadToStorage()` 函数体中，根据项目已有的 S3 客户端（参见 `packages/core` 中的存储模块）实现实际上传。

- [ ] **Step 3: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/media/upload/route.ts
git commit -m "feat: add POST /api/media/upload endpoint"
```

---

### Task 5: 修改 Composer 接入 Dialog

**Files:**
- Modify: `apps/web/components/content/composer.tsx`

**Interfaces:**
- Consumes: `InsertLinkDialog`, `InsertImageDialog`

- [ ] **Step 1: 修改 Composer 组件**

修改 `components/content/composer.tsx`，引入 Dialog 组件并替换 toast 占位：

```tsx
// apps/web/components/content/composer.tsx
// 在文件顶部的 import 区域，添加：
import { useRef, useState, useCallback } from "react"
import { InsertLinkDialog } from "@/components/content/insert-link-dialog"
import { InsertImageDialog } from "@/components/content/insert-image-dialog"

// 在 Composer 函数体内，useState 之后添加：
const textareaRef = useRef<HTMLTextAreaElement>(null)
const [linkDialogOpen, setLinkDialogOpen] = useState(false)
const [imageDialogOpen, setImageDialogOpen] = useState(false)
```

然后修改 textarea 和两个按钮：

```tsx
// 将 <textarea> 改为：
<textarea
  ref={textareaRef}  // ← 新增 ref
  value={text}
  onChange={(e) => setText(e.target.value)}
  placeholder={t('community.postPlaceholder')}
  className="w-full min-h-[78px] rounded-[10px] border border-border bg-background p-3 text-sm resize-y focus:outline-none focus:border-primary placeholder:text-muted-foreground"
/>

// 将链接按钮 onClick 改为：
<button
  type="button"
  onClick={() => setLinkDialogOpen(true)}  // ← 替换 toast
  ...

// 将图片按钮 onClick 改为：
<button
  type="button"
  onClick={() => setImageDialogOpen(true)}  // ← 替换 toast
  ...
```

在 `</div>` (最外层) 之前，添加 Dialog：

```tsx
      {/* 紧接 Composer return 的最外层 </div> 之前 */}
      <InsertLinkDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        textareaRef={textareaRef}
      />
      <InsertImageDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        textareaRef={textareaRef}
      />
    </div>
  )
}
```

完整的 `components/content/composer.tsx` 修改后的关键差异：
1. 第 3 行 import `useRef` 加入 `useState` 的同级
2. 第 4-5 行 import `InsertLinkDialog` 和 `InsertImageDialog`
3. 第 21 行（`useState` 之后）添加 `textareaRef`, `linkDialogOpen`, `imageDialogOpen` 状态
4. 第 61 行 textarea 添加 `ref={textareaRef}`
5. 第 72 行链接按钮 onClick 改为 `() => setLinkDialogOpen(true)`
6. 第 80 行图片按钮 onClick 改为 `() => setImageDialogOpen(true)`
7. 第 91 行之前添加两个 Dialog 组件

- [ ] **Step 2: 验证类型检查**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/content/composer.tsx
git commit -m "feat: wire InsertLinkDialog and InsertImageDialog into Composer"
```

---

### Task 6: 添加 i18n keys

**Files:**
- Modify: `apps/web/lib/i18n/locales/zh-CN.json` (community section)
- Modify: `apps/web/lib/i18n/locales/en.json` (community section)

- [ ] **Step 1: 添加中文翻译 key**

在 `zh-CN.json` 的 `community` 对象中，替换 `linkFeatureSoon` / `imageFeatureSoon` 为实际 key：

```json
"insertLink": "插入链接",
"linkUrl": "链接地址",
"linkText": "显示文本",
"linkTextPlaceholder": "选填，不填则显示链接地址",
"insertImage": "插入图片",
"imageUrl": "图片链接",
"imageUrlInput": "图片 URL",
"imageUpload": "上传图片",
"imageUploadLabel": "选择图片文件",
"imageUploadHint": "支持 PNG、JPEG、WebP、GIF，最大 10MB",
"imageInvalidType": "不支持的图片格式",
"imageTooLarge": "图片大小不能超过 10MB",
"uploadFailed": "上传失败，请重试",
"uploading": "上传中...",
"upload": "上传",
"insert": "插入",
"cancel": "取消"
```

并删除：
```json
"linkFeatureSoon": "链接功能开发中",
"imageFeatureSoon": "图片功能开发中",
```

- [ ] **Step 2: 添加英文翻译 key**

在 `en.json` 的 `community` 对象中添加：

```json
"insertLink": "Insert Link",
"linkUrl": "URL",
"linkText": "Display Text",
"linkTextPlaceholder": "Optional, defaults to URL",
"insertImage": "Insert Image",
"imageUrl": "Image URL",
"imageUrlInput": "Image URL",
"imageUpload": "Upload Image",
"imageUploadLabel": "Choose an image file",
"imageUploadHint": "Supports PNG, JPEG, WebP, GIF, max 10MB",
"imageInvalidType": "Unsupported image format",
"imageTooLarge": "Image must be under 10MB",
"uploadFailed": "Upload failed, please try again",
"uploading": "Uploading...",
"upload": "Upload",
"insert": "Insert",
"cancel": "Cancel"
```

并删除：
```json
"linkFeatureSoon": "Link feature coming soon",
"imageFeatureSoon": "Image feature coming soon",
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/i18n/locales/zh-CN.json apps/web/lib/i18n/locales/en.json
git commit -m "feat: add i18n keys for link and image insertion"
```

---

### Task 7: 全流程验证

- [ ] **Step 1: 验证编译**

```bash
cd apps/web && pnpm typecheck
```

Expected: 无错误。

- [ ] **Step 2: Commit (如有修正)**

```bash
git add -A
git commit -m "chore: typecheck fixes for composer rich content"
```
