# S1: Composer 链接 + 图片插入

## 概述

为动态发布器（`Composer`）添加链接插入和图片插入功能。保持纯 textarea，不引入富文本编辑器。通过小型 Dialog 将链接/图片以纯文本标记格式插入光标位置。

## 当前状态

`components/content/composer.tsx` 中链接和图片按钮只弹出 toast 提示"开发中"，无实际功能。

## 设计

### 前端

#### Composer 修改

- 保持现有 `<textarea>` 不变
- 链接按钮：点击打开 `InsertLinkDialog`
- 图片按钮：点击打开 `InsertImageDialog`
- 新增工具函数 `insertAtCursor(textarea, text)` 处理光标插入

#### InsertLinkDialog

小型弹窗（使用项目已有的 Dialog 组件）：
- URL 输入框（必填）
- 显示文本输入框（选填）
- 确认后：`[显示文本](url)` 或 `[url](url)` 插入 textarea 光标位置
- 取消关闭

#### InsertImageDialog

小型弹窗，两个 Tab：
- **Tab "链接"**：图片 URL 输入框 → `![](url)` 插入光标
- **Tab "上传"**：文件选择器（accept image/*）→ POST `/api/media/upload` → `![](返回url)` 插入光标

#### insertAtCursor 工具函数

```typescript
// lib/utils/textarea.ts
export function insertAtCursor(textarea: HTMLTextAreaElement, text: string): void
```

支持 textarea 的 selectionStart/selectionEnd，替换选区或插入光标位置。

### 后端

#### POST /api/media/upload

- 接收 `multipart/form-data`（字段名 `file`）
- 验证：文件类型（image/png, image/jpeg, image/webp, image/gif），大小限制（10MB）
- 上传到 S3 兼容存储
- 返回：`{ url: "https://..." }`

#### S3 配置

- 复用项目已有的 S3 兼容存储配置（`packages/core` 中）
- 如不存在，在 `apps/web` 中新增 S3 客户端

### bodyFormat

`POST /api/moments` 无需修改。`body` 字段仍为纯文本，链接和图片以 `[text](url)` / `![](url)` 文本形式内联存储。如需渲染时做链接/图片识别，由展示端处理。

## 涉及文件

| 层 | 文件 | 操作 |
|----|------|------|
| UI | `components/content/composer.tsx` | 修改 |
| UI | `components/content/insert-link-dialog.tsx` | 新增 |
| UI | `components/content/insert-image-dialog.tsx` | 新增 |
| Util | `lib/utils/textarea.ts` | 新增 |
| API | `app/api/media/upload/route.ts` | 新增 |
| Config | S3 存储配置 | 修改/新增 |

## 不在范围内

- 不使用 `@uiw/react-md-editor` 或任何富文本编辑器
- 不修改 `bodyFormat` 字段（保持 `plain_text`）
- 不添加 bold / italic / strikethrough 等格式化按钮
- 不在 composer 中渲染 Markdown 预览

## i18n

需要新增的 key（zh-CN）：
- `community.insertLink` — "插入链接"
- `community.linkUrl` — "链接地址"
- `community.linkText` — "显示文本（选填）"
- `community.insertImage` — "插入图片"
- `community.imageUrl` — "图片链接"
- `community.imageUpload` — "上传图片"
