---
sidebar_position: 3
---

# Database Guidelines

> Viben project database schema and conventions

---

## Overview

Viben project uses two data storage strategies:

1. **Web Application (`apps/web`)**: PostgreSQL + Drizzle ORM
2. **Desktop/Core (`packages/core`)**: YAML file storage

---

## Web Application Database

### Tech Stack

| Technology | Purpose |
|------------|---------|
| PostgreSQL | Primary database (using Neon) |
| Drizzle ORM | Type-safe ORM |
| Drizzle Kit | Migration tool |

### Database Commands

```bash
cd apps/web

# Push schema to database (interactive)
pnpm db:push

# Generate migration files
pnpm db:generate

# Run migrations
pnpm db:migrate

# Open Drizzle Studio to view data
pnpm db:studio
```

### Schema Definition

Schema files are located at `apps/web/lib/db/schema.ts`:

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

### Query Patterns

```typescript
import { db } from '@/lib/db';
import { eq, and } from 'drizzle-orm';
import { users, oauthConnections } from '@/lib/db/schema';

// Query single record
const user = await db.query.users.findFirst({
  where: eq(users.id, userId),
});

// Query with relations
const userWithConnections = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: {
    oauthConnections: true,
  },
});

// Insert record
await db.insert(users).values({
  id: generateId(),
  email: 'user@example.com',
  username: 'username',
});

// Update record
await db.update(users)
  .set({ displayName: 'New Name' })
  .where(eq(users.id, userId));

// Delete record
await db.delete(users).where(eq(users.id, userId));
```

---

## Desktop/Core File Storage

### Storage Structure

```
~/.viben/
├── agents/                    # Agent configurations
│   └── <agent-id>/
│       └── config.yaml
├── providers/                 # Provider configurations
│   ├── anthropic.yaml
│   └── openai.yaml
├── models.yaml               # Model configurations
├── channels.yaml             # Channel configurations
├── sessions/                 # Session data
└── telemetry/                # Telemetry data
    ├── traces/
    ├── metrics/
    └── logs/
```

### YAML Configuration Format

**Agent Configuration** (`~/.viben/agents/<id>/config.yaml`):

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

**Model Configuration** (`~/.viben/models.yaml`):

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

## Naming Conventions

### Database Table Names

| Rule | Example |
|------|---------|
| Use plural form | `users`, `oauth_connections` |
| Use snake_case | `oauth_connections` |
| Join tables use underscore | `user_packages` |

### Column Names

| Rule | Example |
|------|---------|
| Use snake_case | `created_at`, `user_id` |
| Foreign keys end with `_id` | `user_id`, `package_id` |
| Booleans use `is_` or `has_` prefix | `is_active`, `has_verified` |
| Timestamps use `_at` suffix | `created_at`, `updated_at` |

### YAML Field Names

| Rule | Example |
|------|---------|
| Use snake_case | `system_prompt`, `max_tokens` |
| Consistent with API parameters | `workspace_path` |

---

## Migration Management

### Creating Migrations

```bash
cd apps/web

# Generate migration after modifying schema.ts
pnpm db:generate
```

Migration files are stored in `apps/web/lib/db/migrations/`.

### Running Migrations

```bash
# Development - push schema directly
pnpm db:push

# Production - run migrations
pnpm db:migrate
```

### Handling Schema Errors

When encountering "column X does not exist" error:

```bash
cd apps/web && pnpm db:push
```

This command requires manual interaction to confirm schema changes.

---

## Common Errors

### Error 1: Database Connection Failed

```
Error: No database connection string was provided to `neon()`
```

**Solution**: Set the `POSTGRES_URL` environment variable

### Error 2: Table Does Not Exist

```
Error: relation 'users' does not exist
```

**Solution**: Run `pnpm db:push` to push schema

### Error 3: Unique Constraint Violation

```
Error: duplicate key value violates unique constraint
```

**Solution**: Check if record exists before inserting

---

## Related Documentation

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Neon Documentation](https://neon.tech/docs)
- [Vercel Deployment](./deployment/vercel.md)
