---
sidebar_position: 3
---

# 数据库指南

> Viben 项目数据库模式和约定

---

## 概述

Viben 项目使用两种数据存储策略：

1. **Web 应用 (`apps/web`)**：PostgreSQL + Drizzle ORM
2. **Desktop/Core (`packages/core`)**：YAML 文件存储

---

## Web 应用数据库

### 技术栈

| 技术 | 用途 |
|------|------|
| PostgreSQL | 主数据库（使用 Neon） |
| Drizzle ORM | 类型安全的 ORM |
| Drizzle Kit | 迁移工具 |

### 数据库命令

```bash
cd apps/web

# 推送 schema 到数据库（交互式）
pnpm db:push

# 生成迁移文件
pnpm db:generate

# 运行迁移
pnpm db:migrate

# 打开 Drizzle Studio 查看数据
pnpm db:studio
```

### Schema 定义

Schema 文件位于 `apps/web/lib/db/schema.ts`：

```typescript
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  githubUsername: text('github_username'),
  emailVerified: boolean('email_verified').default(false),
  role: text('role').default('user'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const oauthConnections = pgTable('oauth_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  provider: text('provider').notNull(), // 'github', 'google'
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

### 查询模式

```typescript
import { db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { users, oauthConnections } from '@/lib/db/schema';

// 查询单条记录
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
});

// 关联查询
const userWithConnections = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    oauthConnections: true,
  },
});

// 插入记录
await db.insert(users).values({
  id: generateId(),
  email: 'user@example.com',
  username: 'username',
});

// 更新记录
await db.update(users)
  .set({ displayName: 'New Name' })
  .where(eq(users.id, userId));

// 删除记录
await db.delete(users).where(eq(users.id, userId));
```

---

## Desktop/Core 文件存储

### 存储结构

```
~/.viben/
├── agents/                    # 智能体配置
│   └── <agent-id>/
│       └── config.yaml
├── providers/                 # 提供商配置
│   ├── anthropic.yaml
│   └── openai.yaml
├── models.yaml               # 模型配置
├── channels.yaml             # 通道配置
├── sessions/                 # 会话数据
└── telemetry/                # 遥测数据
    ├── traces/
    ├── metrics/
    └── logs/
```

### YAML 配置格式

**智能体配置** (`~/.viben/agents/<id>/config.yaml`):

```yaml
id: my-agent
name: My Agent
description: A helpful assistant
model: claude-3-sonnet
provider: anthropic
system_prompt: You are a helpful assistant.
temperature: 0.7
max_tokens: 4096
```

**模型配置** (`~/.viben/models.yaml`):

```yaml
default: claude-3-sonnet

models:
  - id: claude-3-sonnet
    provider: anthropic
    enabled: true

  - id: my-custom-model
    name: My Custom Model
    provider: openai
    base_model: gpt-4
    temperature: 0.7
```

---

## 命名约定

### 数据库表名

| 规则 | 示例 |
|------|------|
| 使用复数形式 | `users`, `oauth_connections` |
| 使用 snake_case | `oauth_connections` |
| 关联表使用下划线连接 | `user_packages` |

### 列名

| 规则 | 示例 |
|------|------|
| 使用 snake_case | `created_at`, `user_id` |
| 外键以 `_id` 结尾 | `user_id`, `package_id` |
| 布尔值使用 `is_` 或 `has_` 前缀 | `is_active`, `has_verified` |
| 时间戳使用 `_at` 后缀 | `created_at`, `updated_at` |

### YAML 字段名

| 规则 | 示例 |
|------|------|
| 使用 snake_case | `system_prompt`, `max_tokens` |
| 与 API 参数保持一致 | `workspace_path` |

---

## 迁移管理

### 创建迁移

```bash
cd apps/web

# 修改 schema.ts 后生成迁移
pnpm db:generate
```

迁移文件存储在 `apps/web/lib/db/migrations/`。

### 运行迁移

```bash
# 开发环境 - 直接推送 schema
pnpm db:push

# 生产环境 - 运行迁移
pnpm db:migrate
```

### 处理 Schema 错误

遇到 "column X does not exist" 错误时：

```bash
cd apps/web && pnpm db:push
```

此命令需要手动交互确认 schema 变更。

---

## 常见错误

### 错误 1：数据库连接失败

```
Error: No database connection string was provided to `neon()`
```

**解决方案**：设置 `POSTGRES_URL` 环境变量

### 错误 2：表不存在

```
Error: relation 'users' does not exist
```

**解决方案**：运行 `pnpm db:push` 推送 schema

### 错误 3：唯一约束冲突

```
Error: duplicate key value violates unique constraint
```

**解决方案**：插入前检查记录是否存在

---

## 相关文档

- [Drizzle ORM 文档](https://orm.drizzle.team/)
- [Neon 文档](https://neon.tech/docs)
- [Vercel 部署](./deployment/vercel.md)
