# T1: Database Schema

> Define and implement Drizzle ORM schema for PostgreSQL.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T1 |
| Dependencies | T0 (Project Setup) |
| Effort | 3 points |
| Priority | P0 (Critical Path) |

---

## Objectives

1. Define all database tables using Drizzle ORM
2. Set up database client
3. Create initial migration
4. Test database connectivity

---

## Deliverables

### 1. Schema File (`apps/web/lib/db/schema.ts`)

Full schema as defined in `platform-upgrade-v2.md`:

**Tables to implement:**
- `users` - User accounts
- `apiKeys` - API key management
- `oauthConnections` - OAuth provider links
- `organizations` - Team accounts
- `orgMembers` - Organization membership
- `mcpPackages` - MCP packages
- `skillPackages` - Skill packages
- `collections` - User collections
- `collectionItems` - Collection contents
- `comments` - Comments on entities
- `favorites` - User favorites
- `ratings` - User ratings
- `packageReleases` - Version releases
- `downloadRecords` - Download analytics
- `workspaces` - User workspaces
- `workspaceEntities` - Workspace configuration

### 2. Database Client (`apps/web/lib/db/index.ts`)

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.POSTGRES_URL!;

// Connection for queries
const queryClient = postgres(connectionString);

// Connection for migrations (single connection)
const migrationClient = postgres(connectionString, { max: 1 });

export const db = drizzle(queryClient, { schema });
export const migrationDb = drizzle(migrationClient, { schema });

export * from './schema';
```

### 3. Drizzle Config (`apps/web/drizzle.config.ts`)

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL!,
  },
});
```

### 4. Type Exports (`apps/web/lib/db/types.ts`)

```typescript
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as schema from './schema';

// Select types (for reading)
export type User = InferSelectModel<typeof schema.users>;
export type ApiKey = InferSelectModel<typeof schema.apiKeys>;
export type McpPackage = InferSelectModel<typeof schema.mcpPackages>;
export type SkillPackage = InferSelectModel<typeof schema.skillPackages>;
export type PackageRelease = InferSelectModel<typeof schema.packageReleases>;
export type Collection = InferSelectModel<typeof schema.collections>;
export type Workspace = InferSelectModel<typeof schema.workspaces>;

// Insert types (for creating)
export type NewUser = InferInsertModel<typeof schema.users>;
export type NewApiKey = InferInsertModel<typeof schema.apiKeys>;
export type NewMcpPackage = InferInsertModel<typeof schema.mcpPackages>;
export type NewSkillPackage = InferInsertModel<typeof schema.skillPackages>;
export type NewPackageRelease = InferInsertModel<typeof schema.packageReleases>;
export type NewCollection = InferInsertModel<typeof schema.collections>;
export type NewWorkspace = InferInsertModel<typeof schema.workspaces>;
```

---

## Schema Design Principles

### 1. Use Text IDs (UUIDs)

```typescript
id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
```

### 2. Timestamps

```typescript
createdAt: timestamp('created_at').defaultNow(),
updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
```

### 3. JSON Fields with Types

```typescript
tags: json('tags').$type<string[]>().default([]),
config: json('config').$type<Record<string, unknown>>(),
```

### 4. Cascading Deletes

```typescript
userId: text('user_id')
  .notNull()
  .references(() => users.id, { onDelete: 'cascade' }),
```

---

## Acceptance Criteria

- [ ] All tables defined in schema.ts
- [ ] `pnpm db:generate` creates migration
- [ ] `pnpm db:push` applies schema to database
- [ ] `pnpm db:studio` opens Drizzle Studio
- [ ] Types exported and usable
- [ ] Relations properly defined

---

## Commands

```bash
# Generate migration
pnpm --filter @browse-mcp/web db:generate

# Push to database (dev)
pnpm --filter @browse-mcp/web db:push

# Open Drizzle Studio
pnpm --filter @browse-mcp/web db:studio
```

---

## Testing

```typescript
// Test database connection
import { db, users } from '@/lib/db';

async function testConnection() {
  const result = await db.select().from(users).limit(1);
  console.log('Database connected:', result);
}
```

---

## Notes

- Use Neon's serverless driver for edge compatibility
- Schema matches `platform-upgrade-v2.md` exactly
- Indexes defined inline in schema for performance
