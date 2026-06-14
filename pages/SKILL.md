# Pages 创建指南

本目录存放工作区中所有用户自定义页面。采用**扁平结构**：每个页面是 `pages/{uid}/` 目录，包含 `SKILL.md` 配置文件和相关资源。

---

## 目录结构

```
pages/
  index.json              # 页面索引（邻接表，管理层级关系）
  0612-my-app/
    SKILL.md              # 页面配置（YAML frontmatter + Markdown body）
    index.html            # static 类型的入口文件
    _assets/              # 上传的资源（图片等）
  0612-docs/
    SKILL.md
  0612-child-page/        # 子页面（层级关系由 index.json 管理）
    SKILL.md
```

### UID 格式

页面 uid 格式为 `mmdd-slug`（如 `0612-my-app`），由系统自动生成：
- `mmdd` - 创建日期（月日）
- `slug` - 用户提供的 slug，或 6 位随机 ID

### index.json 结构

邻接表格式，管理页面的层级关系：

```json
{
  "root": ["0612-my-app", "0612-docs"],
  "0612-my-app": ["0612-child-page"]
}
```

- `root` - 根级页面列表
- `{uid}` - 该页面的子页面列表

---

## 快速开始

### 方式一：CLI 创建

```bash
# 创建静态页面（slug 可选，不提供则自动生成随机 ID）
viben page create my-app --name "My App" --type static

# 创建 Markdown 文档
viben page create docs --name "文档" --type markdown

# 创建开发服务器页面
viben page create dev --name "Dev Server" --type server --command "pnpm dev" --port 5173

# 创建代理页面
viben page create dashboard --name "Dashboard" --type proxy --url "http://localhost:3000"

# 创建子页面
viben page create child --name "Child Page" --type static --parent 0612-my-app
```

### 方式二：手动创建

1. 在 `pages/` 下创建目录：`pages/{uid}/`（如 `pages/0612-my-app/`）
2. 创建 `SKILL.md` 文件（格式见下方）
3. 根据类型添加对应资源文件
4. 在 `index.json` 中添加 uid 到对应父级

---

## SKILL.md 格式

### 新 Frontmatter 结构

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

Markdown 内容（在 skill 视图中展示）。
```

**结构说明：**
- `name`, `description` - 顶层字段
- `metadata.icon` - 图标配置
- `metadata.cover` - 封面
- `metadata.page_width` - 页面宽度
- `metadata.show_toc` - 显示目录
- `metadata.page` - 页面类型配置

---

## 页面类型示例

### Static 类型（默认）

最常用的类型。适合单文件 HTML 应用、React/Vue 单页应用（CDN 引入）。

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

# 页面名称

页面描述内容。
```

对应 `index.html` 示例：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>页面名称</title>
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
    // Your app code here
  </script>
</body>
</html>
```

### Markdown 类型

适合文档、说明、笔记。SKILL.md 的 Markdown body 直接渲染为页面内容。

```yaml
---
name: "Getting Started"
description: "入门文档"
metadata:
  icon:
    type: lucide
    value: book-open
  page:
    type: markdown
    permission: [read, write]
---

# Getting Started

这里的内容会直接渲染为页面。支持完整 Markdown 语法。

## 特性

- 代码块高亮
- 表格
- 链接
```

### Server 类型

适合需要启动开发服务器的项目（Vite、Next.js 等）。

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

# React App

启动后会自动内嵌到 iframe 中展示。
```

### Proxy 类型

适合嵌入已有的外部服务。

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

# Grafana

代理外部 URL 到页面中展示。
```

---

## Frontmatter 字段参考

### 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 是 | 显示名称 |
| `description` | string | 否 | 描述 |

### metadata 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `metadata.icon.type` | `lucide \| emoji \| image` | 图标类型 |
| `metadata.icon.value` | string | 图标值 |
| `metadata.cover` | string | 封面（如 `gradient:sky`） |
| `metadata.page_width` | `default \| wide \| full` | 页面宽度 |
| `metadata.show_toc` | boolean | 显示目录 |

### metadata.page 字段（公共）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `metadata.page.type` | `static \| markdown \| server \| proxy` | 是 | 页面类型 |
| `metadata.page.permission` | `[read] \| [read, write]` | 是 | 权限 |

### Static 专有

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `metadata.page.file` | `index.html` | 入口 HTML 文件 |

### Server 专有

| 字段 | 说明 |
|------|------|
| `metadata.page.command` | 启动命令（如 `pnpm dev`） |
| `metadata.page.port` | 服务端口 |
| `metadata.page.ready_pattern` | 就绪日志匹配（如 `ready in`） |
| `metadata.page.timeout` | 启动超时 ms |

### Proxy 专有

| 字段 | 说明 |
|------|------|
| `metadata.page.url` | 目标 URL（必填） |
| `metadata.page.headers` | 自定义请求头 |

---

## 图标值参考

### Lucide 图标（推荐）

```yaml
metadata:
  icon:
    type: lucide
    value: app-window    # 应用
    value: book-open     # 文档
    value: server        # 服务器
    value: monitor       # 监控
    value: phone         # 手机
    value: file-text     # 文件
    value: layout        # 布局
    value: palette       # 设计
```

### Emoji

```yaml
metadata:
  icon:
    type: emoji
    value: "🚀"
```

---

## 最佳实践

1. **uid 自动生成**：通过 CLI 创建页面，系统自动生成 `mmdd-slug` 格式的 uid
2. **层级管理**：使用 `index.json` 管理页面层级，不再使用目录嵌套
3. **静态页面**：优先使用 CDN 引入库，保持单文件可运行
4. **全屏应用**：设置 `html, body, #root { width: 100%; height: 100%; overflow: hidden; }`
5. **资源文件**：上传到 `_assets/` 目录，通过相对路径引用

---

## Viben Page SDK

Page SDK 允许页面与 Viben Gateway 建立双向通信，注册可被 AI Agent 调用的 actions。

SDK 实现**零配置自举**：加载脚本即自动完成身份生成、持久化、连接认证，页面无需手动管理密钥对。

### 架构概述

```
┌─────────────────────────────────────────┐
│  Page code (你写的)                      │
│  VibenPage.actions.register(...)         │
├─────────────────────────────────────────┤
│  SDK (平台层，自动处理)                   │
│  • 身份管理 (生成/持久化/轮换)            │
│  • 连接管理 (重连/签名/心跳)             │
│  • 返回值自动标准化                      │
│  • 事件广播                              │
└────────────────────┬────────────────────┘
                     │ socket.io (ed25519 认证)
                     ▼
┌────────────────────────────────────────────────────┐
│ Viben Gateway (port 18790)                          │
│  /socket.io/client  → ClientSocketServer            │
│  /api/page/_sdk/v1/viben-page-sdk.js → SDK 脚本     │
└────────────────────────────────────────────────────┘
```

### 快速开始

#### HTML — 一个 `<script>` 即可

```html
<script src="http://localhost:18790/api/page/_sdk/v1/viben-page-sdk.js"
        data-page="my-app"></script>
<script>
  VibenPage.ready.then(() => {
    VibenPage.actions.register("myapp", {
      // 简写：裸函数，action name 即为描述
      getStatus: async () => ({ online: true, users: 42 }),

      // 完整形式：带描述和 inputSchema
      updateConfig: {
        description: "更新配置项",
        inputSchema: {
          type: "object",
          properties: { key: { type: "string" }, value: { type: "string" } },
          required: ["key", "value"]
        },
        execute: async (payload) => {
          const { key, value } = payload;
          // ... 执行更新
          return `已更新 ${key} = ${value}`;
        }
      }
    });
  });
</script>
```

#### React — 一个 hook

```tsx
import { useVibenPage } from "@/app/hooks/use-viben-page";

export function MyActionProvider() {
  const { connected } = useVibenPage("myapp", {
    getStatus: async () => ({ online: true }),
    updateConfig: {
      description: "更新配置项",
      inputSchema: { type: "object", properties: { key: { type: "string" } } },
      execute: async (payload) => `已更新 ${payload.key}`
    }
  });
  return null; // 组件卸载时自动 unregister
}
```

### SDK 加载模式

SDK 根据运行环境自动选择初始化方式（优先级从高到低）：

1. **`window.__VIBEN_CONFIG__`** — 显式配置，SDK 直接使用（适合需要完全控制的场景）
2. **iframe postMessage** — Desktop App 通过 `viben-config` 消息注入配置
3. **Standalone 自举** — SDK 自动生成密钥对并持久化到 localStorage

绝大多数场景使用模式 3（自举），无需任何配置。

### 身份管理

SDK 自动管理身份，优先级：

1. `<script>` 的 `data-client-id` / `data-public-key` / `data-private-key` → 用户显式提供
2. `localStorage` (`viben_identity_{pageUid}`) → 回访用户复用
3. 自动生成新 ed25519 密钥对 → 首次访问

**手动生成身份**（可选，适合服务端预注册场景）：

```javascript
const identity = await VibenPageSDK.generateIdentity("my-page");
// { clientId: "my-page-abc123", publicKey: "...", privateKey: "..." }
```

### SDK API

```typescript
interface VibenPageSDK {
  readonly state: "connecting" | "connected" | "disconnected" | "reconnecting";
  readonly clientId: string;
  readonly gatewayUrl: string;
  readonly pageUid: string;
  readonly theme: "light" | "dark";
  readonly ready: Promise<boolean>;

  onStateChange(fn: (state: string) => void): () => void;
  onThemeChange(fn: (theme: string) => void): () => void;

  actions: {
    register(namespace: string, actions: Record<string, ActionDefinition>): () => void;
    unregister(namespace?: string): void;
    list(): Array<{ namespace: string; name: string; description: string }>;
  };

  static generateIdentity(pageUid?: string): Promise<PageIdentity>;
}

// Action 定义：裸函数 OR 完整对象
type ActionDefinition =
  | ((payload: unknown, context: ExecuteContext) => Promise<unknown>)
  | {
      description: string;
      inputSchema?: Record<string, unknown>;
      execute: (payload: unknown, context: ExecuteContext) => Promise<unknown>;
    };
```

**返回值自动标准化**：`execute` 可返回任意值，SDK 自动转换为 MCP ActionResult 格式：
- `string` → `{ content: [{ type: "text", text }] }`
- `object` → `{ content: [{ type: "text", text: JSON.stringify(obj) }], structuredContent: obj }`
- 已是 ActionResult 格式 → 直接透传

### React Hook: `useVibenPage`

```typescript
import { useVibenPage } from "@/app/hooks/use-viben-page";

const { connected, clientId } = useVibenPage(pageUid, actions?, options?);
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `pageUid` | string | 页面标识，同时作为 action namespace |
| `actions` | `Record<string, ActionDefinition>` | 可选，注册的 actions |
| `options.gatewayUrl` | string | 可选，Gateway URL |
| `options.enabled` | boolean | 可选，默认 true |

Hook 自动处理：SDK 脚本加载 → 等待连接 → register actions → 组件卸载时 unregister。

### 事件

SDK 连接成功后广播 `CustomEvent`，适合非 React 框架集成：

```javascript
window.addEventListener("viben:connected", (event) => {
  const vibenPage = event.detail;
  vibenPage.actions.register("myapp", { ... });
});
```

### 关键注意事项

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| SDK 加载失败 | Gateway 未启动 | 确认 gateway 运行在指定端口 |
| `config_missing` 超时 | iframe 模式下父窗口未发送 postMessage | 检查 Desktop App 版本 |
| Identity 每次刷新变化 | localStorage 被清除 | 检查浏览器隐私设置 |
| Action 未注册 | `register()` 在连接前调用 | 使用 `VibenPage.ready.then()` 或 React hook |
