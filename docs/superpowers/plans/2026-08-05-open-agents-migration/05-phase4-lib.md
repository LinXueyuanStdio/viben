# Phase 4 — lib 模块迁移

**目标**：将 open-agents `apps/web/lib/` 下的业务逻辑模块全部复制到 viben，适配 import 路径和认证。

## 文件分类

### A类：直接复制（只改 @open-agents/* → @viben/*）

#### lib/chat/（对话核心）

| 源文件 | 目标文件 |
|------|------|
| `open-agents/.../lib/chat/auto-commit-direct.ts` | `viben/.../lib/chat/auto-commit-direct.ts` |
| `open-agents/.../lib/chat/auto-commit-direct.test.ts` | 同上 .test.ts |
| `open-agents/.../lib/chat/auto-pr-direct.ts` | `viben/.../lib/chat/auto-pr-direct.ts` |
| `open-agents/.../lib/chat/auto-pr-direct.test.ts` | 同上 .test.ts |
| `open-agents/.../lib/chat/create-cancelable-readable-stream.ts` | `viben/.../lib/chat/create-cancelable-readable-stream.ts` |
| `open-agents/.../lib/chat/create-cancelable-readable-stream.test.ts` | 同上 .test.ts |
| `open-agents/.../lib/chat/dedupe-message-reasoning.ts` | `viben/.../lib/chat/dedupe-message-reasoning.ts` |
| `open-agents/.../lib/chat/dedupe-message-reasoning.test.ts` | 同上 .test.ts |

#### lib/git/（Git 操作）

```
open-agents/apps/web/lib/git/branches.ts
open-agents/apps/web/lib/git/helpers.ts
open-agents/apps/web/lib/git/actions/branch.ts
open-agents/apps/web/lib/git/actions/discard.ts
open-agents/apps/web/lib/git/queries/status.ts
```

#### lib/skills/（Skills 管理）

```
open-agents/apps/web/lib/skills/directories.ts
open-agents/apps/web/lib/skills/global-skill-refs.ts
open-agents/apps/web/lib/skills/global-skill-refs.test.ts
open-agents/apps/web/lib/skills/global-skill-installer.ts
open-agents/apps/web/lib/skills/global-skill-installer.test.ts
```

#### lib/usage/（用量统计）

```
open-agents/apps/web/lib/usage/types.ts
open-agents/apps/web/lib/usage/date-range.ts
open-agents/apps/web/lib/usage/date-range.test.ts
open-agents/apps/web/lib/usage/compute-insights.ts
open-agents/apps/web/lib/usage/compute-insights.test.ts
open-agents/apps/web/lib/usage/leaderboard-domain.ts
```

#### lib/vercel/（Vercel 集成）

```
open-agents/apps/web/lib/vercel/token.ts
open-agents/apps/web/lib/vercel/types.ts
open-agents/apps/web/lib/vercel/projects.ts
open-agents/apps/web/lib/vercel/projects.test.ts
```

#### lib/sandbox/（Sandbox 管理）

```
open-agents/apps/web/lib/sandbox/config.ts
open-agents/apps/web/lib/sandbox/home-directory.ts
open-agents/apps/web/lib/sandbox/lifecycle.ts
open-agents/apps/web/lib/sandbox/lifecycle.test.ts
open-agents/apps/web/lib/sandbox/lifecycle-kick.ts
open-agents/apps/web/lib/sandbox/lifecycle-kick.test.ts
open-agents/apps/web/lib/sandbox/lifecycle-evaluate.test.ts
open-agents/apps/web/lib/sandbox/provisioning.ts
open-agents/apps/web/lib/sandbox/provisioning-kick.ts
open-agents/apps/web/lib/sandbox/archive-session.ts
open-agents/apps/web/lib/sandbox/archive-session.test.ts
open-agents/apps/web/lib/sandbox/utils.ts
```

#### lib/github/（GitHub 集成 — 直接复制）

```
open-agents/apps/web/lib/github/client.ts
open-agents/apps/web/lib/github/client.test.ts
open-agents/apps/web/lib/github/app.ts
open-agents/apps/web/lib/github/access.ts
open-agents/apps/web/lib/github/token.ts
open-agents/apps/web/lib/github/token.test.ts
open-agents/apps/web/lib/github/commit.ts
open-agents/apps/web/lib/github/commit.test.ts
open-agents/apps/web/lib/github/commit-intent.ts
open-agents/apps/web/lib/github/commit-intent.test.ts
open-agents/apps/web/lib/github/pulls.ts
open-agents/apps/web/lib/github/pr-content.ts
open-agents/apps/web/lib/github/pr-content.test.ts
open-agents/apps/web/lib/github/repos.ts
open-agents/apps/web/lib/github/repo-identifiers.test.ts
open-agents/apps/web/lib/github/status.ts
open-agents/apps/web/lib/github/sync.ts
open-agents/apps/web/lib/github/installations-sync.test.ts
open-agents/apps/web/lib/github/installation-repos.test.ts
open-agents/apps/web/lib/github/urls.ts
open-agents/apps/web/lib/github/users.ts
open-agents/apps/web/lib/github/actions/commit.ts
open-agents/apps/web/lib/github/actions/connection.ts
open-agents/apps/web/lib/github/actions/pr.ts
open-agents/apps/web/lib/github/queries/deployment.ts
open-agents/apps/web/lib/github/queries/pr.ts
```

#### lib/ 根目录文件（直接复制）

```
open-agents/apps/web/lib/models.ts + test
open-agents/apps/web/lib/models-with-context.ts
open-agents/apps/web/lib/model-variants.ts + test
open-agents/apps/web/lib/model-options.ts + test
open-agents/apps/web/lib/model-access.ts + test
open-agents/apps/web/lib/model-availability.ts + test
open-agents/apps/web/lib/swr.ts + test
open-agents/apps/web/lib/redis.ts + test
open-agents/apps/web/lib/rate-limit.ts + test
open-agents/apps/web/lib/botid.ts
open-agents/apps/web/lib/file-suggestions.ts
open-agents/apps/web/lib/image-utils.ts
open-agents/apps/web/lib/format-relative-time.ts
open-agents/apps/web/lib/streamdown-config.tsx + test
open-agents/apps/web/lib/diffs-config.ts
open-agents/apps/web/lib/assistant-file-links.ts + test
open-agents/apps/web/lib/chat-auto-commit.ts + test
open-agents/apps/web/lib/chat-instance-manager.ts
open-agents/apps/web/lib/chat-streaming-state.ts + test
open-agents/apps/web/lib/chat-route-cleanup.ts + test
open-agents/apps/web/lib/abortable-chat-transport.ts
open-agents/apps/web/lib/merge-readiness-polling.ts + test
open-agents/apps/web/lib/pr-deployment-polling.ts + test
open-agents/apps/web/lib/workspace-status-store.ts + test
open-agents/apps/web/lib/skills-cache.ts + test
open-agents/apps/web/lib/vercel-themes.ts
open-agents/apps/web/lib/redirect-safety.ts
open-agents/apps/web/lib/text-attachment-utils.ts
open-agents/apps/web/lib/random-city.ts + test
open-agents/apps/web/lib/onboarding.ts
open-agents/apps/web/lib/managed-template-trial.ts
open-agents/apps/web/lib/utils.ts  →  检查与 viben lib/utils 是否冲突后合并
```

### B类：复制后需要修改

| 文件 | 改动 |
|------|------|
| `lib/session/get-server-session.ts` | 完全重写：去掉 Better Auth，使用 viben `getSession()` |
| `lib/session/server.ts` | 去掉 Better Auth 依赖 |
| `lib/session/types.ts` | Session 类型适配 viben 格式 |
| `lib/github/` 部分文件 | 可能需要适配 viben 现有的 GitHub API 路径 |

### C类：不迁移

| 文件 | 原因 |
|------|------|
| `lib/auth/config.ts` | Better Auth 配置 |
| `lib/auth/client.ts` | Better Auth 客户端 |
| `lib/auth/actions.ts` | Better Auth actions |
| `lib/auth/username.ts` + test | viben 已有 |
| `lib/deployment/resource-profile.ts` | 暂不需要 |
| `lib/diff/compute-diff.ts` + test | 用 @viben/shared 的 diff |
| `lib/diff/download-diff.ts` + test | 暂不需要 |

## 实施步骤

- [ ] **Step 1: 创建目标目录**

```bash
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/chat
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/git/actions
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/git/queries
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/skills
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/usage
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/vercel
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/sandbox
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/github/actions
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/github/queries
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/session
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/diff
```

- [ ] **Step 2: 批量复制 A 类文件**

将所有 A 类文件从 open-agents 复制到 viben 对应路径。

- [ ] **Step 3: 全局替换 import 路径**

在所有新复制的 lib 文件中：
- `@open-agents/agent` → `@viben/agent`
- `@open-agents/sandbox` → `@viben/sandbox`
- `@open-agents/shared` → `@viben/shared`

```bash
# 批量替换
grep -rl "@open-agents/" D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/ | xargs sed -i 's/@open-agents\//@viben\//g'
```

- [ ] **Step 4: 适配 viben 现有 lib/utils.ts**

检查 open-agents 的 `lib/utils.ts` 和 viben 的 `lib/utils.ts`：
- 如果 viben 已有同名函数 → 不复制，用 viben 版本
- 如果 open-agents 有 viben 缺少的函数 → 追加到 viben

- [ ] **Step 5: 重写 lib/session/get-server-session.ts**

```typescript
// D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\session\get-server-session.ts
import { getSession } from "@/lib/auth/cookies";

export async function getServerSession() {
  const session = await getSession();
  if (!session) return null;

  // 适配为 open-agents 期望的格式
  return {
    user: {
      id: session.userId,
      username: session.username,
      email: session.email,
      name: session.displayName,
      avatar: session.avatarUrl,
      role: session.role,
    },
  };
}
```

- [ ] **Step 6: 重写 lib/session/server.ts**

去掉对 Better Auth 的依赖，改为使用 viben 的 session 工具。

- [ ] **Step 7: 适配 lib/db/users.ts**

已在 Phase 3 完成，这里确认一下 import 路径正确。

- [ ] **Step 8: 验证 — typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

修正所有报错。

- [ ] **Step 9: Commit**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben
git add apps/web/lib/
git commit -m "feat: 迁移 open-agents lib 模块 (chat/git/github/sandbox/skills/usage/vercel/session)"
```
