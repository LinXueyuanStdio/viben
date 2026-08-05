# 00 — 背景与前因后果

## 1. 为什么要做这个移植

viben 是一个社区内容平台（Pages、Moments、Collections 等），目前缺少 AI 助手能力。用户希望在 viben 中直接使用 AI 编码助手，不需要切换到其他平台。

open-agents 是 Vercel Labs 开源的 AI 编码 Agent 参考实现，功能成熟、架构清晰、允许直接复用代码。将 open-agents 移植到 viben，可以快速获得完整的 Agent 对话能力。

## 2. open-agents 是什么

open-agents 是一套**在 Sandbox VM 里写代码的 AI Agent 系统**，架构为三层：

```
Web UI (Next.js) → Agent Runtime (Workflow SDK) → Sandbox VM (Vercel)
```

| 层 | 职责 | 技术栈 |
|---|---|---|
| **Web UI** | 对话界面、Session 管理、设置页、用量统计 | Next.js 16 + React 19 + Tailwind v4 + shadcn/ui |
| **Agent Runtime** | System prompt、工具调用、Subagent 调度、Skills | Vercel AI SDK + Workflow SDK + Anthropic/OpenAI |
| **Sandbox VM** | 文件系统、Shell 执行、Git 操作、Dev Server | Vercel Sandbox SDK |

### open-agents 项目结构

```
open-agents/
├── apps/web/              # Next.js 前端应用
│   ├── app/
│   │   ├── sessions/      # ★ 核心：对话 Session 页面
│   │   ├── settings/      # 设置页（profile/preferences/models/connections）
│   │   ├── codespace/     # CodeSpace 页面
│   │   ├── shared/        # 分享只读链接
│   │   └── api/           # 全部后端 API
│   ├── components/        # React 组件（~80 个）
│   ├── hooks/             # React hooks（~25 个）
│   └── lib/               # 业务逻辑库（~90 个模块）
├── packages/
│   ├── agent/             # Agent 运行时（system prompt、tools、skills、subagents）
│   ├── sandbox/           # Sandbox 抽象层（interface + Vercel 实现）
│   ├── shared/            # 共享工具（diff、token 格式化、React hooks）
│   └── tsconfig/          # 共享 TypeScript 配置
└── docs/                  # 架构文档、经验总结
```

### open-agents 核心能力

| 能力 | 说明 |
|------|------|
| **多轮对话** | 用户发送消息 → Agent 流式响应（SSE），支持取消 |
| **Tool Calling** | Agent 可以读写文件、执行 Shell 命令、搜索代码、调用子 Agent |
| **Sandbox 隔离** | 每个 Session 在独立 VM 中运行，有完整文件系统和 Git |
| **GitHub 集成** | 克隆仓库、切换分支、自动 commit、创建 PR |
| **Skills 系统** | 用户可创建/安装可复用的 Agent 技能 |
| **Subagent 调度** | 主 Agent 可将子任务分派给 Subagent（design/explore/execute） |
| **用量统计** | Token 消耗追踪、费用估算、贡献热力图、排行榜 |
| **分享** | 生成只读链接，可分享对话内容 |
| **语音输入** | ElevenLabs 语音转录 |

## 3. viben 现状

### viben 已有的能力

| 模块 | 说明 |
|------|------|
| **认证** | cookie-based session（`lib/auth/cookies.ts` → `getSession()`） |
| **用户** | users 表，字段：id, username, email, displayName, role, avatarUrl |
| **布局** | `DashboardShell`（header + sidebar + content），sidebar 已有"助手"入口 |
| **设置** | `/settings/profile`、`/settings/account`、`/settings/api_keys` |
| **国际化** | 20 种语言（zh-CN、en、ja、ko 等），使用 react-i18next |
| **社区** | Pages、Moments、Collections、评论 |
| **管理后台** | `/admin` 路由组，有独立的权限系统 |
| **数据库** | PostgreSQL + Drizzle ORM，已有 `lib/db/schema.ts` |

### viben 没有的能力（需要移植）

| 缺失能力 | 来源 |
|----------|------|
| AI 对话界面 | open-agents sessions/chat |
| Agent 运行时 | open-agents packages/agent |
| Sandbox 集成 | open-agents packages/sandbox |
| Git/GitHub 操作 | open-agents lib/git + lib/github |
| 用量统计 | open-agents lib/usage + settings 用量页 |
| 模型管理 | open-agents lib/models + settings 模型页 |

## 4. 移植策略

**先完整移植，再做减法。**

理由：
1. open-agents 代码质量高，模块边界清晰
2. 直接在 viben 中调试和裁剪比在 open-agents 中修改后复制更可控
3. 完整移植可以一次性验证所有依赖关系，避免遗漏
4. 后续减法可以按需进行（如去掉不需要的 sandbox 类型、简化工具集等）

### 三个层次的处理方式

| 处理方式 | 文件数 | 说明 |
|----------|--------|------|
| **直接复制** | ~260 | 代码原样复制，只改 `@open-agents/*` → `@viben/*` |
| **复制后修改** | ~30 | 复制后需要改认证、改 DB 引用、改 UI 组件 import |
| **不迁移** | ~47 | Better Auth 相关、landing 页、shadcn UI 组件（viben 已有） |

### 关键集成决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 认证层 | 用 viben 的 cookie session | 统一用户体系，一处登录 |
| 数据库 | 合并到 viben Postgres | 简化运维，user_id 直接关联 |
| packages | 保留独立 @viben/* | 复用 open-agents 架构，后续 B 端可独立引用 |
| 路由 | 放入 (dashboard) route group | 复用现有 header + sidebar 布局 |
| API 路径 | 保持 open-agents 原路径 | 无冲突，减少改写量 |

## 5. 相关文件

- 设计文档：`docs/superpowers/specs/2026-08-05-open-agents-migration-design.md`
- 源项目：`D:\Document\Github\LinXueyuanStdio\open-agents`
- 目标项目：`D:\Document\Github\LinXueyuanStdio\viben`
- open-agents AGENTS.md：`D:\Document\Github\LinXueyuanStdio\open-agents\AGENTS.md`
- open-agents README：`D:\Document\Github\LinXueyuanStdio\open-agents\README.md`
