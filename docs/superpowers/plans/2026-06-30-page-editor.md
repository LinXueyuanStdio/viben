# 页面编辑器 实现计划

**Goal:** 实现 Markdown 编辑器 + 实时预览 + 封面选择的页面创建功能。

**Architecture:** 新增 `PageEditor` 客户端组件，使用 `marked` 渲染 Markdown 为 HTML，左右分栏显示编辑/预览，通过 `POST /api/pages/publish` 提交。

**Tech Stack:** Next.js, React, marked, shadcn/ui

## Global Constraints

- 编辑文件时使用绝对路径
- 禁止 `import("path").TypeName` 内联 import type
- 禁止动态 import (`await import()`)
- Tailwind v4：不用 `hsl()` 包裹 oklch CSS 变量
- API 参数使用 snake_case

---

### Task 1: 安装依赖 + i18n

安装 `marked`，添加 pageEditor 翻译键到 zh-CN.json 和 en.json。

### Task 2: 增强 Media Upload API

修改 `/api/media/upload`，上传后写入 `media_assets` 表，返回 `asset_id`。

### Task 3: 创建 PageEditor 组件

新建 `components/pages/page-editor.tsx`，包含封面选择、表单、Markdown 编辑器+预览、发布逻辑。

### Task 4: 更新 /pages/new 路由

替换占位页，渲染 PageEditor。
