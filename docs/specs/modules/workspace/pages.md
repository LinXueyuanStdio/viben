# Pages - 页面系统

页面是 Viben 工作区中的用户自定义内容单元，支持静态 HTML、Markdown 文档、开发服务器和外部代理四种类型。

## 核心概念

### 存储结构

页面基于文件系统，不使用数据库：

```
<workspace_root>/
  pages/
    <slug>/                 # 每个页面一个目录
      SKILL.md              # YAML frontmatter + Markdown body（页面配置）
      index.html            # 仅 static 类型需要
      _assets/              # 上传的资源文件
    parent/
      child/                # 支持嵌套子页面
        SKILL.md
    .page-order.json        # 拖拽排序数据
```

### 页面类型

| 类型 | 说明 | 额外字段 |
|------|------|----------|
| `static` | 静态 HTML 文件 | `file`（入口文件，默认 `index.html`） |
| `markdown` | 直接渲染 SKILL.md 内容 | 无 |
| `server` | 启动开发服务器 | `command`, `port`, `ready_pattern`, `timeout` |
| `proxy` | 代理外部 URL | `url`, `headers` |

---

## 创建页面

### CLI 命令

```bash
viben page create <slug> --name <name> [options]
```

**参数：**
- `<slug>` — 页面标识符（即目录名，支持 `/` 嵌套）

**选项：**

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-n, --name <name>` | 页面名称（必填） | — |
| `-d, --description <desc>` | 页面描述 | — |
| `-t, --type <type>` | 页面类型 | `static` |
| `--template <id>` | 模板 ID | — |
| `--file <file>` | static 类型入口文件 | `index.html` |
| `--command <cmd>` | server 类型启动命令 | `pnpm dev` |
| `--port <port>` | server 类型端口 | — |
| `--url <url>` | proxy 类型目标 URL（必填） | — |

### Gateway API

```
POST /api/page/create
Body: { workspace_path, slug, name, description?, icon?, type, template_id?, file?, command?, port?, url?, headers? }
```

---

## SKILL.md 格式

每个页面的配置和内容统一存储在 `SKILL.md` 中，使用 YAML frontmatter + Markdown body：

### Static 类型

```yaml
---
page:
  type: static
  file: index.html
  permission: [read, write]
name: "My App"
description: "A static HTML application"
icon:
  type: lucide
  value: app-window
---

# My App

Application description here.
```

### Markdown 类型

```yaml
---
page:
  type: markdown
  permission: [read, write]
name: "Documentation"
description: "Project documentation page"
icon:
  type: lucide
  value: book-open
---

# Documentation

This content is rendered directly as the page body.

## Getting Started

Full markdown support including code blocks, tables, etc.
```

### Server 类型

```yaml
---
page:
  type: server
  command: "pnpm dev"
  port: 3000
  ready_pattern: "ready in"
  timeout: 30000
  permission: [read, write]
name: "Dev Server"
description: "Local development server"
---

# Dev Server

Server page that runs a local dev server and embeds it in an iframe.
```

### Proxy 类型

```yaml
---
page:
  type: proxy
  url: "https://example.com/dashboard"
  permission: [read]
name: "External Dashboard"
description: "Proxied external service"
---

# External Dashboard

Embeds an external URL via proxy.
```

---

## Frontmatter 字段参考

### 公共字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `page.type` | `"static" \| "markdown" \| "server" \| "proxy"` | 是 | 页面类型 |
| `page.permission` | `("read" \| "write")[]` | 是 | 权限列表 |
| `name` | `string` | 是 | 显示名称 |
| `description` | `string` | 否 | 描述 |
| `icon` | `{ type, value }` | 否 | 图标配置 |
| `icon.type` | `"lucide" \| "emoji" \| "image"` | — | 图标类型 |
| `icon.value` | `string` | — | 图标值（如 `file-text`、`📄`、URL） |
| `cover` | `string` | 否 | 封面图 URL |
| `page_width` | `"default" \| "wide" \| "full"` | 否 | 页面宽度 |
| `show_toc` | `boolean` | 否 | 是否显示目录 |

### Static 专有字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page.file` | `string` | `index.html` | HTML 入口文件路径 |

### Server 专有字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page.command` | `string` | — | 启动命令 |
| `page.port` | `number` | — | 服务端口 |
| `page.ready_pattern` | `string` | — | 就绪日志匹配模式 |
| `page.timeout` | `number` | — | 启动超时（ms） |

### Proxy 专有字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page.url` | `string` | — | 目标 URL（必填） |
| `page.headers` | `Record<string, string>` | — | 自定义请求头 |

---

## 模板系统

### 内置模板

| ID | 类型 | 说明 |
|----|------|------|
| `static-html` | static | 简单静态 HTML 页面 |
| `markdown-docs` | markdown | Markdown 文档页面 |

### 使用模板创建

```bash
viben page create my-docs --name "My Docs" --template markdown-docs
```

### 自定义模板

将模板放在 `<workspace>/docs/page-templates/<template-id>/` 下：

```
docs/page-templates/
  my-template/
    template.json          # 模板元数据
    SKILL.md.hbs           # Handlebars 模板
    index.html.hbs         # 其他文件模板（可选）
```

**template.json 格式：**

```json
{
  "name": "My Custom Template",
  "description": "Description of the template",
  "type": "static",
  "default_config": {
    "file": "index.html",
    "permission": ["read", "write"]
  },
  "install_command": "pnpm install"
}
```

**模板变量：** `{{name}}`、`{{slug}}`、`{{description}}`

---

## 其他操作

### 查看页面列表

```bash
viben page list              # 所有页面
viben page list --type markdown  # 按类型过滤
```

### 查看页面详情

```bash
viben page view <slug>
```

### 删除页面

```bash
viben page delete <slug> --force
```

### 排序

通过 API 更新 `.page-order.json`：

```
POST /api/page/reorder
Body: { workspace_path, parent_slug: null, ordered_slugs: ["slug-a", "slug-b"] }
```

`parent_slug` 为 `null` 表示顶层排序。

### 复制页面

```
POST /api/page/duplicate
Body: { workspace_path, slug }
```

自动生成 `<slug>-copy` 并更新名称为 `"<name> (Copy)"`。

### 上传资源

```
POST /api/page/asset/upload
Body: multipart/form-data { workspace_path, slug, file }
```

资源存储在 `pages/<slug>/_assets/` 下，文件名带时间戳前缀。

---

## 常用示例

### 创建一个 React 应用页面

```bash
viben page create my-react-app --name "React App" --type server --command "pnpm dev" --port 5173
```

### 创建文档页面

```bash
viben page create docs/getting-started --name "Getting Started" --type markdown
```

嵌套 slug 会创建 `pages/docs/getting-started/SKILL.md`。

### 创建外部服务代理

```bash
viben page create grafana --name "Grafana Dashboard" --type proxy --url "http://localhost:3000"
```

---

## 架构要点

- **发现机制**：`discoverPages()` 递归扫描 `pages/` 目录下所有 `SKILL.md`，使用 `gray-matter` 解析 frontmatter
- **嵌套页面**：子目录即子页面，slug 用 `/` 分隔（如 `parent/child`）
- **路由**：Desktop App 使用 `/workspace/:workspaceId/page/*` 路由匹配嵌套 slug
- **配置更新**：`updatePageConfig` 仅更新 frontmatter 字段，保留 markdown body；`updatePageContent` 仅更新 body，保留 frontmatter
