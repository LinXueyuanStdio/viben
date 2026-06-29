# S6: 种子数据

## 概述

创建 TypeScript 种子数据脚本，为动态广场、通知、历史记录、排行榜等页面填充演示数据，避免在开发环境中显示空态。

## 当前状态

以下页面已完整实现数据查询和渲染，但在空数据库中没有数据，始终显示空态：
- 动态广场（`/moment`）
- 通知（`/notifications`）
- 历史记录（`/history`）
- 排行榜（`/leaderboard`）

## 设计

### 脚本位置

`apps/web/lib/db/seed.ts`

### 运行方式

```bash
cd apps/web && pnpm db:seed
```

在 `apps/web/package.json` 中新增脚本：
```json
{
  "scripts": {
    "db:seed": "tsx lib/db/seed.ts"
  }
}
```

### 种子数据内容

#### 1. Demo 用户

创建 3 个演示用户（如不存在）：
```typescript
const demoUsers = [
  { userSlug: "demo-author", displayName: "Demo作者", email: "demo@viben.local" },
  { userSlug: "alice", displayName: "Alice", email: "alice@viben.local" },
  { userSlug: "bob", displayName: "Bob", email: "bob@viben.local" },
]
```

#### 2. 公开页面

为每个 demo 用户创建 2-3 个 published pages，用于排行榜和历史记录的数据源。

#### 3. 动态（Moments）

创建 10 条 demo moments：
- 不同 kind：post, page_update, repost
- 不同用户
- 时间戳在过去 7 天内
- 含 like/comment/repost 计数

#### 4. 通知（Notifications）

创建 8 条通知：
- 类型：comment, follow, page_published
- 关联到 demo 用户

#### 5. 历史记录（Browse History）

创建 15 条浏览记录：
- 关联到 demo 页面和 demo 用户
- 时间戳在过去 30 天内
- 不同来源：home, moment, search

### 幂等性

- 脚本可重复运行
- 每次运行检查数据是否已存在（按 uid 或唯一字段去重）
- 存在则跳过，不存在则插入

### 检测已有的 drizzle 实例

```typescript
import { db } from "@/lib/db"
import { users, publishedPages, moments, notifications, browseHistory } from "@/lib/db/schema"
```

## 涉及文件

| 层 | 文件 | 操作 |
|----|------|------|
| Script | `lib/db/seed.ts` | 新增 |
| Config | `apps/web/package.json` | 修改（新增 db:seed 脚本） |

## 不在范围内

- 生产环境的种子数据（仅用于开发/测试）
- 覆盖所有数据表（仅填充上述 4 个页面的数据源）
- 数据迁移脚本
