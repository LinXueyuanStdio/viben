# 从 open-agents 移植变更记录

## 移植信息

- **移植日期**：2026-08-05
- **源项目**：[open-agents](https://github.com/vercel-labs/open-agents) by Vercel Labs
- **目标项目**：viben `apps/web`
- **源 commit**：latest main（移植时）

## 变更概要

### 认证

| 变更 | 说明 |
|------|------|
| Better Auth → viben session | `getServerSession()` 改为调用 `lib/auth/cookies.ts` 的 `getSession()` |
| `useSession` hook 重写 | 从 `/api/auth/info` 改为 `/api/users/me` |
| `signOut` 替换 | Better Auth 的 `auth.signOut()` → viben 登出路由 |
| `lib/auth/config.ts` 删除 | Better Auth 配置，完全去掉 |
| `lib/auth/client.ts` 删除 | Better Auth 客户端 |

### 数据库

| 变更 | 说明 |
|------|------|
| 新增 11 张表 | sessions、chats、chat_messages、chat_reads、shares、workflow_runs、workflow_run_steps、user_preferences、usage_events、github_installations、vercel_project_links |
| user_id 外键 | 全部指向 viben `users.id` |
| 不迁移的表 | users、accounts、auth_sessions、verification |
| displayName 适配 | open-agents 用 `name` 字段，viben 用 `displayName` |

### Packages

| 变更 | 说明 |
|------|------|
| `@open-agents/agent` → `@viben/agent` | 包名和所有引用路径 |
| `@open-agents/sandbox` → `@viben/sandbox` | 同上 |
| `@open-agents/shared` → `@viben/shared` | 同上 |
| `@open-agents/tsconfig` → 内联 | tsconfig extends 替换为内联 compilerOptions |
| `catalog:` → 显式版本 | pnpm catalog 协议替换为具体版本号 |

### 路由

| 变更 | 说明 |
|------|------|
| `/sessions` → `/assistant` | 会话列表 |
| `/sessions/[id]/chats/[id]` → `/assistant/[id]/[id]` | 对话页 |
| `/settings/profile` → `/settings/assistant` | 设置页 |
| 新增 `/settings/subscription` | 订阅管理 |

### 组件与 Hooks

| 变更 | 说明 |
|------|------|
| `components/` → `components/assistant/` | 所有 open-agents 组件移到子目录 |
| `hooks/` → `hooks/assistant/` | 所有 open-agents hooks 移到子目录 |
| UI 组件复用 | viben 已有的 shadcn 组件不复制，open-agents 独有的补充复制 |
| `use-mobile.ts` | 从 open-agents 复制（viben 没有） |

## 文件统计

| 类型 | 数量 |
|------|------|
| 新增 packages | 3（agent、sandbox、shared） |
| 新增 lib 模块 | ~85 |
| 新增 API routes | ~70 |
| 新增 hooks | ~25 |
| 新增组件 | ~80（含 tool-call renderers） |
| 新增页面 | 7 |
| 新增 UI 组件 | 10 |
| 修改已有文件 | ~10 |
| 不迁移文件 | ~47 |

## 待后续完善

- Sandbox 功能需 Vercel 部署环境支持
- GitHub App 集成需配置 App 凭证
- OAuth token 管理需对接 viben OAuth 体系（当前为 stub）
- 设置页面目前为占位页，需从 open-agents 迁移 settings sections
- 国际化翻译待补充

## 相关文档

- 设计文档：`docs/superpowers/specs/2026-08-05-open-agents-migration-design.md`
- 实施计划：`docs/superpowers/plans/2026-08-05-open-agents-migration/`
