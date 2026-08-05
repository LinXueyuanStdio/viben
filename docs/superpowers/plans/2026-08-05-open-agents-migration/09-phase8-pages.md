# Phase 8 — 页面创建

**目标**：创建 `/assistant` 和 `/settings/assistant`、`/settings/usage`、`/settings/subscription` 页面，复用已有组件。

## 需要创建的页面文件

### 8.1 `/assistant` — 会话列表页

```
app/(dashboard)/assistant/
├── page.tsx                    # 会话列表（对应 open-agents /sessions）
├── layout.tsx                  # 可选：如果需要嵌套 layout
└── [sessionId]/
    ├── page.tsx                # 重定向到第一个 chat
    ├── codespace/
    │   └── page.tsx            # CodeSpace 页
    └── [chatId]/
        └── page.tsx            # ★ 核心对话页
```

### 8.2 `/settings/assistant` — 助手设置页

```
app/(dashboard)/settings/assistant/
└── page.tsx                    # 合并 profile + preferences + models + connections
```

### 8.3 `/settings/usage` — 用量统计

```
app/(dashboard)/settings/usage/
└── page.tsx                    # 用量统计 + 排行榜
```

### 8.4 `/settings/subscription` — 订阅管理

```
app/(dashboard)/settings/subscription/
└── page.tsx                    # 订阅管理（新页面）
```

## 实施步骤

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p "D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/(dashboard)/assistant/[sessionId]/codespace"
mkdir -p "D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/(dashboard)/assistant/[sessionId]/[chatId]"
mkdir -p "D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/(dashboard)/settings/assistant"
mkdir -p "D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/(dashboard)/settings/usage"
mkdir -p "D:/Document/Github/LinXueyuanStdio/viben/apps/web/app/(dashboard)/settings/subscription"
```

- [ ] **Step 2: 创建 `/assistant/page.tsx`（会话列表）**

参考 open-agents `app/sessions/page.tsx`，直接使用 `SessionsIndexShell`：

```tsx
// D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\assistant\page.tsx
import type { Metadata } from "next";
import { SessionsIndexShell } from "@/app/sessions/sessions-index-shell"; // 如果从 open-agents 复制

export const metadata: Metadata = {
  title: "助手",
  description: "AI 编码助手",
};

export default function AssistantPage() {
  return <SessionsIndexShell />;
}
```

> 注意：`SessionsIndexShell` 是 open-agents 的组件，需要确认它已被复制到 `components/assistant/`。

- [ ] **Step 3: 创建 `/assistant/[sessionId]/page.tsx`（重定向）**

参考 open-agents `app/sessions/[sessionId]/page.tsx`：

```tsx
// D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\assistant\[sessionId]\page.tsx
import { notFound, redirect } from "next/navigation";
import { getChatsBySessionId } from "@/lib/db/sessions";
import { getSessionByIdCached } from "@/lib/db/sessions-cache";
import { getServerSession } from "@/lib/session/get-server-session";

interface SessionPageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = await params;

  const sessionPromise = getServerSession();
  const sessionRecordPromise = getSessionByIdCached(sessionId);

  const session = await sessionPromise;
  if (!session?.user) {
    redirect("/");
  }

  const sessionRecord = await sessionRecordPromise;
  if (!sessionRecord) {
    notFound();
  }

  if (sessionRecord.userId !== session.user.id) {
    redirect("/");
  }

  const chats = await getChatsBySessionId(sessionId);
  const targetChat = chats[0];

  if (!targetChat) {
    notFound();
  }

  redirect(`/assistant/${sessionId}/${targetChat.id}`);
}
```

- [ ] **Step 4: 创建 `/assistant/[sessionId]/[chatId]/page.tsx`（核心对话页）**

参考 open-agents `app/sessions/[sessionId]/chats/[chatId]/page.tsx`，复用已迁移的组件。

页面组合：
- `SessionChatContent`（已迁移到 `components/assistant/`）
- `SessionChatContext`（已迁移）
- 去掉 open-agents 独立的 `sessions/layout.tsx`（viben 用 `DashboardShell`）

```tsx
// D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\assistant\[sessionId]\[chatId]\page.tsx
import { SessionChatContent } from "@/components/assistant/session-chat-content";

interface ChatPageProps {
  params: Promise<{ sessionId: string; chatId: string }>;
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { sessionId, chatId } = await params;

  return (
    <SessionChatContent sessionId={sessionId} chatId={chatId} />
  );
}
```

- [ ] **Step 5: 创建 `/assistant/[sessionId]/codespace/page.tsx`**

参考 open-agents `app/codespace/[sessionId]/page.tsx`。

- [ ] **Step 6: 创建 `/settings/assistant/page.tsx`**

参考 open-agents `app/settings/profile/page.tsx` + `app/settings/preferences/page.tsx`，合并为单页多 tab：

Tab 结构：
1. Profile tab — 显示用户信息 + 用量概览（来自 open-agents `ProfilePage`）
2. Preferences tab — 偏好设置（来自 open-agents `PreferencesSection`）
3. Models tab — 模型选择（来自 open-agents `ModelVariantsSection`）
4. Connections tab — GitHub / Vercel 连接管理（来自 open-agents `AccountsSection` / `VercelSection`）

```tsx
// D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\settings\assistant\page.tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileSection } from "./profile-section";
import { PreferencesSection } from "./preferences-section";
import { ModelsSection } from "./models-section";
import { ConnectionsSection } from "./connections-section";

export default function AssistantSettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">助手设置</h1>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="connections">Connections</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileSection />
        </TabsContent>
        <TabsContent value="preferences">
          <PreferencesSection />
        </TabsContent>
        <TabsContent value="models">
          <ModelsSection />
        </TabsContent>
        <TabsContent value="connections">
          <ConnectionsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 7: 创建 `/settings/usage/page.tsx`**

参考 open-agents `app/settings/usage/page.tsx`，直接使用 `UsageSection` 组件。

- [ ] **Step 8: 创建 `/settings/subscription/page.tsx`**

新页面，显示订阅计划（后续实现）。

```tsx
// D:\Document\Github\LinXueyuanStdio\viben\apps\web\app\(dashboard)\settings\subscription\page.tsx
export default function SubscriptionPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">订阅管理</h1>
      <p className="text-muted-foreground">即将推出</p>
    </div>
  );
}
```

- [ ] **Step 9: 验证 — typecheck + 页面可访问**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm typecheck
```

启动 dev server：
```bash
cd D:/Document/Github/LinXueyuanStdio/viben/apps/web && pnpm dev
```

访问验证：
- `http://localhost:3000/assistant` → 会话列表（可能为空，但页面加载正常）
- `http://localhost:3000/settings/assistant` → 设置页
- `http://localhost:3000/settings/usage` → 用量页
- `http://localhost:3000/settings/subscription` → 订阅页

- [ ] **Step 10: Commit**

```bash
cd D:/Document/Github/LinXueyuanStdio/viben
git add apps/web/app/\(dashboard\)/assistant/
git add apps/web/app/\(dashboard\)/settings/assistant/
git add apps/web/app/\(dashboard\)/settings/usage/
git add apps/web/app/\(dashboard\)/settings/subscription/
git commit -m "feat: 创建 /assistant 和 settings 页面"
```
