---
name: create-page
description: "Use when creating Viben workspace pages, including static HTML apps, markdown docs, dev server pages, proxy pages, subpages, or requests mentioning viben page create."
---

# Create Page

在 Viben 工作区的 `pages/` 目录下创建用户自定义页面。页面采用扁平结构：每个页面都是 `pages/{uid}/` 目录，层级关系只由 `pages/index.json` 管理。

## 快速流程

1. 确定页面类型、名称、slug、父级 uid 和必要参数。
2. 优先使用 CLI：`viben page create [slug] --name "名称" --type <type>`。
3. 如需手动创建，使用 `mmdd-slug` 格式创建 `pages/{uid}/`。
4. 写入新结构 `SKILL.md`：`name`、`description` 顶层，页面配置放在 `metadata.page`。
5. 为 `static`/`server` 类型创建入口或项目文件，为资源创建 `assets/`。
6. 更新 `pages/index.json`，把 uid 加入 `root` 或父页面数组。

## 目录模型

```text
pages/
  index.json
  0612-my-app/
    SKILL.md
    index.html
    assets/
  0612-docs/
    SKILL.md
```

- uid 格式为 `mmdd-slug`，如 `0612-my-app`；不提供 slug 时由系统生成 `mmdd-<random>`。
- 子页面仍是 `pages/{uid}/` 平级目录，不使用嵌套目录。
- `index.json` 使用邻接表：

```json
{
  "root": ["0612-my-app", "0612-docs"],
  "0612-my-app": ["0612-child-page"]
}
```

## 页面类型

| 类型 | 适用场景 | 关键配置 |
|------|---------|---------|
| `static` | 单文件 HTML 应用、CDN React/Vue 应用 | `metadata.page.file` |
| `markdown` | 文档、说明、笔记 | SKILL.md body |
| `server` | 需要启动 Vite/Next.js 等 dev server | `command`、`port` |
| `proxy` | 嵌入已有外部服务 | `url` |

## 场景决策树

根据用户需求选择对应的 reference 文件：

| 用户需求 | 参考文件 |
|---------|---------|
| 仪表盘、卡片布局、数据展示 | `references/patterns.md` -> Dashboard 节 |
| 表单、输入验证、步骤表单 | `references/patterns.md` -> Form 节 |
| 产品介绍页、Landing page | `references/patterns.md` -> Landing 节 |
| 数据表格、排序筛选 | `references/patterns.md` -> Table 节 |
| 色彩、字体、间距问题 | `references/design-system.md` |
| 动画、过渡、加载状态 | `references/interactions.md` |
| 引入第三方库（图表/图标等） | `references/libraries.md` |

## SKILL.md Frontmatter

所有新页面使用以下结构：`name`、`description` 为顶层字段；`icon`、`cover`、`page_width`、`show_toc`、`page` 均放在 `metadata` 下。

```yaml
---
name: "页面名称"
description: "页面描述"
metadata:
  icon:
    type: lucide
    value: app-window
  cover: "gradient:sky"
  page_width: default
  show_toc: false
  page:
    type: static
    file: index.html
    permission: [read, write]
---

# 页面名称

Markdown 内容。
```

### Static

```yaml
---
name: "页面名称"
description: "一个静态页面应用"
metadata:
  icon:
    type: lucide
    value: app-window
  page:
    type: static
    file: index.html
    permission: [read, write]
---
```

### Markdown

```yaml
---
name: "文档名称"
description: "文档描述"
metadata:
  icon:
    type: lucide
    value: book-open
  page_width: default
  show_toc: true
  page:
    type: markdown
    permission: [read, write]
---
```

### Server

```yaml
---
name: "React App"
description: "基于 Vite 的 React 应用"
metadata:
  icon:
    type: lucide
    value: server
  page:
    type: server
    command: "pnpm dev"
    port: 5173
    ready_pattern: "ready in"
    timeout: 30000
    permission: [read, write]
---
```

### Proxy

```yaml
---
name: "Grafana"
description: "监控面板"
metadata:
  icon:
    type: lucide
    value: monitor
  page:
    type: proxy
    url: "http://localhost:3000"
    permission: [read]
---
```

## 字段参考

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 显示名称，必填 |
| `description` | string | 页面描述 |
| `metadata.icon.type` | `lucide \| emoji \| image` | 图标类型 |
| `metadata.icon.value` | string | 图标值 |
| `metadata.cover` | string | 封面，如 `gradient:sky` |
| `metadata.page_width` | `default \| wide \| full` | 页面宽度 |
| `metadata.show_toc` | boolean | Markdown 是否显示目录 |
| `metadata.page.type` | `static \| markdown \| server \| proxy` | 页面类型，必填 |
| `metadata.page.permission` | `[read] \| [read, write]` | 页面权限，必填 |
| `metadata.page.file` | string | static 入口，默认 `index.html` |
| `metadata.page.command` | string | server 启动命令 |
| `metadata.page.port` | number | server 端口 |
| `metadata.page.ready_pattern` | string | server 就绪日志匹配 |
| `metadata.page.timeout` | number | server 启动超时 ms |
| `metadata.page.url` | string | proxy 目标 URL |
| `metadata.page.headers` | object | proxy 自定义请求头 |

## CLI 命令

```bash
viben page create my-app --name "My App" --type static
viben page create docs --name "文档" --type markdown
viben page create dev --name "Dev Server" --type server --command "pnpm dev" --port 5173
viben page create dashboard --name "Dashboard" --type proxy --url "http://localhost:3000"
viben page create child --name "Child Page" --type static --parent 0612-my-app
```

## Static HTML 模板

静态页面通常保持单文件可运行，优先用 CDN 引入库。全屏应用可使用 `overflow: hidden`；需要文档式滚动时改为 `overflow: auto`。

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}}</title>
  <script>
  (function(){
    var t = new URLSearchParams(location.search).get('theme');
    if (t === 'dark') document.documentElement.classList.add('dark');
  })();
  </script>
  <link rel="stylesheet" href="/api/page/_sdk/v1/viben-page-tokens.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #root { width: 100%; height: 100%; overflow: hidden; }
    body {
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      background: var(--background);
      color: var(--foreground);
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="/api/page/_sdk/v1/viben-page-sdk.js"></script>
  <script>
    // App code here
  </script>
</body>
</html>
```

## Viben Page SDK

Page SDK 允许页面与 Viben Gateway 建立双向通信，并注册可被 AI Agent 调用的 actions。加载脚本后会自动处理身份、持久化、连接认证、重连、心跳和返回值标准化。

```html
<script src="http://localhost:18790/api/page/_sdk/v1/viben-page-sdk.js"
        data-page="my-app"></script>
<script>
  VibenPage.ready.then(() => {
    VibenPage.actions.register("myapp", {
      getStatus: async () => ({ online: true, users: 42 }),
      updateConfig: {
        description: "更新配置项",
        inputSchema: {
          type: "object",
          properties: { key: { type: "string" }, value: { type: "string" } },
          required: ["key", "value"]
        },
        execute: async (payload) => `已更新 ${payload.key}`
      }
    });
  });
</script>
```

React 页面使用 `useVibenPage(pageUid, actions?, options?)`，组件卸载时会自动 unregister actions。

## 核心规则

1. 配置必须使用新 frontmatter：页面配置放在 `metadata.page`，不要使用旧的顶层 `page` 或 `icon`。
2. 层级必须写入 `pages/index.json`，不要用目录嵌套表达父子关系。
3. Static 页面入口默认 `index.html`，资源放在页面目录下的 `assets/` 并用相对路径引用。
4. 需要 Viben 通信或 AI actions 时加载 `viben-page-sdk.js`；需要平台主题时加载 `viben-page-tokens.css`。
5. 使用 CSS 变量（`var(--background)` 等），不要硬编码主题色。
6. 不要用 `hsl()` 包裹 oklch 变量；直接使用 `var(--background)` 或 Tailwind 语义类。
7. 字体优先使用 `var(--font-serif)`、`var(--font-sans)`、`var(--font-mono)`。
8. 动画必须支持 `@media (prefers-reduced-motion: reduce)` 降级。

## 图标参考

常用 lucide 图标：`app-window`、`book-open`、`server`、`monitor`、`phone`、`file-text`、`layout`、`palette`、`globe`、`chart-bar`。

Emoji 图标：

```yaml
metadata:
  icon:
    type: emoji
    value: "🚀"
```
