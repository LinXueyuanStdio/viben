---
name: create-page
description: "Create Viben workspace pages (static HTML apps, markdown docs, dev server pages, proxy pages). Use when user asks to create a page, build a page, add a new page to the workspace, or mentions 'viben page create'. Triggers: 'create page', 'new page', 'add page', 'build a page', 'make a page', 'viben page'."
---

# Create Page

在 Viben 工作区的 `pages/` 目录下创建新页面。

## 页面类型

| 类型 | 适用场景 | 关键文件 |
|------|---------|---------|
| `static` | 单文件 HTML 应用（默认） | `index.html` |
| `markdown` | 文档/笔记 | SKILL.md body |
| `server` | 需要 dev server 的项目 | 项目目录 |
| `proxy` | 嵌入外部服务 | 无 |

## 创建流程

### 1. 确定参数

- **slug**: 小写+短横线（如 `my-app`）
- **name**: 显示名称
- **type**: 页面类型（默认 static）
- **description**: 可选描述

### 2. 创建目录和 SKILL.md

```bash
mkdir -p pages/<slug>
```

### 3. 按类型生成文件

#### Static 页面（最常用）

创建 `pages/<slug>/SKILL.md`:

```yaml
---
page:
  type: static
  file: index.html
  permission: [read, write]
name: "<名称>"
description: "<描述>"
icon:
  type: lucide
  value: app-window
---

# <名称>

<描述>
```

创建 `pages/<slug>/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><名称></title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif;
      background: #1a1a1a;
      color: #e8e8e8;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // App code here
  </script>
</body>
</html>
```

#### Markdown 页面

只需 `pages/<slug>/SKILL.md`:

```yaml
---
page:
  type: markdown
  permission: [read, write]
name: "<名称>"
description: "<描述>"
icon:
  type: lucide
  value: book-open
---

# <标题>

内容直接用 Markdown 写在这里。
```

#### Server 页面

```yaml
---
page:
  type: server
  command: "pnpm dev"
  port: 5173
  ready_pattern: "ready in"
  timeout: 30000
  permission: [read, write]
name: "<名称>"
description: "<描述>"
icon:
  type: lucide
  value: server
---
```

#### Proxy 页面

```yaml
---
page:
  type: proxy
  url: "http://localhost:3000"
  permission: [read]
name: "<名称>"
description: "<描述>"
icon:
  type: lucide
  value: monitor
---
```

## 或用 CLI

```bash
viben page create <slug> --name "<名称>" --type static
viben page create <slug> --name "<名称>" --type markdown
viben page create <slug> --name "<名称>" --type server --command "pnpm dev" --port 5173
viben page create <slug> --name "<名称>" --type proxy --url "http://localhost:3000"
```

## 图标参考

常用 lucide 图标：`app-window`、`book-open`、`server`、`monitor`、`phone`、`file-text`、`layout`、`palette`、`globe`、`chart-bar`

也可用 emoji：`icon: { type: emoji, value: "🚀" }`

## 最佳实践

1. 静态页面优先用 CDN 引入库，保持单文件可运行
2. 全屏应用设置 `html, body, #root { width: 100%; height: 100%; overflow: hidden; }`
3. 嵌套页面用目录表示：`pages/parent/child/SKILL.md`，slug 为 `parent/child`
4. 资源文件放 `pages/<slug>/_assets/`
