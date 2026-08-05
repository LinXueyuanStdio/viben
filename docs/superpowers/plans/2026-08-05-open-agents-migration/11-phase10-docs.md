# Phase 10 — 文档

**目标**：编写 Assistant 模块的文档，更新 README。

## 需要创建/更新的文件

```
apps/web/docs/assistant/
├── README.md              # 模块总览
├── architecture.md        # Web → Agent → Sandbox 架构说明
├── setup.md               # 本地开发环境配置指南
├── api.md                 # API 路由参考
└── migration.md           # 从 open-agents 移植变更记录

apps/web/README.md         # 追加 assistant 环境变量说明
```

## 实施步骤

- [ ] **Step 1: 创建 docs/assistant/ 目录**

```bash
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/docs/assistant
```

- [ ] **Step 2: 编写 README.md**

`apps/web/docs/assistant/README.md`：

```markdown
# Assistant（助手）模块

Viben Assistant 是基于 [open-agents](https://github.com/vercel-labs/open-agents) 移植的 AI 编码助手模块。

## 功能

- **AI 对话**：与 AI Agent 进行多轮编码对话，Agent 可读写文件、执行 Shell、搜索代码
- **Sandbox 隔离**：每个会话在独立 VM 中运行
- **GitHub 集成**：克隆仓库、提交代码、创建 Pull Request
- **用量统计**：Token 消耗追踪和费用估算

## 页面

| 路由 | 说明 |
|------|------|
| `/assistant` | 会话列表 |
| `/assistant/[sessionId]/[chatId]` | 对话页 |
| `/settings/assistant` | 助手设置 |
| `/settings/usage` | 用量统计 |
| `/settings/subscription` | 订阅管理 |

## 架构

```
Web UI (Next.js) → Agent Runtime → Sandbox VM
                        ↓
                  GitHub API
```

详见 [architecture.md](./architecture.md)
```

- [ ] **Step 3: 编写 architecture.md**

`apps/web/docs/assistant/architecture.md`：

```markdown
# Assistant 架构

## 三层架构

### 1. Web UI 层（`apps/web/`）

- **页面**：`app/(dashboard)/assistant/` — 复用 DashboardShell 布局
- **组件**：`components/assistant/` — 对话、文件树、Diff 等
- **Hooks**：`hooks/assistant/` — 会话、文件、模型等状态管理

### 2. Agent 运行时层（`packages/agent/`）

- System prompt 构建：`system-prompt.ts`
- 工具注册：`tools/`（read/write/bash/glob/grep/fetch/task/todo/skill）
- Skills 系统：`skills/`
- Subagent 调度：`subagents/`

### 3. Sandbox 层（`packages/sandbox/`）

- 统一接口：`interface.ts`
- Vercel Sandbox 实现：`vercel/sandbox.ts`
- Git 操作：`git.ts`

## 数据流

```
用户输入 → POST /api/chat
         → packages/agent 构建 system prompt + tools
         → AI SDK streamText
         → SSE → 前端渲染消息
         → tools 调用 → Sandbox Shell/FS
         → 用量写入 usage_events
```

## 认证

使用 viben cookie-based session（`lib/auth/cookies.ts`），去掉 Better Auth。

## 数据库

11 张表与 viben 社区表共享 PostgreSQL，user_id 统一引用 viben users 表。
```

- [ ] **Step 4: 编写 setup.md**

`apps/web/docs/assistant/setup.md`：

```markdown
# Assistant 本地开发配置

## 前提条件

- Viben 项目已正常启动
- PostgreSQL 数据库已配置

## 环境变量

在 `apps/web/.env` 中追加：

### 必需

\`\`\`env
# GitHub App（用于代码仓库操作）
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
NEXT_PUBLIC_GITHUB_APP_SLUG=
GITHUB_WEBHOOK_SECRET=
NEXT_PUBLIC_GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
\`\`\`

### 可选

\`\`\`env
# Vercel Sandbox（本地开发可暂时不用）
VERCEL_SANDBOX_BASE_SNAPSHOT_ID=

# Redis（Skills 缓存）
REDIS_URL=

# ElevenLabs（语音转录）
ELEVENLABS_API_KEY=
\`\`\`

## 数据库初始化

\`\`\`bash
cd apps/web && pnpm db:push
\`\`\`

## 启动

\`\`\`bash
cd apps/web && pnpm dev
\`\`\`

访问 `http://localhost:3000/assistant`
```

- [ ] **Step 5: 编写 migration.md**

`apps/web/docs/assistant/migration.md`：

```markdown
# 从 open-agents 移植变更记录

## 移植日期

2026-08-05

## 来源

- 源项目：[open-agents](https://github.com/vercel-labs/open-agents)
- 源 commit：（记录移植时的 commit hash）

## 变更概要

| 类别 | 变更 |
|------|------|
| 认证 | Better Auth → viben cookie-based session |
| 数据库 | open-agents 表合并到 viben Postgres，user_id 引用 viben users |
| packages | `@open-agents/*` → `@viben/*` |
| 路由 | sessions → assistant，页面放入 (dashboard) route group |
| 组件 | 放入 components/assistant/，UI 组件复用 viben shadcn |
| 不迁移 | Better Auth、landing page、open-agents users 表 |

## 参考

- 设计文档：`docs/superpowers/specs/2026-08-05-open-agents-migration-design.md`
- 实施计划：`docs/superpowers/plans/2026-08-05-open-agents-migration/`
```

- [ ] **Step 6: 更新 apps/web/README.md**

在 viben 的 `apps/web/README.md` 中追加 assistant 相关环境变量说明。

- [ ] **Step 7: Commit**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben
git add apps/web/docs/assistant/
git add apps/web/README.md
git commit -m "docs: 添加 Assistant 模块文档"
```
