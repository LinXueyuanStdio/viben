# Phase 6 — Hooks 迁移

**目标**：将 open-agents 的所有 hooks 复制到 viben `hooks/assistant/`，重写 `use-session`。

## 需要复制的 Hooks

### 直接复制（只改 import 路径）

```
hooks/use-sessions.ts                    → hooks/assistant/use-sessions.ts
hooks/use-session-chats.ts              → hooks/assistant/use-session-chats.ts
hooks/use-session-chats.test.ts         → hooks/assistant/use-session-chats.test.ts
hooks/use-session-files.ts              → hooks/assistant/use-session-files.ts
hooks/use-session-diff.ts              → hooks/assistant/use-session-diff.ts
hooks/use-session-git-status.ts         → hooks/assistant/use-session-git-status.ts
hooks/use-session-skills.ts            → hooks/assistant/use-session-skills.ts
hooks/use-model-options.ts             → hooks/assistant/use-model-options.ts
hooks/use-user-preferences.ts          → hooks/assistant/use-user-preferences.ts
hooks/use-audio-recording.ts           → hooks/assistant/use-audio-recording.ts
hooks/use-slash-commands.ts            → hooks/assistant/use-slash-commands.ts
hooks/use-file-suggestions.ts          → hooks/assistant/use-file-suggestions.ts
hooks/use-text-attachments.ts          → hooks/assistant/use-text-attachments.ts
hooks/use-image-attachments.ts         → hooks/assistant/use-image-attachments.ts
hooks/use-github-connection-status.ts   → hooks/assistant/use-github-connection-status.ts
hooks/use-installation-repos.ts        → hooks/assistant/use-installation-repos.ts
hooks/use-vercel-repo-projects.ts      → hooks/assistant/use-vercel-repo-projects.ts
hooks/use-leaderboard-rank.ts          → hooks/assistant/use-leaderboard-rank.ts
hooks/use-scroll-to-bottom.ts          → hooks/assistant/use-scroll-to-bottom.ts
hooks/use-background-chat-notifications.tsx → hooks/assistant/use-background-chat-notifications.tsx
hooks/use-background-chat-notifications.test.ts → hooks/assistant/
```

### Chat 专用 hooks

```
hooks/use-session-chat-runtime.ts  → hooks/assistant/chat/use-session-chat-runtime.ts
hooks/use-stream-recovery.ts       → hooks/assistant/chat/use-stream-recovery.ts
hooks/use-code-editor.ts           → hooks/assistant/chat/use-code-editor.ts
hooks/use-dev-server.ts            → hooks/assistant/chat/use-dev-server.ts
hooks/use-auto-commit-status.ts    → hooks/assistant/chat/use-auto-commit-status.ts
```

### 需要重写的 Hook

**`hooks/assistant/use-session.ts`** — 完全重写。

open-agents 原代码使用 Better Auth 的 `useSession`：

```typescript
// open-agents 原代码模式
import { useSession as useBetterAuthSession } from "@/lib/auth/client";
// useBetterAuthSession() 返回 { data: { user: ... }, isPending: ... }
```

改为 viben 版本：

```typescript
// hooks/assistant/use-session.ts — viben 版本
"use client";

import useSWR from "swr";
import type { Session } from "@/lib/auth/types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useSession() {
  const { data, error, isLoading, mutate } = useSWR("/api/users/me", fetcher);

  const user = data?.user ?? null;

  return {
    session: user
      ? {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            name: user.displayName,
            avatar: user.avatarUrl,
            role: user.role,
            userSlug: user.userSlug,
          },
        }
      : null,
    loading: isLoading,
    isAdmin: user?.role === "admin",
    refresh: () => mutate(),
  };
}
```

### 不迁移的 Hook

`hooks/use-mobile.ts` — viben 已有同功能 hook。

## 实施步骤

- [ ] **Step 1: 创建目标目录**

```bash
mkdir -p D:/Document/Github/LinXueyuanStdio/viben/apps/web/hooks/assistant/chat
```

- [ ] **Step 2: 批量复制 hooks**

将所有 A 类 hook 文件从 open-agents 复制到 viben `hooks/assistant/`。

- [ ] **Step 3: 重写 use-session.ts**

按照上述代码模板，创建 `D:\Document\Github\LinXueyuanStdio\viben\apps\web\hooks\assistant\use-session.ts`。

- [ ] **Step 4: 全局替换 import 路径**

```bash
grep -rl "@open-agents/" D:/Document/Github/LinXueyuanStdio/viben/apps/web/hooks/assistant/ | xargs sed -i 's/@open-agents\//@viben\//g'
```

将所有 hook 中对 `@/hooks/use-session` 的引用改为 `@/hooks/assistant/use-session`。

- [ ] **Step 5: 验证 — typecheck**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben
git add apps/web/hooks/assistant/
git commit -m "feat: 迁移 open-agents hooks 到 hooks/assistant/，重写 use-session"
```
