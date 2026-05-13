---
name: create-page
description: "Create Viben workspace pages (static HTML apps, markdown docs, dev server pages, proxy pages). Use when user asks to create a page, build a page, add a new page to the workspace, or mentions 'viben page create'. Triggers: 'create page', 'new page', 'add page', 'build a page', 'make a page', 'viben page'."
---

# Create Page

在 Viben 工作区的 `pages/` 目录下创建新页面。

## 快速流程

1. 确定页面类型和参数
2. 创建目录 `pages/<slug>/`
3. 写入 `SKILL.md` frontmatter
4. 创建入口文件（引入 SDK + tokens）
5. 编写页面内容

## 页面类型

| 类型 | 适用场景 | 关键文件 |
|------|---------|---------|
| `static` | 单文件 HTML 应用（默认） | `index.html` |
| `markdown` | 文档/笔记 | SKILL.md body |
| `server` | 需要 dev server 的项目 | 项目目录 |
| `proxy` | 嵌入外部服务 | 无 |

## 场景决策树

根据用户需求选择对应的 reference 文件：

| 用户需求 | 参考文件 |
|---------|---------|
| 仪表盘、卡片布局、数据展示 | `references/patterns.md` → Dashboard 节 |
| 表单、输入验证、步骤表单 | `references/patterns.md` → Form 节 |
| 产品介绍页、Landing page | `references/patterns.md` → Landing 节 |
| 数据表格、排序筛选 | `references/patterns.md` → Table 节 |
| 色彩、字体、间距问题 | `references/design-system.md` |
| 动画、过渡、加载状态 | `references/interactions.md` |
| 引入第三方库（图表/图标等） | `references/libraries.md` |

## 基础 HTML 模板（Static 类型）

所有静态页面**必须**使用此模板结构：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}}</title>
  <!-- 防 FOUC -->
  <script>
  (function(){
    var t = new URLSearchParams(location.search).get('theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
  })();
  </script>
  <!-- Design Tokens -->
  <link rel="stylesheet" href="/api/page/_sdk/v1/viben-page-tokens.css">
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: auto; }
    body {
      font-family: var(--font-sans);
      background: var(--background);
      color: var(--foreground);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <!-- SDK (placed at end for non-blocking) -->
  <script src="/api/page/_sdk/v1/viben-page-sdk.js"></script>
  <script>
    // App code here
  </script>
</body>
</html>
```

## SKILL.md Frontmatter 格式

### Static（默认）

```yaml
---
page:
  type: static
  file: index.html
  permission: [read, write]
name: "页面名称"
description: "页面描述"
icon:
  type: lucide
  value: app-window
---
```

### Markdown

```yaml
---
page:
  type: markdown
  permission: [read, write]
name: "文档名称"
icon:
  type: lucide
  value: book-open
---
```

### Server

```yaml
---
page:
  type: server
  command: "pnpm dev"
  port: 5173
  ready_pattern: "ready in"
  timeout: 30000
  permission: [read, write]
name: "应用名称"
icon:
  type: lucide
  value: server
---
```

### Proxy

```yaml
---
page:
  type: proxy
  url: "http://localhost:3000"
  permission: [read]
name: "服务名称"
icon:
  type: lucide
  value: monitor
---
```

## CLI 命令

```bash
viben page create <slug> --name "名称" --type static
viben page create <slug> --name "名称" --type markdown
viben page create <slug> --name "名称" --type server --command "pnpm dev" --port 5173
viben page create <slug> --name "名称" --type proxy --url "http://localhost:3000"
```

## 核心规则

1. **必须引入 SDK**：所有 static 页面必须包含 `viben-page-sdk.js` 和 `viben-page-tokens.css`
2. **禁止硬编码颜色**：使用 CSS 变量（`var(--background)` 等），不允许 `#hex` 或 `rgb()`
3. **字体规则**：标题用 `var(--font-serif)`，正文用 `var(--font-sans)`，数值/代码用 `var(--font-mono)`
4. **滚动页面**：使用 `overflow: auto`（不是 `hidden`）
5. **动画尊重**：添加 `@media (prefers-reduced-motion: reduce)` 降级
6. **对比度**：文字与背景最小对比度 4.5:1
7. **禁止 hsl 包裹**：不要写 `hsl(var(--background))`，变量已是 oklch 格式

## 图标参考

常用 lucide 图标：`app-window`、`book-open`、`server`、`monitor`、`phone`、`file-text`、`layout`、`palette`、`globe`、`chart-bar`

也可用 emoji：`icon: { type: emoji, value: "🚀" }`
