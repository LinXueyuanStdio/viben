# 页面编辑器（创建页面）

**日期**: 2026-06-30  
**状态**: 设计中  
**范围**: `apps/web`

## 概述

实现「创建页面」功能：Markdown 编辑器 + 实时 HTML 预览 + 封面选择，通过已有 `POST /api/pages/publish` API 提交页面。

## 架构

```
/pages/new (route)
├── Page (server) — getSession, redirect if !auth
└── PageEditor (client) — 完整编辑器
    ├── 封面上传区域
    ├── 表单：title, uid, description, visibility, tags
    ├── 编辑区：Markdown 左 + 预览右
    └── 发布按钮
```

## 数据流

```
Markdown → marked.parse() → HTML → 预览 iframe srcdoc
封面图片 → POST /api/media/upload → { url, asset_id }
表单 + HTML + cover_asset_id → POST /api/pages/publish → 跳转 /read/[slug]/[uid]
```

## 新增依赖

```bash
cd apps/web && pnpm add marked
```

## 文件变更

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web/app/(dashboard)/pages/new/page.tsx` | 修改 | 替换占位页，渲染 PageEditor |
| `apps/web/components/pages/page-editor.tsx` | 新增 | 核心编辑器客户端组件 |
| `apps/web/app/api/media/upload/route.ts` | 修改 | 增强：创建 media_assets 记录，返回 asset_id |
| `apps/web/lib/i18n/locales/zh-CN.json` | 修改 | pageEditor 相关 key |
| `apps/web/lib/i18n/locales/en.json` | 修改 | pageEditor 相关 key |
| `apps/web/package.json` | 修改 | 添加 marked |

## 组件 Props

### PageEditor

```
无 props — 使用 useRouter 导航
内部状态：
  title: string
  uid: string (从 title 自动生成 slug)
  description: string
  markdown: string
  visibility: 'public' | 'unlisted' | 'private'
  tags: string[]
  coverAssetId: string | null
  coverUrl: string | null
  isSubmitting: boolean
```

## API 增强

### POST /api/media/upload（修改）

上传文件后同时创建 `media_assets` 记录。

返回新增 `asset_id` 字段：

```json
{
  "url": "https://...",
  "asset_id": "uuid-of-media-asset"
}
```

## i18n

```json
// zh-CN
"pageEditor": {
  "title": "创建页面",
  "titleLabel": "标题",
  "titlePlaceholder": "输入页面标题",
  "uidLabel": "页面 ID",
  "uidPlaceholder": "my-awesome-page",
  "descriptionLabel": "描述",
  "descriptionPlaceholder": "简要描述页面内容",
  "visibilityLabel": "可见性",
  "public": "公开",
  "unlisted": "不公开列出",
  "private": "私密",
  "tagsLabel": "标签",
  "tagsPlaceholder": "输入标签，回车添加",
  "coverLabel": "封面图片（可选）",
  "coverHint": "点击或拖拽上传封面",
  "markdownLabel": "Markdown 内容",
  "previewLabel": "预览",
  "publish": "发布页面",
  "publishing": "发布中...",
  "publishSuccess": "页面发布成功！",
  "publishFailed": "发布失败",
  "titleRequired": "请输入标题",
  "uidRequired": "请输入页面 ID",
  "contentRequired": "请输入页面内容"
}
```

```json
// en
"pageEditor": {
  "title": "Create Page",
  "titleLabel": "Title",
  "titlePlaceholder": "Enter page title",
  "uidLabel": "Page ID",
  "uidPlaceholder": "my-awesome-page",
  "descriptionLabel": "Description",
  "descriptionPlaceholder": "Briefly describe the page content",
  "visibilityLabel": "Visibility",
  "public": "Public",
  "unlisted": "Unlisted",
  "private": "Private",
  "tagsLabel": "Tags",
  "tagsPlaceholder": "Enter tags, press Enter to add",
  "coverLabel": "Cover Image (optional)",
  "coverHint": "Click or drag to upload a cover",
  "markdownLabel": "Markdown Content",
  "previewLabel": "Preview",
  "publish": "Publish Page",
  "publishing": "Publishing...",
  "publishSuccess": "Page published successfully!",
  "publishFailed": "Publish failed",
  "titleRequired": "Title is required",
  "uidRequired": "Page ID is required",
  "contentRequired": "Page content is required"
}
```
