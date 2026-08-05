# Phase 3 — 数据库 Schema 合并

**目标**：将 open-agents 的 11 张表追加到 viben `lib/db/schema.ts`，生成 migration SQL，推送到数据库。

## 需要追加的表

| 表名 | 用途 | user_id 外键 |
|------|------|-------------|
| `sessions` | 助手会话 | → users.id |
| `chats` | 会话对话 | → sessions.id |
| `chat_messages` | 消息记录 | → chats.id |
| `chat_reads` | 已读状态 | → users.id + chats.id |
| `shares` | 分享链接 | → chats.id |
| `workflow_runs` | Workflow 运行 | → users.id + sessions.id + chats.id |
| `workflow_run_steps` | Workflow 步骤 | → workflow_runs.id |
| `user_preferences` | 用户偏好 | → users.id (unique) |
| `usage_events` | 用量事件 | → users.id |
| `github_installations` | GitHub 安装 | → users.id |
| `vercel_project_links` | Vercel 项目 | → users.id (composite PK) |

## 关键注意

1. **user_id 外键**：所有引用 open-agents `users` 表的地方，改为引用 viben `users` 表
2. **字段名**：保持 snake_case（viben 和 open-agents 都使用 snake_case）
3. **不创建**：open-agents 的 `users`、`accounts`、`auth_sessions`、`verification` 表
4. **验证兼容性**：viben users 表必须有 `id`（text PK），这是 open-agents 需要的

## 实施步骤

- [ ] **Step 1: 检查 viben users 表结构**

先确认 viben `users` 表有 `id` 字段（text 类型，作为 PK）：

```bash
grep -A 20 "export const users" D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/schema.ts
```

- [ ] **Step 2: 复制 DB 操作文件**

从 open-agents 复制需要改写的数据访问文件：

```bash
# 以下文件直接复制（后面在 Phase 4 会一起改 import 路径）
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/sessions.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/sessions-cache.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/user-preferences.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/usage.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/usage-insights.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/usage-domain-leaderboard.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/public-usage-profile.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/installations.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/last-repo.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/workflow-runs.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/vercel-project-links.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
```

以及测试文件：

```bash
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/sessions.test.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/user-preferences.test.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/usage-domain-leaderboard.test.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
cp "D:/Document/Github/LinXueyuanStdio/open-agents/apps/web/lib/db/public-usage-profile.test.ts" "D:/Document/Github/LinXueyuanStdio/viben/apps/web/lib/db/"
```

- [ ] **Step 3: 重写 lib/db/users.ts**

open-agents 的 `lib/db/users.ts` 引用了 open-agents 的 `users` 表。需要**完全重写**为查询 viben 的 users 表：

```typescript
// D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\db\users.ts
// 从 viben schema 导入 users 表
import { users } from "./schema";
import { db } from "./client"; // 或 viben 的 db client
import { eq } from "drizzle-orm";

export async function getUserById(id: string) {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getUserByUsername(username: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return result[0] ?? null;
}
```

- [ ] **Step 4: 修改 open-agents 的 DB 文件中的 users 引用**

在所有从 open-agents 复制的 DB 文件中：
- 将 `import { users } from "./schema"` 改为引用 viben `users` 表
- `user_id` 的 references 本来就是 text → users.id，保持一致
- 去掉 `import { accounts, authSessions, verification }` 等不需要的表引用

- [ ] **Step 5: 追加表定义到 schema.ts**

编辑 `D:\Document\Github\LinXueyuanStdio\viben\apps\web\lib\db\schema.ts`，在文件末尾追加 11 张表的定义。

直接从 open-agents `lib/db/schema.ts` 复制以下定义：
- `sessions` 表
- `chats` 表
- `chatMessages` 表
- `chatReads` 表
- `shares` 表
- `workflowRuns` 表
- `workflowRunSteps` 表
- `userPreferences` 表
- `usageEvents` 表
- `githubInstallations` 表
- `vercelProjectLinks` 表
- 所有 `export type` 声明

**不需要复制：**
- `users` 表定义
- `accounts` 表定义
- `authSessions` 表定义
- `verification` 表定义

- [ ] **Step 6: 修正 schema.ts 的 import**

确保追加的代码可以正确引用 viben 的 `users` 表。在追加的代码中，`sessions`、`userPreferences`、`usageEvents` 等表的 `user_id` 字段 reference 应该指向 viben schema 中导出的 `users`。

如果 viben 的 `users` 表名是 `users`（和 open-agents 一样），那么 references 无需修改。如果 viben 的表名不同，则需要调整。

- [ ] **Step 7: 生成 migration**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm db:generate
```

预期：在 `lib/db/migrations/` 下生成新的 `.sql` 文件。

- [ ] **Step 8: 检查生成的 SQL**

打开生成的 `.sql` migration 文件，确认：
- 所有 11 张表都有 CREATE TABLE 语句
- 不存在 ALTER TABLE（不应修改已有表）
- 不存在重复表名（不与 viben 已有表冲突）
- 外键引用正确

- [ ] **Step 9: 推送到本地数据库**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm db:push
```

注意：`db:push` 需要手动确认 schema 变更。

- [ ] **Step 10: Commit**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben
git add apps/web/lib/db/schema.ts apps/web/lib/db/migrations/ apps/web/lib/db/users.ts apps/web/lib/db/sessions.ts apps/web/lib/db/sessions-cache.ts apps/web/lib/db/user-preferences.ts apps/web/lib/db/usage.ts apps/web/lib/db/usage-insights.ts apps/web/lib/db/usage-domain-leaderboard.ts apps/web/lib/db/public-usage-profile.ts apps/web/lib/db/installations.ts apps/web/lib/db/last-repo.ts apps/web/lib/db/workflow-runs.ts apps/web/lib/db/vercel-project-links.ts
git commit -m "feat: 合并 open-agents 数据库 schema — 11 张新表"
```
