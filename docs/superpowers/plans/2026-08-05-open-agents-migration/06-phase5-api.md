# Phase 5 — API Routes 迁移

**目标**：将 open-agents 所有 API routes 复制到 viben，适配认证层。

## 需要复制的 API routes（按目录分组）

### `/api/chat/`（对话）

```
app/api/chat/route.ts                    # POST — 创建对话消息
app/api/chat/route.test.ts
app/api/chat/[chatId]/stream/route.ts    # GET — SSE 流式响应
app/api/chat/[chatId]/stream/route.test.ts
app/api/chat/[chatId]/stop/route.ts      # POST — 停止生成
app/api/chat/[chatId]/stop/route.test.ts
```

### `/api/sessions/`（会话）

```
app/api/sessions/route.ts                          # GET/POST
app/api/sessions/route.test.ts
app/api/sessions/[sessionId]/route.ts              # GET/PATCH/DELETE
app/api/sessions/[sessionId]/chats/route.ts        # GET/POST
app/api/sessions/[sessionId]/chats/route.test.ts
app/api/sessions/[sessionId]/chats/[chatId]/route.ts           # PATCH/DELETE
app/api/sessions/[sessionId]/chats/[chatId]/route.test.ts
app/api/sessions/[sessionId]/chats/[chatId]/messages/route.ts  # GET
app/api/sessions/[sessionId]/chats/[chatId]/messages/route.test.ts
app/api/sessions/[sessionId]/chats/[chatId]/messages/[messageId]/route.ts
app/api/sessions/[sessionId]/chats/[chatId]/messages/[messageId]/route.test.ts
app/api/sessions/[sessionId]/chats/[chatId]/read/route.ts      # POST
app/api/sessions/[sessionId]/chats/[chatId]/share/route.ts     # POST
app/api/sessions/[sessionId]/chats/[chatId]/fork/route.ts      # POST
app/api/sessions/[sessionId]/diff/route.ts
app/api/sessions/[sessionId]/diff/patch/route.ts
app/api/sessions/[sessionId]/diff/cached/route.ts
app/api/sessions/[sessionId]/files/route.ts
app/api/sessions/[sessionId]/files/content/route.ts
app/api/sessions/[sessionId]/files/content/route.test.ts
app/api/sessions/[sessionId]/skills/route.ts
app/api/sessions/[sessionId]/code-editor/route.ts
app/api/sessions/[sessionId]/dev-server/route.ts
app/api/sessions/[sessionId]/share/route.ts
app/api/sessions/[sessionId]/generate-commit-message/route.ts
app/api/sessions/[sessionId]/checks/fix/route.ts
```

### `/api/models/`

```
app/api/models/route.ts
app/api/models/route.test.ts
```

### `/api/settings/`

```
app/api/settings/preferences/route.ts
app/api/settings/preferences/route.test.ts
app/api/settings/model-variants/route.ts
app/api/settings/model-variants/route.test.ts
```

### `/api/usage/`

```
app/api/usage/route.ts
app/api/usage/rank/route.ts
```

### `/api/github/`（追加，不覆盖 viben 已有路由）

```
app/api/github/app/callback/route.ts
app/api/github/app/callback/route.test.ts
app/api/github/app/install/route.ts
app/api/github/app/install/route.test.ts
app/api/github/branches/route.ts
app/api/github/connection-status/route.ts
app/api/github/connection-status/route.test.ts
app/api/github/create-repo/route.ts
app/api/github/create-repo/route.test.ts
app/api/github/installations/route.ts
app/api/github/installations/repos/route.ts
app/api/github/orgs/route.ts
app/api/github/orgs/install-status/route.ts
app/api/github/post-link/route.ts
app/api/github/user/route.ts
app/api/github/webhook/route.ts
```

### `/api/sandbox/`

```
app/api/sandbox/route.ts
app/api/sandbox/route.test.ts
app/api/sandbox/activity/route.ts
app/api/sandbox/extend/route.ts
app/api/sandbox/reconnect/route.ts
app/api/sandbox/reconnect/route.test.ts
app/api/sandbox/snapshot/route.ts
app/api/sandbox/snapshot/route.test.ts
app/api/sandbox/status/route.ts
app/api/sandbox/status/route.test.ts
```

### 其他

```
app/api/generate-pr/route.ts
app/api/generate-title/route.ts
app/api/generate-title/route.test.ts
app/api/transcribe/route.ts
app/api/shared/[shareId]/status/route.ts
app/api/shared/[shareId]/status/route.test.ts
app/api/shared/[shareId]/markdown/route.ts
app/api/shared/[shareId]/markdown/route.test.ts
app/api/vercel/projects/[idOrName]/env/route.ts
app/api/vercel/projects/[idOrName]/env/route.test.ts
app/api/vercel/repo-projects/route.ts
app/api/vercel/repo-projects/route.test.ts
```

## 不迁移的 API

```
app/api/auth/[...all]/route.ts    # Better Auth catch-all
app/api/auth/info/route.ts        # Better Auth session info（用 /api/users/me 替代）
app/api/auth/info/route.test.ts
```

## 关键适配：认证

所有 API routes 中，`getServerSession()` 调用需要替换。open-agents 的模式：

```typescript
// open-agents 原代码
import { getServerSession } from "@/lib/auth/config";
const session = await getServerSession();
if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const userId = session.user.id;
```

改为：

```typescript
// viben 适配后
import { getServerSession } from "@/lib/session/get-server-session";
const session = await getServerSession();
if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const userId = session.user.id;
```

注意：`getServerSession` 的 import 路径变了（从 `@/lib/auth/config` 变为 `@/lib/session/get-server-session`），但函数名和返回值结构保持一致，所以 routes 的业务逻辑不需要改。

## 实施步骤

- [ ] **Step 1: 创建 API 目标目录**

```bash
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/chat/\[chatId\]/stream
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/chat/\[chatId\]/stop
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/chats/\[chatId\]/messages/\[messageId\]
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/chats/\[chatId\]/read
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/chats/\[chatId\]/share
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/chats/\[chatId\]/fork
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/diff/patch
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/diff/cached
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/files/content
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/skills
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/code-editor
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/dev-server
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/share
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/generate-commit-message
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sessions/\[sessionId\]/checks/fix
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/models
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/settings/preferences
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/settings/model-variants
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/usage/rank
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/app/callback
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/app/install
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/branches
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/connection-status
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/create-repo
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/installations/repos
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/orgs/install-status
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/post-link
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/user
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/webhook
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sandbox/activity
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sandbox/extend
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sandbox/reconnect
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sandbox/snapshot
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/sandbox/status
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/generate-pr
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/generate-title
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/transcribe
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/shared/\[shareId\]/status
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/shared/\[shareId\]/markdown
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/vercel/projects/\[idOrName\]/env
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/vercel/repo-projects
```

> 注意：方括号在 zsh 中会被解释为 glob。用引号包裹路径，Windows bash 中也可能有问题。如果 mkdir 失败，逐个创建。

- [ ] **Step 2: 批量复制所有 API route 文件**

逐个复制上述文件列表中的 route.ts 和 route.test.ts。

- [ ] **Step 3: 全局替换 import 路径**

```bash
# 替换 package 引用
grep -rl "@open-agents/" D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/ | xargs sed -i 's/@open-agents\//@viben\//g'
```

- [ ] **Step 4: 替换 getServerSession import**

在所有 API route 中：
- `import { getServerSession } from "@/lib/auth/config"` → `import { getServerSession } from "@/lib/session/get-server-session"`

- [ ] **Step 5: 检查 viben 已有 GitHub API 路由无冲突**

确认 viben 已有的 `/api/github/*` 路由不在复制列表中：

```bash
ls D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/api/github/
```

已有的应保留不动（connect、import、repos、status、callback），只追加新子目录。

- [ ] **Step 6: 验证 — typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

- [ ] **Step 7: Commit**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben
git add apps/web/app/api/
git commit -m "feat: 迁移 open-agents API routes (chat/sessions/models/settings/usage/github/sandbox)"
```
