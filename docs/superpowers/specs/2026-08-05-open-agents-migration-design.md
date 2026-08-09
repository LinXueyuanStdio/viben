# open-agents → viben apps/web 移植设计

## 1. 概述

将 [open-agents](https://github.com/vercel-labs/open-agents) 的 **Agent + Sandbox + Chat UI + GitHub 集成 + 用量统计** 全部移植到 viben `apps/web`，作为 **Assistant（助手）** 功能模块。

**策略**：先完整移植（保证能跑），后续再做减法（去掉不需要的 sandbox 类型、多余工具等）。

### 1.1 核心决策

| 决策项 | 结论 |
|--------|------|
| 移植范围 | 完整移植，后续做减法 |
| 认证 | 去掉 Better Auth，统一使用 viben cookie-based session |
| 数据库 | open-agents 表合并到 viben 同一 PostgreSQL，user_id 引用 viben `users` 表 |
| packages | 保留独立 package 结构，放入 viben `packages/` 下，改名 `@viben/*` |
| 路由 | 页面放入 `(dashboard)` route group，复用 `DashboardShell` 布局 |
| API 路径 | 保持 open-agents 原路径不变，与 viben 已有路由无冲突 |

---

## 2. 目标文件树

### 2.1 移植前 viben 结构

```
viben/
├── apps/web/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── settings/
│   │   │   │   ├── profile/
│   │   │   │   ├── account/
│   │   │   │   └── api_keys/
│   │   │   └── ...
│   │   ├── api/
│   │   │   ├── github/          ← viben 已有（connect, import, repos, status, callback）
│   │   │   ├── users/
│   │   │   └── ...
│   │   └── layout.tsx
│   ├── components/
│   │   ├── assistant/           ← 【新增】
│   │   ├── layout/
│   │   ├── ui/                  ← viben 已有 shadcn 组件
│   │   └── ...
│   ├── hooks/
│   │   ├── assistant/           ← 【新增】
│   │   │   └── chat/            ← 【新增】
│   │   └── ...
│   ├── lib/
│   │   ├── db/
│   │   │   └── schema.ts        ← 【修改】追加 open-agents 表
│   │   ├── chat/                ← 【新增】
│   │   ├── sandbox/             ← 【新增】
│   │   ├── git/                 ← 【新增】
│   │   ├── github/              ← 【修改】追加 open-agents 的 GitHub 模块
│   │   ├── session/             ← 【新增】（重写认证）
│   │   ├── usage/               ← 【新增】
│   │   ├── skills/              ← 【新增】
│   │   ├── vercel/              ← 【新增】
│   │   └── ...
│   └── docs/
│       └── assistant/           ← 【新增】
├── packages/
│   ├── agent/                   ← 【新增】从 open-agents 复制
│   ├── sandbox/                 ← 【新增】从 open-agents 复制
│   └── shared/                  ← 【新增】从 open-agents 复制
```

### 2.2 目标页面路由树

```
app/(dashboard)/
├── assistant/                          ← 【新增】
│   ├── page.tsx                        # 会话列表（= open-agents /sessions）
│   └── [sessionId]/
│       ├── page.tsx                    # 重定向到第一个 chat
│       ├── codespace/
│       │   └── page.tsx                # CodeSpace 页
│       └── [chatId]/
│           └── page.tsx                # 核心对话页 ★
├── settings/
│   ├── assistant/
│   │   └── page.tsx                    ← 【新增】助手设置（profile + preferences + models + connections）
│   ├── usage/
│   │   └── page.tsx                    ← 【新增】用量统计
│   └── subscription/
│       └── page.tsx                    ← 【新增】订阅管理
└── (existing routes...)
```

### 2.3 目标 API 路由树

```
app/api/
├── chat/                               ← 【新增】
│   ├── route.ts
│   └── [chatId]/
│       ├── stream/route.ts
│       └── stop/route.ts
├── sessions/                           ← 【新增】
│   ├── route.ts
│   └── [sessionId]/
│       ├── route.ts
│       ├── chats/
│       │   ├── route.ts
│       │   └── [chatId]/
│       │       ├── route.ts
│       │       ├── messages/
│       │       │   ├── route.ts
│       │       │   └── [messageId]/route.ts
│       │       ├── read/route.ts
│       │       ├── share/route.ts
│       │       └── fork/route.ts
│       ├── diff/
│       │   ├── route.ts
│       │   ├── patch/route.ts
│       │   └── cached/route.ts
│       ├── files/
│       │   ├── route.ts
│       │   └── content/route.ts
│       ├── skills/route.ts
│       ├── code-editor/route.ts
│       ├── dev-server/route.ts
│       ├── share/route.ts
│       ├── generate-commit-message/route.ts
│       └── checks/fix/route.ts
├── models/route.ts                     ← 【新增】
├── settings/
│   ├── preferences/route.ts            ← 【新增】
│   └── model-variants/route.ts         ← 【新增】
├── usage/
│   ├── route.ts                        ← 【新增】
│   └── rank/route.ts                   ← 【新增】
├── github/                             ← 【追加子路由，不改现有】
│   ├── (existing viben routes...)      # connect, import, repos, status, callback
│   ├── app/
│   │   ├── callback/route.ts           ← 【新增】
│   │   └── install/route.ts            ← 【新增】
│   ├── branches/route.ts               ← 【新增】
│   ├── connection-status/route.ts      ← 【新增】
│   ├── create-repo/route.ts            ← 【新增】
│   ├── installations/
│   │   ├── route.ts                    ← 【新增】
│   │   └── repos/route.ts              ← 【新增】
│   ├── orgs/
│   │   ├── route.ts                    ← 【新增】
│   │   └── install-status/route.ts     ← 【新增】
│   ├── post-link/route.ts              ← 【新增】
│   ├── user/route.ts                   ← 【新增】
│   └── webhook/route.ts                ← 【新增】
├── sandbox/                            ← 【新增】
│   ├── route.ts
│   ├── activity/route.ts
│   ├── extend/route.ts
│   ├── reconnect/route.ts
│   ├── snapshot/route.ts
│   └── status/route.ts
├── generate-pr/route.ts                ← 【新增】
├── generate-title/route.ts             ← 【新增】
├── transcribe/route.ts                 ← 【新增】
├── shared/
│   └── [shareId]/
│       ├── status/route.ts             ← 【新增】
│       └── markdown/route.ts           ← 【新增】
└── vercel/                             ← 【新增】
    ├── projects/[idOrName]/env/route.ts
    └── repo-projects/route.ts
```

---

## 3. 文件分类总表

### 3.1 直接复制（不改代码，只改 import 路径）

这些文件从 open-agents 复制到 viben 后，**只需要全局替换 package 引用**（`@open-agents/*` → `@viben/*`），逻辑不动。

#### packages — 完整复制

| 源路径（open-agents） | 目标路径（viben） | 文件数 |
|---|---|---|
| `packages/agent/**` | `packages/agent/**` | ~35 |
| `packages/sandbox/**` | `packages/sandbox/**` | ~10 |
| `packages/shared/**` | `packages/shared/**` | ~10 |

#### lib 模块 — 直接复制

| 源路径 | 目标路径 | 文件数 |
|---|---|---|
| `apps/web/lib/chat/` | `apps/web/lib/chat/` | 8 |
| `apps/web/lib/git/` | `apps/web/lib/git/` | 5 |
| `apps/web/lib/skills/` | `apps/web/lib/skills/` | 6 |
| `apps/web/lib/usage/` | `apps/web/lib/usage/` | 7 |
| `apps/web/lib/vercel/` | `apps/web/lib/vercel/` | 4 |
| `apps/web/lib/sandbox/` | `apps/web/lib/sandbox/` | 11 |
| `apps/web/lib/diff/` | `apps/web/lib/diff/` | 4 |

#### 根目录 lib 文件 — 直接复制

| 源文件 | 目标文件 |
|---|---|
| `lib/models.ts` + `lib/models.test.ts` | 同路径 |
| `lib/models-with-context.ts` | 同路径 |
| `lib/model-variants.ts` + test | 同路径 |
| `lib/model-options.ts` + test | 同路径 |
| `lib/model-access.ts` + test | 同路径 |
| `lib/model-availability.ts` + test | 同路径 |
| `lib/swr.ts` + test | 同路径 |
| `lib/redis.ts` + test | 同路径 |
| `lib/rate-limit.ts` + test | 同路径 |
| `lib/botid.ts` | 同路径 |
| `lib/file-suggestions.ts` | 同路径 |
| `lib/image-utils.ts` | 同路径 |
| `lib/format-relative-time.ts` | 同路径 |
| `lib/streamdown-config.tsx` + test | 同路径 |
| `lib/diffs-config.ts` | 同路径 |
| `lib/assistant-file-links.ts` + test | 同路径 |
| `lib/chat-auto-commit.ts` + test | 同路径 |
| `lib/chat-instance-manager.ts` | 同路径 |
| `lib/chat-streaming-state.ts` + test | 同路径 |
| `lib/chat-route-cleanup.ts` + test | 同路径 |
| `lib/abortable-chat-transport.ts` | 同路径 |
| `lib/merge-readiness-polling.ts` + test | 同路径 |
| `lib/pr-deployment-polling.ts` + test | 同路径 |
| `lib/workspace-status-store.ts` + test | 同路径 |
| `lib/skills-cache.ts` + test | 同路径 |
| `lib/vercel-themes.ts` | 同路径 |
| `lib/redirect-safety.ts` | 同路径 |
| `lib/text-attachment-utils.ts` | 同路径 |
| `lib/random-city.ts` + test | 同路径 |
| `lib/onboarding.ts` | 同路径 |
| `lib/managed-template-trial.ts` | 同路径 |

#### 组件 — 直接复制

| 源路径 | 目标路径 | 文件数 |
|---|---|---|
| `components/assistant-message-groups.tsx` | `components/assistant/` | ~40 |
| `components/thinking-block.tsx` | ↑ | |
| `components/message-model-pill.tsx` | ↑ | |
| `components/session-list.tsx` | ↑ | |
| `components/session-drawer.tsx` | ↑ | |
| `components/session-starter.tsx` | ↑ | |
| `components/session-starter-vercel-sync-section.tsx` | ↑ | |
| `components/new-session-dialog.tsx` | ↑ | |
| `components/inbox-sidebar.tsx` | ↑ | |
| `components/inbox-sidebar-rename.tsx` + test | ↑ | |
| `components/inbox-sidebar-rename-dialog.tsx` | ↑ | |
| `components/chat-switcher-dropdown.tsx` | ↑ | |
| `components/file-tree.tsx` | ↑ | |
| `components/workspace-file-viewer.tsx` | ↑ | |
| `components/diff-viewer.tsx` | ↑ | |
| `components/download-diff-dialog.tsx` | ↑ | |
| `components/repo-selector.tsx` | ↑ | |
| `components/repo-selector-compact.tsx` | ↑ | |
| `components/repo-selection-screen.tsx` | ↑ | |
| `components/branch-selector.tsx` | ↑ | |
| `components/branch-selector-compact.tsx` | ↑ | |
| `components/branch-picker-dialog.tsx` | ↑ | |
| `components/create-repo-dialog.tsx` | ↑ | |
| `components/github-reconnect-dialog.tsx` | ↑ | |
| `components/github-reconnect-gate.tsx` | ↑ | |
| `components/selection-popover.tsx` | ↑ | |
| `components/model-combobox.tsx` | ↑ | |
| `components/model-selector-compact.tsx` | ↑ | |
| `components/slash-command-dropdown.tsx` | ↑ | |
| `components/file-suggestions-dropdown.tsx` | ↑ | |
| `components/inline-question-input.tsx` | ↑ | |
| `components/text-attachments-preview.tsx` | ↑ | |
| `components/image-attachments-preview.tsx` | ↑ | |
| `components/snippet-chip.tsx` | ↑ | |
| `components/file-type-icons.tsx` | ↑ | |
| `components/provider-icons.tsx` | ↑ | |
| `components/contribution-chart.tsx` | ↑ | |
| `components/home-skeleton.tsx` | ↑ | |
| `components/diffs-provider.tsx` | ↑ | |
| `components/tool-call/**` | `components/assistant/tool-call/` | |
| `components/task-group-view.tsx` | `components/assistant/` | |
| `components/tool-calls-summary-bar.tsx` | ↑ | |
| `components/pinned-todo-panel.tsx` + test | ↑ | |
| `components/sandbox-selector-compact.tsx` | ↑ | |

#### Chat 页组件 — 直接复制

| 源路径 | 目标路径 |
|---|---|
| `app/sessions/[sessionId]/chats/[chatId]/chat-sidebar.tsx` | `components/assistant/` |
| `app/sessions/[sessionId]/chats/[chatId]/chat-tabs.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/code-editor-menu-items.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/commit-action-button.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/dev-server-menu-items.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/diff-tab-view.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/file-tab-view.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/git-panel.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/git-panel-context.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/commit-dialog.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/create-pr-dialog.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/close-pr-dialog.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/merge-pr-dialog.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/merge-pr-dialog-actions.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/merge-check-runs.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/sandbox-create-error-banner.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/session-header.tsx` | ↑ |
| `app/sessions/[sessionId]/chats/[chatId]/sandbox-create.ts` | `lib/sandbox/` |
| `app/sessions/[sessionId]/chats/[chatId]/stream-recovery-policy.ts` + test | `lib/` |
| `app/sessions/[sessionId]/chats/[chatId]/only-chat-in-session.ts` | `lib/` |

#### Hooks — 直接复制

| 源文件 | 目标文件 |
|---|---|
| `hooks/use-sessions.ts` | `hooks/assistant/` |
| `hooks/use-session-chats.ts` + test | ↑ |
| `hooks/use-session-files.ts` | ↑ |
| `hooks/use-session-diff.ts` | ↑ |
| `hooks/use-session-git-status.ts` | ↑ |
| `hooks/use-session-skills.ts` | ↑ |
| `hooks/use-model-options.ts` | ↑ |
| `hooks/use-user-preferences.ts` | ↑ |
| `hooks/use-audio-recording.ts` | ↑ |
| `hooks/use-slash-commands.ts` | ↑ |
| `hooks/use-file-suggestions.ts` | ↑ |
| `hooks/use-text-attachments.ts` | ↑ |
| `hooks/use-image-attachments.ts` | ↑ |
| `hooks/use-github-connection-status.ts` | ↑ |
| `hooks/use-installation-repos.ts` | ↑ |
| `hooks/use-vercel-repo-projects.ts` | ↑ |
| `hooks/use-leaderboard-rank.ts` | ↑ |
| `hooks/use-scroll-to-bottom.ts` | ↑ |
| `hooks/use-background-chat-notifications.tsx` + test | ↑ |
| `hooks/use-session-chat-runtime.ts` | `hooks/assistant/chat/` |
| `hooks/use-stream-recovery.ts` | ↑ |
| `hooks/use-code-editor.ts` | ↑ |
| `hooks/use-dev-server.ts` | ↑ |
| `hooks/use-auto-commit-status.ts` | ↑ |

#### API Routes — 直接复制

| 源路径 | 目标路径 | 文件数 |
|---|---|---|
| `app/api/chat/**` | `app/api/chat/**` | 4 |
| `app/api/sessions/**` | `app/api/sessions/**` | ~30 |
| `app/api/models/**` | `app/api/models/**` | 2 |
| `app/api/settings/**` | `app/api/settings/**` | 4 |
| `app/api/usage/**` | `app/api/usage/**` | 2 |
| `app/api/github/app/**` | `app/api/github/app/**` | 4 |
| `app/api/github/branches/` | `app/api/github/branches/` | 1 |
| `app/api/github/connection-status/` | `app/api/github/connection-status/` | 2 |
| `app/api/github/create-repo/` | `app/api/github/create-repo/` | 2 |
| `app/api/github/installations/` | `app/api/github/installations/` | 2 |
| `app/api/github/orgs/` | `app/api/github/orgs/` | 2 |
| `app/api/github/post-link/` | `app/api/github/post-link/` | 1 |
| `app/api/github/user/` | `app/api/github/user/` | 1 |
| `app/api/github/webhook/` | `app/api/github/webhook/` | 1 |
| `app/api/sandbox/**` | `app/api/sandbox/**` | 8 |
| `app/api/generate-*/` | `app/api/generate-*/` | 3 |
| `app/api/transcribe/` | `app/api/transcribe/` | 1 |
| `app/api/shared/**` | `app/api/shared/**` | 4 |
| `app/api/vercel/**` | `app/api/vercel/**` | 4 |

---

### 3.2 需要修改的文件（复制后改动逻辑）

| 类别 | 文件 | 具体改动 |
|------|------|----------|
| **包配置** | `packages/*/package.json` | `"name"` 改为 `@viben/*`；`@open-agents/*` 依赖改为 `@viben/*` |
| **包配置** | `packages/*/tsconfig.json` | extends 路径改为 viben tsconfig |
| **包配置** | `apps/web/package.json` | 新增依赖 `@viben/agent`、`@viben/sandbox`、`@viben/shared` 及所有新三方包 |
| **Schema** | `lib/db/schema.ts` | 追加全部 open-agents 表定义（见第 4 节），`user_id` 引用 viben `users.id` |
| **DB 操作** | `lib/db/sessions.ts` | `user_id` 引用改为 viben users 表 |
| **DB 操作** | `lib/db/users.ts` | **完全重写**为查 viben users 表 |
| **DB 操作** | `lib/db/user-preferences.ts` | `user_id` 引用改为 viben users |
| **DB 操作** | `lib/db/usage.ts` | `user_id` 引用改为 viben users |
| **DB 操作** | `lib/db/client.ts` | 检查与 viben drizzle client 兼容性，合并 |
| **Session** | `lib/session/get-server-session.ts` | **完全重写**：`getServerSession` → viben `getSession()` |
| **Session** | `lib/session/server.ts` | **改写**：去掉 Better Auth 依赖 |
| **Session** | `lib/session/types.ts` | 类型适配 viben session 格式 |
| **Auth** | `hooks/assistant/use-session.ts` | **完全重写**：从 Better Auth 改为调 `/api/users/me` + SWR |
| **页面** | `app/(dashboard)/assistant/**` | 新建页面文件，组合已有组件 |
| **页面** | `app/(dashboard)/settings/assistant/page.tsx` | 新建，合并 profile + preferences + models + connections |
| **页面** | `app/(dashboard)/settings/usage/page.tsx` | 新建 |
| **页面** | `app/(dashboard)/settings/subscription/page.tsx` | 新建 |
| **页面** | `app/(dashboard)/assistant/[sessionId]/[chatId]/page.tsx` | 从 open-agents chat page 改写，去掉独立 layout |
| **全局** | 所有 `.ts` / `.tsx` 文件 | `@open-agents/agent` → `@viben/agent` |
| **全局** | 所有 `.ts` / `.tsx` 文件 | `@open-agents/sandbox` → `@viben/sandbox` |
| **全局** | 所有 `.ts` / `.tsx` 文件 | `@open-agents/shared` → `@viben/shared` |
| **全局** | 所有使用 `getServerSession` 的文件 | 改为 viben `getSession` + 字段映射 |
| **全局** | 所有使用 `signOut` 的文件 | 改为 viben 登出方法 |
| **全局** | 所有使用 `useSession` 的文件 | 改为 viben 版本 hook |
| **设置** | `app/settings/layout.tsx` | **改写**：去掉独立 sidebar，复用 viben dashboard layout |
| **登录** | `components/auth/auth-guard.tsx` | **改写**：去掉 Better Auth，对接 viben 认证守护 |

---

### 3.3 不迁移的文件

| 源文件/目录 | 原因 |
|---|---|
| `lib/auth/config.ts` | Better Auth 配置 |
| `lib/auth/client.ts` | Better Auth 客户端 |
| `lib/auth/actions.ts` | Better Auth actions |
| `lib/auth/username.ts` + test | viben 已有用户名体系 |
| `app/api/auth/[...all]/` | Better Auth catch-all API |
| `app/api/auth/info/` | Better Auth session info（用 `/api/users/me` 替代） |
| `components/auth/` | Better Auth UI 组件 |
| `components/landing/` | viben 有自己首页 |
| `components/ui/*`（27个shadcn组件） | viben 已有同名组件 |
| `lib/deployment/resource-profile.ts` | Hobby/Standard profile，暂不需要 |
| `hooks/use-mobile.ts` | viben 已有 |
| `packages/tsconfig/` | 不迁移整包，用 viben tsconfig 替代 |
| `lib/diff/compute-diff.ts` + test | 用 `@viben/shared` 的 diff |
| `lib/diff/download-diff.ts` + test | 不需要 |

---

## 4. 数据库 Schema 详细设计

### 4.1 新增表总览

| 表名 | 用途 | user_id 外键 | 行数预估 |
|------|------|-------------|----------|
| `sessions` | 助手会话（一次对话任务） | → users.id | 千级 |
| `chats` | 会话中的对话 | → sessions.id | 万级 |
| `chat_messages` | 对话消息（含 parts JSON） | → chats.id | 十万级 |
| `chat_reads` | 已读状态 | → users.id + chats.id | 万级 |
| `shares` | 分享链接（1 chat : 1 share） | → chats.id | 百级 |
| `workflow_runs` | Workflow 运行记录 | → users.id + sessions.id + chats.id | 万级 |
| `workflow_run_steps` | Workflow 步骤详情 | → workflow_runs.id | 十万级 |
| `user_preferences` | 助手偏好设置 | → users.id (unique) | 等于用户数 |
| `usage_events` | 用量事件（只追加） | → users.id | 百万级 |
| `github_installations` | GitHub App 安装记录 | → users.id | 百级 |
| `vercel_project_links` | Vercel 项目关联 | → users.id (composite PK) | 百级 |

### 4.2 与 viben 现有表的关系

```
viben users
  ├── sessions (user_id)
  │     ├── chats (session_id)
  │     │     ├── chat_messages (chat_id)
  │     │     ├── chat_reads (chat_id, user_id)
  │     │     ├── shares (chat_id)
  │     │     └── workflow_runs (chat_id, session_id, user_id)
  │     │           └── workflow_run_steps (workflow_run_id)
  │     └── (sandbox 生命周期字段在 sessions 表内)
  ├── user_preferences (user_id, unique)
  ├── usage_events (user_id)
  ├── github_installations (user_id)
  └── vercel_project_links (user_id, repo_owner, repo_name)
```

### 4.3 表字段详见附录 A

---

## 5. 功能验收清单

移植完成后，以下功能必须可用：

### 5.1 对话功能（`/assistant`）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| ✅ 会话列表 | 查看所有对话会话，显示标题、状态、时间 | P0 |
| ✅ 创建会话 | 选择仓库/分支，创建新对话会话 | P0 |
| ✅ 发送消息 | 在对话中输入文字，发送给 Agent | P0 |
| ✅ 流式响应 | 实时接收 Agent 的 SSE 流式输出 | P0 |
| ✅ 停止生成 | 中途停止 Agent 执行 | P0 |
| ✅ 消息历史 | 查看对话中的所有消息（user + assistant） | P0 |
| ✅ 对话切换 | 在多个对话之间切换 | P0 |
| ✅ Thinking 展示 | 折叠/展开 Agent reasoning 内容 | P1 |
| ✅ Tool calls 展示 | 查看 Agent 调用的工具及结果 | P1 |
| ✅ Todo 面板 | 查看 Agent 的 Todo 列表 | P1 |
| ✅ 文件树 | 浏览工作区文件结构 | P1 |
| ✅ 文件查看 | 点击文件查看内容 | P1 |
| ✅ Diff 查看 | 查看代码变更（unified/split 模式） | P1 |
| ✅ Git 面板 | 查看 changed files、commit、push | P1 |
| ✅ 创建 PR | 在 GitHub 上创建 Pull Request | P1 |
| ✅ 分享对话 | 生成只读分享链接 | P2 |
| ✅ 分叉对话 | 从某条消息处 fork 新对话 | P2 |
| ✅ 语音输入 | 通过 ElevenLabs 语音转录输入 | P2 |
| ✅ Slash 命令 | `/` 触发文件/命令建议 | P2 |
| ✅ 图片附件 | 上传图片作为对话输入 | P2 |

### 5.2 设置功能（`/settings/assistant`）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| ✅ Profile 信息 | 显示头像、用户名、用量概览 | P0 |
| ✅ 模型选择 | 选择默认主模型和 subagent 模型 | P0 |
| ✅ 模型变体 | 配置模型变体（如启用/禁用特定模型） | P1 |
| ✅ Diff 偏好 | 选择默认 diff 模式（unified/split） | P1 |
| ✅ 自动 Commit | 开启/关闭 Agent 完成后自动 commit | P1 |
| ✅ 自动 PR | 开启/关闭自动创建 PR | P1 |
| ✅ 通知偏好 | 开启/关闭后台通知和声音 | P2 |
| ✅ 公开用量 | 选择是否公开用量数据 | P2 |
| ✅ 全局 Skills | 管理全局 Skills 引用 | P2 |
| ✅ GitHub 连接 | 查看/管理 GitHub App 安装状态 | P0 |
| ✅ Vercel 连接 | 查看/管理 Vercel 项目关联 | P2 |

### 5.3 用量统计（`/settings/usage`）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| ✅ Token 用量 | 显示总 token、input/output/cached 分解 | P0 |
| ✅ 费用估算 | 基于 models.dev 定价估算费用 | P1 |
| ✅ 消息统计 | 显示总消息数和 tool call 数 | P1 |
| ✅ 贡献热力图 | 按天显示 token 消耗热力图 | P1 |
| ✅ 日期筛选 | 点击热力图按日期范围筛选 | P2 |
| ✅ Agent 分解 | 饼图显示 Main agent vs Subagent 用量 | P2 |
| ✅ 模型分解 | 饼图显示各模型的 token 分布 | P2 |
| ✅ 排行榜 | 查看用量排行榜 | P2 |
| ✅ 代码变更统计 | 显示 lines added/removed/total | P2 |

### 5.4 订阅管理（`/settings/subscription`）

| 功能 | 描述 | 优先级 |
|------|------|--------|
| ✅ 订阅计划 | 显示当前订阅计划（Free/Pro/Team） | P2 |
| ✅ 用量配额 | 显示月度 token 配额和已用量 | P2 |
| ✅ 升级入口 | 引导用户升级计划 | P2 |

### 5.5 Sandbox & GitHub 集成

| 功能 | 描述 | 优先级 |
|------|------|--------|
| ✅ Sandbox 创建 | 首次对话时自动创建隔离 Sandbox | P0 |
| ✅ 仓库克隆 | Sandbox 内自动克隆 GitHub 仓库 | P0 |
| ✅ Git 操作 | 分支切换、commit、push | P1 |
| ✅ GitHub App | 安装/授权 GitHub App | P0 |
| ✅ Sandbox 休眠 | 不活跃后自动休眠 | P1 |
| ✅ Sandbox 恢复 | 发送新消息时自动恢复 Sandbox | P1 |
| ✅ Sandbox 快照 | 创建/使用快照加速恢复 | P2 |
| ✅ Dev Server | Sandbox 内启动开发服务器，预览端口 | P2 |
| ✅ 代码编辑器 | 在 Sandbox 内启动代码编辑器 | P2 |

---

## 6. 验收方式

每个阶段完成后，按以下标准验收：

### 6.1 编译验收

```bash
# 每个 package
cd packages/agent && pnpm typecheck
cd packages/sandbox && pnpm typecheck
cd packages/shared && pnpm typecheck

# apps/web
cd apps/web && pnpm typecheck
```

**标准**：`tsc --noEmit` 零错误退出。

### 6.2 数据库验收

```bash
cd apps/web && pnpm db:generate
```

**标准**：
- 生成的新 migration SQL 不包含重复表/列
- SQL 语法正确（可手动检查）
- `pnpm db:push` 到本地数据库成功

### 6.3 页面可访问验收

```bash
cd apps/web && pnpm dev
```

访问以下 URL，确认页面加载（即使数据为空）：

| URL | 预期 |
|-----|------|
| `/assistant` | 会话列表页（空状态） |
| `/assistant/{sessionId}/{chatId}` | 对话页（404 或空对话） |
| `/settings/assistant` | 设置页 |
| `/settings/usage` | 用量页 |
| `/settings/subscription` | 订阅页 |

### 6.4 API 验收

```bash
# 需要登录态
curl http://localhost:3000/api/models         # → 200 JSON（无需认证）
curl http://localhost:3000/api/sessions       # → 200 JSON（空列表或 401）
curl http://localhost:3000/api/usage          # → 200 JSON 或 401
curl http://localhost:3000/api/github/user    # → 200 或 401
curl http://localhost:3000/api/health         # → 200（已有）
```

### 6.5 功能验收

完成上述全部编译、数据库、页面、API 验证后，按第 5 节的功能清单逐项手动验证。

---

## 7. 实施顺序与阶段

```
Phase 1: packages 移植
  ├── 复制 agent/sandbox/shared 到 viben/packages/
  ├── 改 package.json name → @viben/*
  ├── 改 tsconfig.json extends
  ├── 全局替换 @open-agents/* → @viben/*
  └── 验收：三个 package 各自 typecheck 通过

Phase 2: 依赖安装
  ├── 更新 apps/web/package.json 添加所有新依赖
  ├── pnpm install
  └── 验收：pnpm install 无错误

Phase 3: DB Schema
  ├── 追加表定义到 lib/db/schema.ts
  ├── cd apps/web && pnpm db:generate
  └── 验收：生成 migration SQL，db:push 成功

Phase 4: lib 模块复制
  ├── 复制所有"直接复制"类 lib 文件
  ├── 复制所有"需要修改"类 lib 文件
  ├── 完成改动（getServerSession、user_id 引用等）
  └── 验收：cd apps/web && pnpm typecheck 通过

Phase 5: API Routes
  ├── 复制所有 API route 文件
  ├── 适配认证（getServerSession → getSession）
  └── 验收：typecheck 通过

Phase 6: Hooks
  ├── 复制 hooks 到 hooks/assistant/
  ├── 重写 use-session.ts
  └── 验收：typecheck 通过

Phase 7: Components
  ├── 复制 assistant 组件到 components/assistant/
  ├── 适配 UI 组件 import（检查 shadcn 版本差异）
  └── 验收：typecheck 通过

Phase 8: Pages
  ├── 创建 /assistant 路由页面
  ├── 创建 /settings/assistant、/settings/usage、/settings/subscription
  ├── 创建 layout.tsx（复用 DashboardShell）
  └── 验收：页面可访问，typecheck 通过

Phase 9: 集成测试
  ├── 启动 dev server
  ├── 手动验证功能清单 P0 项
  └── 验收：P0 功能全部可用

Phase 10: 文档
  ├── 编写 docs/assistant/README.md
  ├── 编写 docs/assistant/architecture.md
  ├── 编写 docs/assistant/setup.md
  └── 更新 apps/web/README.md
```

---

## 8. 新增环境变量

`apps/web/.env` 需要追加：

```env
# Assistant - GitHub App
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
NEXT_PUBLIC_GITHUB_APP_SLUG=
GITHUB_WEBHOOK_SECRET=
NEXT_PUBLIC_GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Assistant - Vercel Sandbox (可选)
VERCEL_SANDBOX_BASE_SNAPSHOT_ID=

# Assistant - Vercel Project (可选)
VERCEL_PROJECT_PRODUCTION_URL=
NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL=

# Assistant - Redis (可选，skills 缓存)
REDIS_URL=

# Assistant - ElevenLabs (可选，语音转录)
ELEVENLABS_API_KEY=

# Assistant - Resource Profile (可选，hobby=Hobby 兼容)
VIBEN_AGENTS_RESOURCE_PROFILE=
```

---

## 附录 A：数据库表完整字段定义

### A.1 sessions

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | text | PK | nanoid |
| user_id | text | NOT NULL, FK→users.id | viben 用户 ID |
| title | text | NOT NULL | 会话标题 |
| status | text | NOT NULL, CHECK(running\|completed\|failed\|archived) | 运行状态 |
| repo_owner | text | | GitHub 仓库 owner |
| repo_name | text | | GitHub 仓库名 |
| branch | text | | 工作分支 |
| clone_url | text | | 仓库克隆 URL |
| vercel_project_id | text | | Vercel 项目 ID |
| vercel_project_name | text | | Vercel 项目名 |
| vercel_team_id | text | | Vercel team ID |
| vercel_team_slug | text | | Vercel team slug |
| is_new_branch | boolean | NOT NULL DEFAULT false | 是否自动创建的分支 |
| auto_commit_push_override | boolean | | 覆盖用户自动 commit 偏好 |
| auto_create_pr_override | boolean | | 覆盖用户自动 PR 偏好 |
| global_skill_refs | jsonb | NOT NULL DEFAULT '[]' | 全局 skill 引用 |
| sandbox_state | jsonb | | Sandbox 状态快照 |
| lifecycle_state | text | CHECK(provisioning\|...\|failed) | 生命周期状态 |
| lifecycle_version | integer | NOT NULL DEFAULT 0 | 乐观锁版本号 |
| last_activity_at | timestamp | | 最后活动时间 |
| sandbox_expires_at | timestamp | | Sandbox 过期时间 |
| hibernate_after | timestamp | | 休眠触发时间 |
| lifecycle_run_id | text | | 生命周期 workflow ID |
| sandbox_provisioning_run_id | text | | 创建 workflow ID |
| lifecycle_error | text | | 生命周期错误信息 |
| lines_added | integer | DEFAULT 0 | Git 新增行数 |
| lines_removed | integer | DEFAULT 0 | Git 删除行数 |
| pr_number | integer | | PR 编号 |
| pr_status | text | CHECK(open\|merged\|closed) | PR 状态 |
| snapshot_url | text | | Sandbox 快照 URL |
| snapshot_created_at | timestamp | | 快照创建时间 |
| snapshot_size_bytes | integer | | 快照大小 |
| cached_diff | jsonb | | 缓存 diff 数据 |
| cached_diff_updated_at | timestamp | | diff 缓存时间 |
| created_at | timestamp | NOT NULL DEFAULT now() | |
| updated_at | timestamp | NOT NULL DEFAULT now() | |

索引：`sessions_user_id_idx` ON (user_id)

### A.2 chats

| 列名 | 类型 | 约束 |
|------|------|------|
| id | text | PK |
| session_id | text | NOT NULL, FK→sessions.id CASCADE |
| title | text | NOT NULL |
| model_id | text | DEFAULT 'anthropic/claude-haiku-4.5' |
| active_stream_id | text | 活跃 stream ID |
| last_assistant_message_at | timestamp | |
| created_at | timestamp | NOT NULL DEFAULT now() |
| updated_at | timestamp | NOT NULL DEFAULT now() |

索引：`chats_session_id_idx` ON (session_id)

### A.3 chat_messages

| 列名 | 类型 | 约束 |
|------|------|------|
| id | text | PK |
| chat_id | text | NOT NULL, FK→chats.id CASCADE |
| role | text | NOT NULL, CHECK(user\|assistant) |
| parts | jsonb | NOT NULL (MessagePart[]) |
| created_at | timestamp | NOT NULL DEFAULT now() |

### A.4 chat_reads

| 列名 | 类型 | 约束 |
|------|------|------|
| user_id | text | NOT NULL, FK→users.id CASCADE |
| chat_id | text | NOT NULL, FK→chats.id CASCADE |
| last_read_at | timestamp | NOT NULL DEFAULT now() |
| created_at | timestamp | NOT NULL DEFAULT now() |
| updated_at | timestamp | NOT NULL DEFAULT now() |

PK：(user_id, chat_id)，索引：`chat_reads_chat_id_idx` ON (chat_id)

### A.5 shares

| 列名 | 类型 | 约束 |
|------|------|------|
| id | text | PK |
| chat_id | text | NOT NULL, FK→chats.id CASCADE |
| created_at | timestamp | NOT NULL DEFAULT now() |
| updated_at | timestamp | NOT NULL DEFAULT now() |

唯一索引：`shares_chat_id_idx` ON (chat_id)

### A.6 workflow_runs

| 列名 | 类型 | 约束 |
|------|------|------|
| id | text | PK |
| chat_id | text | NOT NULL, FK→chats.id CASCADE |
| session_id | text | NOT NULL, FK→sessions.id CASCADE |
| user_id | text | NOT NULL, FK→users.id CASCADE |
| model_id | text | |
| status | text | NOT NULL, CHECK(completed\|aborted\|failed) |
| started_at | timestamp | NOT NULL |
| finished_at | timestamp | NOT NULL |
| total_duration_ms | integer | NOT NULL |
| created_at | timestamp | NOT NULL DEFAULT now() |

索引：chat_id、session_id、user_id 各一个

### A.7 workflow_run_steps

| 列名 | 类型 | 约束 |
|------|------|------|
| id | text | PK |
| workflow_run_id | text | NOT NULL, FK→workflow_runs.id CASCADE |
| step_number | integer | NOT NULL |
| started_at | timestamp | NOT NULL |
| finished_at | timestamp | NOT NULL |
| duration_ms | integer | NOT NULL |
| finish_reason | text | |
| raw_finish_reason | text | |
| created_at | timestamp | NOT NULL DEFAULT now() |

唯一索引：(workflow_run_id, step_number)

### A.8 user_preferences

| 列名 | 类型 | 约束 |
|------|------|------|
| id | text | PK |
| user_id | text | NOT NULL UNIQUE, FK→users.id CASCADE |
| default_model_id | text | DEFAULT 'anthropic/claude-haiku-4.5' |
| default_subagent_model_id | text | |
| default_sandbox_type | text | DEFAULT 'vercel', CHECK(vercel) |
| default_diff_mode | text | DEFAULT 'unified', CHECK(unified\|split) |
| auto_commit_push | boolean | NOT NULL DEFAULT false |
| auto_create_pr | boolean | NOT NULL DEFAULT false |
| alerts_enabled | boolean | NOT NULL DEFAULT true |
| alert_sound_enabled | boolean | NOT NULL DEFAULT true |
| public_usage_enabled | boolean | NOT NULL DEFAULT false |
| global_skill_refs | jsonb | NOT NULL DEFAULT '[]' |
| model_variants | jsonb | NOT NULL DEFAULT '[]' |
| enabled_model_ids | jsonb | NOT NULL DEFAULT '[]' |
| created_at | timestamp | NOT NULL DEFAULT now() |
| updated_at | timestamp | NOT NULL DEFAULT now() |

### A.9 usage_events

| 列名 | 类型 | 约束 |
|------|------|------|
| id | text | PK |
| user_id | text | NOT NULL, FK→users.id CASCADE |
| source | text | NOT NULL DEFAULT 'web', CHECK(web) |
| agent_type | text | NOT NULL DEFAULT 'main', CHECK(main\|subagent) |
| provider | text | |
| model_id | text | |
| input_tokens | integer | NOT NULL DEFAULT 0 |
| cached_input_tokens | integer | NOT NULL DEFAULT 0 |
| output_tokens | integer | NOT NULL DEFAULT 0 |
| tool_call_count | integer | NOT NULL DEFAULT 0 |
| created_at | timestamp | NOT NULL DEFAULT now() |

### A.10 github_installations

| 列名 | 类型 | 约束 |
|------|------|------|
| id | text | PK |
| user_id | text | NOT NULL, FK→users.id CASCADE |
| installation_id | integer | NOT NULL |
| account_login | text | NOT NULL |
| account_type | text | NOT NULL, CHECK(User\|Organization) |
| repository_selection | text | NOT NULL, CHECK(all\|selected) |
| installation_url | text | |
| created_at | timestamp | NOT NULL DEFAULT now() |
| updated_at | timestamp | NOT NULL DEFAULT now() |

唯一索引：(user_id, installation_id)、(user_id, account_login)

### A.11 vercel_project_links

| 列名 | 类型 | 约束 |
|------|------|------|
| user_id | text | NOT NULL, FK→users.id CASCADE |
| repo_owner | text | NOT NULL |
| repo_name | text | NOT NULL |
| project_id | text | NOT NULL |
| project_name | text | NOT NULL |
| team_id | text | |
| team_slug | text | |
| created_at | timestamp | NOT NULL DEFAULT now() |
| updated_at | timestamp | NOT NULL DEFAULT now() |

PK：(user_id, repo_owner, repo_name)
