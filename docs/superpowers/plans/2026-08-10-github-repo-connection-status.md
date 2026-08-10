# GitHub Repo OAuth 连接状态实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `hasGitHub` 只表示用户拥有可用于仓库访问的 Repo OAuth token，并确保 GitHub 登录与 Connect 都写入、消费同一份加密 token。

**Architecture:** `oauth_connections` 继续表达登录身份，`github_connections` 作为 Repo OAuth token 的唯一加密存储。`/api/users/me` 只返回布尔状态，不暴露 token；前端 `useSession` 消费该状态。仓库 API 统一通过明确命名的 Repo OAuth token accessor 读取 token。

**Tech Stack:** Next.js 15、TypeScript、Drizzle ORM、Vitest、SWR、GitHub OAuth API。

## Global Constraints

- 编辑文件使用绝对路径和 `apply_patch`。
- TypeScript 使用静态 import，不新增动态 import。
- 只在 `apps/web` 内运行测试、类型检查和构建。
- 保留 `GITHUB_REPO_CLIENT_*` Connect 流程；GitHub 登录新增 `repo` scope。
- 不修改无关的 page-session 工作树改动。

---

### Task 1: Repo OAuth token 的统一存储与读取

**Files:**
- Create: `apps/web/lib/github/repo-connection.ts`
- Modify: `apps/web/lib/github/token.ts`
- Modify: `apps/web/app/api/auth/github/callback/route.ts`
- Modify: `apps/web/app/api/github/callback/route.ts`
- Test: `apps/web/lib/github/repo-connection.test.ts`

**Interfaces:**
- Produces: `upsertGitHubRepoConnection(input)`, `hasGitHubRepoConnection(userId)`, `getGitHubRepoOAuthToken(userId)`。
- Consumes: `github_connections`、`encryptToken()`、`decryptToken()`。

- [ ] 写失败测试，证明 Repo token 被加密 upsert，且状态只由 `github_connections` 决定。
- [ ] 运行定向测试，确认因接口缺失而失败。
- [ ] 实现最小 helper，并让两个 OAuth callback 共用它。
- [ ] 将 GitHub 登录 scope 改为 `read:user user:email repo`。
- [ ] 运行定向测试确认通过。

### Task 2: 用户 API 与前端 Session 状态

**Files:**
- Modify: `apps/web/app/api/users/me/route.ts`
- Modify: `apps/web/hooks/assistant/use-session.ts`
- Test: `apps/web/app/api/users/me/route.test.ts`
- Test: `apps/web/hooks/assistant/use-session.test.tsx`

**Interfaces:**
- Consumes: `hasGitHubRepoConnection(userId)`。
- Produces: `/api/users/me` 响应字段 `hasGitHub: boolean`。

- [ ] 写失败测试：仅有 `users.github_username` 时 `hasGitHub=false`，存在 Repo token 时为 `true`。
- [ ] 运行测试并确认按预期失败。
- [ ] API 返回服务端计算值，hook 不再从用户名推导。
- [ ] 运行定向测试确认通过。

### Task 3: 仓库消费者统一使用 Repo OAuth token

**Files:**
- Modify: `apps/web/lib/github/client.ts`
- Modify: `apps/web/app/api/github/branches/route.ts`
- Modify: repo/PR/deployment/org 等调用旧 accessor 的 GitHub 仓库消费者。

**Interfaces:**
- Consumes: `getGitHubRepoOAuthToken(userId)`。
- Produces: 浏览、分支和权限校验使用相同的 Repo token。

- [ ] 将仓库权限相关消费者切换到新 accessor，身份资料读取保留登录 token fallback。
- [ ] 运行相关 GitHub 定向测试。
- [ ] 运行 `pnpm typecheck`。
- [ ] 运行 `pnpm build`。
- [ ] 检查 `git diff --check` 并提交。
