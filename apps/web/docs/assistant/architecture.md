# Assistant 架构

## 三层架构

### 1. Web UI 层（`apps/web/`）

负责用户交互、Session 管理、流式渲染。

| 目录 | 职责 |
|------|------|
| `app/(dashboard)/assistant/` | 页面路由，复用 `DashboardShell` 布局 |
| `components/assistant/` | 对话、文件树、Diff、Git 面板等 UI 组件 |
| `hooks/assistant/` | Session、Chat、File、Model 等状态管理 |
| `lib/chat/` | 对话核心逻辑（流管理、自动 commit、去重） |
| `lib/sandbox/` | Sandbox 生命周期管理 |
| `lib/github/` | GitHub API 客户端、PR、Commit 操作 |
| `lib/usage/` | 用量统计与费用估算 |

### 2. Agent 运行时层（`packages/agent/`）

纯 TypeScript 包，不依赖 UI。负责构建 Agent 的 system prompt、注册工具、调度 subagent。

| 模块 | 职责 |
|------|------|
| `system-prompt.ts` | 构建 Agent 的 system prompt |
| `viben-agent.ts` | 核心 `vibenAgent()` 函数，创建 Viben Agent 实例 |
| `models.ts` | 模型选择与 gateway 配置 |
| `tools/` | 工具定义：read、write、bash、glob、grep、fetch、task、todo、skill、ask-user-question |
| `skills/` | Skill 发现、加载、参数化 |
| `subagents/` | Subagent 注册与调度（design、explore、execute） |
| `usage.ts` | 用量事件收集 |

依赖：`ai` (Vercel AI SDK)、`@ai-sdk/anthropic`、`@ai-sdk/openai`、`zod`

### 3. Sandbox 层（`packages/sandbox/`）

纯 TypeScript 包，定义 Sandbox 统一接口并提供 Vercel 适配实现。

| 模块 | 职责 |
|------|------|
| `interface.ts` | `Sandbox` 接口定义 |
| `factory.ts` | Sandbox 工厂函数 |
| `git.ts` | Git 操作（clone、branch、commit、push） |
| `vercel/` | Vercel Sandbox 实现与配置 |

依赖：`@vercel/sandbox`

### 共享工具层（`packages/shared/`）

| 模块 | 职责 |
|------|------|
| `lib/diff.ts` | Diff 生成与格式化 |
| `lib/tool-state.ts` | Tool call 状态提取与渲染 |
| `lib/paste-blocks.ts` | Paste token 处理 |
| `hooks/` | React hooks（ExpandedView、Reasoning、TodoView） |

## 数据流

```
用户输入 → POST /api/chat
         → packages/agent: buildSystemPrompt + 工具注册
         → AI SDK streamText
         → SSE 流 → 前端渲染消息
         → 工具调用 → Sandbox Shell/FS/Git
         → 用量写入 usage_events 表
         → 自动 commit/PR（可选）
```

## 认证

使用 viben 的 cookie-based session（`lib/auth/cookies.ts`）。

- 服务端：`lib/session/get-server-session.ts` 封装 `getSession()`
- 客户端：`hooks/assistant/use-session.ts` 调用 `/api/users/me`

## 数据库

Assistant 使用 11 张表，与 viben 社区表共享 PostgreSQL。所有 `user_id` 引用 viben `users.id`。

详见设计文档附录 A。
