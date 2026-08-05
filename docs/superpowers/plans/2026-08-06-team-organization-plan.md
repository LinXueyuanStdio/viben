# Team Organization 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 apps/web 里实现 GitHub Organization 风格的 Team/Project 功能

**Architecture:** Team 作为 users 表的虚拟用户（`type='team'`），与普通 user 共享 `/[slug]` 路由。Project 是 team 下的发布物容器，可挂载多个 page。分 4 个阶段实现，每阶段独立可测试。

**Tech Stack:** Next.js App Router, Drizzle ORM (PostgreSQL/Neon), React Server Components, shadcn/ui, Zod, SWR

**Specs:**
- 设计文档: `docs/superpowers/specs/2026-08-06-team-organization-design.md`
- 需求文档: `docs/superpowers/specs/2026-08-06-team-requirements.md`

## Global Constraints

- 所有 API query 参数和 body 使用 **snake_case**
- 所有 API 使用 **project_slug**（非 project_id）
- 所有 API 使用 **user_slug**（非 user_id）
- 禁止内联 import type 语法，禁止动态 import
- 中文翻译：agent→智能体，token→词元
- Tailwind v4：不要 `hsl()` 包裹 oklch CSS 变量，CVA 中避免 data-* 变体
- Team settings 单列布局，无 sidebar
- Drizzle 查询必须显式列名，不用 `db.select().from()`

---

## Phase 1: DB Schema + API

### Task 1.1: 修改 users 表 schema 并跑 migration

**Files:**
- Modify: `apps/web/lib/db/schema.ts:21-67`
- Create: `apps/web/lib/db/migrations/*.sql` (auto-generated)

**Interfaces:**
- Produces: `users.type` 字段 — `text('type', { enum: ['user', 'team'] }).default('user').notNull()`
- Produces: `UserType` type — `type UserType = 'user' | 'team'`

- [ ] **Step 1: 在 users 表 Drizzle 定义中添加 `type` 字段**

```typescript
// 在 apps/web/lib/db/schema.ts 的 users 定义中，role 字段后添加
// Account type - distinguishes personal users from team accounts
type: text('type', {
  enum: ['user', 'team'],
}).default('user').notNull(),
```

- [ ] **Step 2: 跑数据库 migration**

```bash
cd apps/web && pnpm db:push
```

此命令需要手动交互确认 schema 变更。确认 users 表新增 `type` 列，默认值为 `'user'`。

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/db/schema.ts apps/web/lib/db/migrations/
git commit -m "feat: add type field to users table for team accounts"
```

---

### Task 1.2: 创建 team_members 表

**Files:**
- Modify: `apps/web/lib/db/schema.ts`

**Interfaces:**
- Produces: `teamMembers` table
- Produces: `teamMembersRelations` — one-to-many to users

- [ ] **Step 1: 在 schema.ts 中添加 team_members 表定义**

```typescript
// 紧接在 apiKeys 之前添加

export const teamMembers = pgTable(
  'team_members',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    teamId: text('team_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', {
      enum: ['owner', 'member'],
    }).default('member').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('team_members_team_user_idx').on(table.teamId, table.userId),
    index('team_members_team_id_idx').on(table.teamId),
    index('team_members_user_id_idx').on(table.userId),
  ]
);

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(users, {
    fields: [teamMembers.teamId],
    references: [users.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));
```

- [ ] **Step 2: 确保 db/index.ts 导出新表**

检查 `apps/web/lib/db/index.ts` 是否已通过 `export * from './schema'` 自动导出，如果是则无需修改。

- [ ] **Step 3: 跑 migration**

```bash
cd apps/web && pnpm db:push
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/db/schema.ts apps/web/lib/db/migrations/
git commit -m "feat: add team_members table"
```

---

### Task 1.3: 创建 projects 和 project_pages 表

**Files:**
- Modify: `apps/web/lib/db/schema.ts`

**Interfaces:**
- Produces: `projects` table — id, team_id, name, project_slug, description, default_page_id, created_by, created_at, updated_at
- Produces: `projectPages` table — id, project_id, page_id, added_by, added_at
- Produces: `projectsRelations` — one-to-many to users (team), one-to-many to projectPages
- Produces: `projectPagesRelations` — one-to-one to projects, one-to-one to publishedPages

- [ ] **Step 1: 在 schema.ts 末尾添加 projects 表定义**

```typescript
export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    teamId: text('team_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    projectSlug: text('project_slug').notNull(),
    description: text('description'),
    defaultPageId: text('default_page_id'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('projects_team_slug_idx').on(table.teamId, table.projectSlug),
    index('projects_team_id_idx').on(table.teamId),
  ]
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  team: one(users, {
    fields: [projects.teamId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  pages: many(projectPages),
}));

export const projectPages = pgTable(
  'project_pages',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    pageId: text('page_id')
      .notNull()
      .references(() => publishedPages.id), // 复用现有 published_pages，不设 onDelete cascade
    addedBy: text('added_by')
      .notNull()
      .references(() => users.id),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('project_pages_unique_idx').on(table.projectId, table.pageId),
    index('project_pages_project_id_idx').on(table.projectId),
  ]
);

export const projectPagesRelations = relations(projectPages, ({ one }) => ({
  project: one(projects, {
    fields: [projectPages.projectId],
    references: [projects.id],
  }),
  page: one(publishedPages, {
    fields: [projectPages.pageId],
    references: [publishedPages.id],
  }),
  addedByUser: one(users, {
    fields: [projectPages.addedBy],
    references: [users.id],
  }),
}));
```

确保 `projectPages` 定义在 `projects` 之后（因为 `projectPages` 依赖 `projects` 和 `publishedPages`）。

- [ ] **Step 2: 跑 migration**

```bash
cd apps/web && pnpm db:push
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/db/schema.ts apps/web/lib/db/migrations/
git commit -m "feat: add projects and project_pages tables"
```

---

### Task 1.4: Team slug 校验 API — GET /api/teams/check-slug

**Files:**
- Create: `apps/web/app/api/teams/check-slug/route.ts`

**Interfaces:**
- Produces: `GET /api/teams/check-slug?slug=xxx` → `{ available: boolean }` 或 `{ available: false, message: string }`

- [ ] **Step 1: 创建 API route**

```typescript
import { NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';

/**
 * 校验 team slug 是否可用
 * @summary 校验 team slug
 * @query slug: string
 * @response 200: { available: true } | { available: false, message: string }
 * @tag Teams
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug || slug.length < 1) {
    return NextResponse.json(
      { available: false, message: 'Slug is required' },
      { status: 400 }
    );
  }

  // slug 格式校验：只允许小写字母、数字、连字符
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.json(
      { available: false, message: 'Slug must contain only lowercase letters, numbers, and hyphens' },
      { status: 400 }
    );
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
    columns: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { available: false, message: `The name '${slug}' is already taken.` },
      { status: 200 }
    );
  }

  return NextResponse.json({ available: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/teams/
git commit -m "feat: add team slug check API"
```

---

### Task 1.5: Team CRUD API

**Files:**
- Create: `apps/web/app/api/teams/route.ts`
- Create: `apps/web/app/api/teams/[team_slug]/route.ts`

**Interfaces:**
- Consumes: `teamMembers` table (Task 1.2)
- Produces: `POST /api/teams` — 创建团队（建 users(type=team) + team_members(owner)）
- Produces: `GET /api/teams` — 当前用户的团队列表
- Produces: `GET /api/teams/{team_slug}` — 团队详情 + 当前用户 role
- Produces: `PATCH /api/teams/{team_slug}` — 更新团队设置（需 owner）
- Produces: `DELETE /api/teams/{team_slug}` — 删除团队（需 owner）

- [ ] **Step 1: 创建 `apps/web/app/api/teams/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

/**
 * GET /api/teams — 获取当前用户所属的团队列表
 */
export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const memberships = await db
    .select({
      teamId: teamMembers.teamId,
      teamSlug: users.userSlug,
      teamName: users.displayName,
      teamAvatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.teamId, users.id))
    .where(eq(teamMembers.userId, session.userId))
    .orderBy(teamMembers.joinedAt);

  return NextResponse.json({ teams: memberships });
}

/**
 * POST /api/teams — 创建团队
 * Body: { name: string, slug: string }
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, slug } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  // 校验 slug 唯一性
  const existing = await db.query.users.findFirst({
    where: eq(users.userSlug, slug),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: `The name '${slug}' is already taken.` },
      { status: 409 }
    );
  }

  const teamId = crypto.randomUUID();

  // 创建 team user 记录 + 加创建者为 owner（事务）
  await db.insert(users).values({
    id: teamId,
    email: session.email,           // 复用创建者 email
    username: slug,
    userSlug: slug,
    displayName: name,
    type: 'team',
    role: 'user',
    emailVerified: true,            // team 不需要邮箱验证
  });

  await db.insert(teamMembers).values({
    teamId,
    userId: session.userId,
    role: 'owner',
  });

  return NextResponse.json({
    success: true,
    team_slug: slug,
    team_id: teamId,
  });
}
```

- [ ] **Step 2: 创建 `apps/web/app/api/teams/[team_slug]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

/**
 * 从 team_slug 查 team 记录，返回 user 行 + 当前用户 role
 */
async function getTeamBySlug(teamSlug: string, userId?: string) {
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, 'team')),
    columns: {
      id: true, userSlug: true, displayName: true, avatarUrl: true,
      bio: true, websiteUrl: true, createdAt: true,
    },
  });
  if (!team) return null;

  let currentUserRole: string | null = null;
  if (userId) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)),
      columns: { role: true },
    });
    currentUserRole = membership?.role ?? null;
  }

  return { ...team, currentUserRole };
}

/**
 * 检查是否是 owner
 */
async function requireOwner(teamSlug: string, userId: string) {
  const membership = await db
    .select({ role: teamMembers.role })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.teamId, users.id))
    .where(and(eq(users.userSlug, teamSlug), eq(teamMembers.userId, userId)))
    .limit(1);

  if (!membership.length || membership[0].role !== 'owner') {
    return false;
  }
  return true;
}

/**
 * GET /api/teams/{team_slug} — 团队详情
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const session = await getSession();
  const team = await getTeamBySlug(team_slug, session?.userId);
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }
  return NextResponse.json({ team });
}

/**
 * PATCH /api/teams/{team_slug} — 更新团队设置
 * Body: { display_name?: string, bio?: string, avatar_url?: string, website_url?: string }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isOwner = await requireOwner(team_slug, session.userId);
  if (!isOwner) {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if (body.display_name !== undefined) updateData.displayName = body.display_name;
  if (body.bio !== undefined) updateData.bio = body.bio;
  if (body.avatar_url !== undefined) updateData.avatarUrl = body.avatar_url;
  if (body.website_url !== undefined) updateData.websiteUrl = body.website_url;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  await db.update(users)
    .set(updateData)
    .where(eq(users.id, team.id));

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/teams/{team_slug} — 删除团队
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isOwner = await requireOwner(team_slug, session.userId);
  if (!isOwner) {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // users 表的 ON DELETE CASCADE 会自动清理 team_members
  await db.delete(users).where(eq(users.id, team.id));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/teams/
git commit -m "feat: add team CRUD API"
```

---

### Task 1.6: Team Members API

**Files:**
- Create: `apps/web/app/api/teams/[team_slug]/members/route.ts`
- Create: `apps/web/app/api/teams/[team_slug]/members/[user_slug]/route.ts`
- Create: `apps/web/app/api/teams/[team_slug]/members/[user_slug]/role/route.ts`
- Create: `apps/web/app/api/teams/[team_slug]/leave/route.ts`

**Interfaces:**
- Produces: `POST` — 邀请成员（需 owner）
- Produces: `DELETE /members/{user_slug}` — 移除成员（需 owner）
- Produces: `PUT /members/{user_slug}/role` — 修改成员角色（需 owner）
- Produces: `POST /leave` — 离开团队

- [ ] **Step 1: 创建 `apps/web/app/api/teams/[team_slug]/members/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

/**
 * 辅助：通过 team_slug 查 team id 并验证当前用户是 owner
 */
async function resolveTeamAndCheckOwner(teamSlug: string, userId: string) {
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) return { team: null, isOwner: false };

  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId)),
    columns: { role: true },
  });

  return { team, isOwner: membership?.role === 'owner' };
}

/**
 * GET /api/teams/{team_slug}/members — 获取成员列表
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const members = await db
    .select({
      userId: teamMembers.userId,
      userSlug: users.userSlug,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, team.id))
    .orderBy(teamMembers.joinedAt);

  return NextResponse.json({ members });
}

/**
 * POST /api/teams/{team_slug}/members — 邀请成员
 * Body: { user_slug: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { team, isOwner } = await resolveTeamAndCheckOwner(team_slug, session.userId);
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }
  if (!isOwner) {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const body = await request.json();
  const { user_slug } = body;
  if (!user_slug) {
    return NextResponse.json({ error: 'user_slug is required' }, { status: 400 });
  }

  const targetUser = await db.query.users.findFirst({
    where: and(eq(users.userSlug, user_slug), eq(users.type, 'user')),
    columns: { id: true },
  });
  if (!targetUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // 检查是否已是成员
  const existing = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, targetUser.id)),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'Already a member' }, { status: 409 });
  }

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId: targetUser.id,
    role: 'member',
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: 创建 `apps/web/app/api/teams/[team_slug]/members/[user_slug]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

/**
 * DELETE /api/teams/{team_slug}/members/{user_slug} — 移除成员（需 owner）
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; user_slug: string }> }
) {
  const { team_slug, user_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 验证 team 和当前用户的 owner 权限
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const ownerCheck = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  if (!ownerCheck || ownerCheck.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.userSlug, user_slug),
    columns: { id: true },
  });
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  // 不允许移除自己（owner 要通过 leave 接口离开）
  if (targetUser.id === session.userId) {
    return NextResponse.json({ error: 'Cannot remove yourself. Use leave endpoint.' }, { status: 400 });
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, targetUser.id)));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 创建 `apps/web/app/api/teams/[team_slug]/members/[user_slug]/role/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

/**
 * PUT /api/teams/{team_slug}/members/{user_slug}/role — 修改成员角色（需 owner）
 * Body: { role: 'owner' | 'member' }
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; user_slug: string }> }
) {
  const { team_slug, user_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const ownerCheck = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  if (!ownerCheck || ownerCheck.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 });
  }

  const { role } = await request.json();
  if (role !== 'owner' && role !== 'member') {
    return NextResponse.json({ error: 'role must be owner or member' }, { status: 400 });
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.userSlug, user_slug),
    columns: { id: true },
  });
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await db
    .update(teamMembers)
    .set({ role })
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, targetUser.id)));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: 创建 `apps/web/app/api/teams/[team_slug]/leave/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, users, teamMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and, sql } from 'drizzle-orm';

/**
 * POST /api/teams/{team_slug}/leave — 离开团队
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  // Owner 离开前检查是否还有其他 owner
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 404 });

  if (membership.role === 'owner') {
    const ownerCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.role, 'owner')));
    const count = Number(ownerCount[0]?.count ?? 0);
    if (count <= 1) {
      return NextResponse.json(
        { error: 'Cannot leave: you are the only owner. Transfer ownership first.' },
        { status: 400 }
      );
    }
  }

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/teams/
git commit -m "feat: add team members API"
```

---

### Task 1.7: Projects CRUD API

**Files:**
- Create: `apps/web/app/api/teams/[team_slug]/projects/route.ts`
- Create: `apps/web/app/api/teams/[team_slug]/projects/[project_slug]/route.ts`

**Interfaces:**
- Consumes: `projects` table (Task 1.3), `teamMembers` table (Task 1.2)
- Produces: `GET /api/teams/{team_slug}/projects` — 团队下 projects 列表
- Produces: `POST /api/teams/{team_slug}/projects` — 创建 Project（需 team member）
- Produces: `GET /api/teams/{team_slug}/projects/{project_slug}` — Project 详情
- Produces: `PATCH` — 更新 Project（需 owner 或创建者）
- Produces: `DELETE` — 删除 Project（需 owner 或创建者）

- [ ] **Step 1: 创建 `apps/web/app/api/teams/[team_slug]/projects/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, users, teamMembers, projects } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

async function resolveTeam(teamSlug: string) {
  return db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, 'team')),
    columns: { id: true, displayName: true, userSlug: true },
  });
}

/**
 * GET /api/teams/{team_slug}/projects — 团队下 projects 列表
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const team = await resolveTeam(team_slug);
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  const projectList = await db
    .select({
      id: projects.id,
      name: projects.name,
      projectSlug: projects.projectSlug,
      description: projects.description,
      defaultPageId: projects.defaultPageId,
      createdBy: projects.createdBy,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.teamId, team.id))
    .orderBy(projects.updatedAt);

  return NextResponse.json({ projects: projectList });
}

/**
 * POST /api/teams/{team_slug}/projects — 创建 Project
 * Body: { name: string, project_slug: string, description?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ team_slug: string }> }
) {
  const { team_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const team = await resolveTeam(team_slug);
  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // 检查是否团队成员
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  if (!membership) {
    return NextResponse.json({ error: 'Not a team member' }, { status: 403 });
  }

  const body = await request.json();
  const { name, project_slug, description } = body;
  if (!name || !project_slug) {
    return NextResponse.json({ error: 'name and project_slug are required' }, { status: 400 });
  }

  // 校验 project_slug 在该 team 内唯一
  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.teamId, team.id), eq(projects.projectSlug, project_slug)),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'Project slug already exists in this team' },
      { status: 409 }
    );
  }

  const projectId = crypto.randomUUID();
  await db.insert(projects).values({
    id: projectId,
    teamId: team.id,
    name,
    projectSlug: project_slug,
    description: description ?? null,
    createdBy: session.userId,
  });

  return NextResponse.json({ success: true, project_slug, project_id: projectId });
}
```

- [ ] **Step 2: 创建 `apps/web/app/api/teams/[team_slug]/projects/[project_slug]/route.ts`**

```typescript
import { NextResponse } from 'next/server';
import { db, users, teamMembers, projects } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

async function resolveProject(teamSlug: string, projectSlug: string) {
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) return { team: null, project: null };

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.teamId, team.id), eq(projects.projectSlug, projectSlug)),
    columns: {
      id: true, name: true, projectSlug: true, description: true,
      defaultPageId: true, createdBy: true, createdAt: true, updatedAt: true, teamId: true,
    },
  });
  return { team, project };
}

/**
 * GET /api/teams/{team_slug}/projects/{project_slug} — Project 详情
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; project_slug: string }> }
) {
  const { team_slug, project_slug } = await params;
  const { project } = await resolveProject(team_slug, project_slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json({ project });
}

/**
 * PATCH /api/teams/{team_slug}/projects/{project_slug} — 更新 Project
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; project_slug: string }> }
) {
  const { team_slug, project_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { team, project } = await resolveProject(team_slug, project_slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // 权限：team owner 或 project 创建者
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team!.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  const isOwner = membership?.role === 'owner';
  const isCreator = project.createdBy === session.userId;
  if (!isOwner && !isCreator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.default_page_id !== undefined) updateData.defaultPageId = body.default_page_id;

  await db.update(projects).set(updateData).where(eq(projects.id, project.id));

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/teams/{team_slug}/projects/{project_slug} — 删除 Project
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; project_slug: string }> }
) {
  const { team_slug, project_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { team, project } = await resolveProject(team_slug, project_slug);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // 权限：team owner 或 project 创建者
  const membership = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, team!.id), eq(teamMembers.userId, session.userId)),
    columns: { role: true },
  });
  const isOwner = membership?.role === 'owner';
  const isCreator = project.createdBy === session.userId;
  if (!isOwner && !isCreator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.delete(projects).where(eq(projects.id, project.id));

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: 创建 Project Pages 关联 API**

创建 `apps/web/app/api/teams/[team_slug]/projects/[project_slug]/pages/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { db, users, projects, projectPages, publishedPages } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

async function resolveProject(teamSlug: string, projectSlug: string) {
  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, 'team')),
    columns: { id: true },
  });
  if (!team) return null;

  return db.query.projects.findFirst({
    where: and(eq(projects.teamId, team.id), eq(projects.projectSlug, projectSlug)),
    columns: { id: true, name: true, projectSlug: true },
  });
}

/**
 * GET /api/teams/{team_slug}/projects/{project_slug}/pages — Project 下的 pages 列表
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; project_slug: string }> }
) {
  const { team_slug, project_slug } = await params;
  const project = await resolveProject(team_slug, project_slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const pages = await db
    .select({
      pageId: publishedPages.id,
      uid: publishedPages.uid,
      title: publishedPages.title,
      description: publishedPages.description,
      coverUrl: publishedPages.coverUrl,
      authorSlug: publishedPages.authorSlug,
      lastPublishedAt: publishedPages.lastPublishedAt,
      addedAt: projectPages.addedAt,
    })
    .from(projectPages)
    .innerJoin(publishedPages, eq(projectPages.pageId, publishedPages.id))
    .where(eq(projectPages.projectId, project.id))
    .orderBy(projectPages.addedAt);

  return NextResponse.json({ pages });
}

/**
 * POST /api/teams/{team_slug}/projects/{project_slug}/pages — 添加 page 到 Project
 * Body: { page_id: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ team_slug: string; project_slug: string }> }
) {
  const { team_slug, project_slug } = await params;
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const project = await resolveProject(team_slug, project_slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { page_id } = await request.json();
  if (!page_id) {
    return NextResponse.json({ error: 'page_id is required' }, { status: 400 });
  }

  // 检查是否已关联
  const existing = await db.query.projectPages.findFirst({
    where: and(eq(projectPages.projectId, project.id), eq(projectPages.pageId, page_id)),
    columns: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'Page already in project' }, { status: 409 });
  }

  await db.insert(projectPages).values({
    projectId: project.id,
    pageId: page_id,
    addedBy: session.userId,
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/teams/
git commit -m "feat: add projects CRUD API"
```

---

## Phase 2: 创建流程 + Header 入口

### Task 2.1: Header — CreateDropdown 添加"创建团队"

**Files:**
- Modify: `apps/web/lib/navigation/create-menu-items.tsx`

**Interfaces:**
- Consumes: Existing `CreateMenuItem` interface
- Produces: Updated menu items with "创建团队" entry

- [ ] **Step 1: 修改 `create-menu-items.tsx`**

```typescript
import { FilePlus2, MessageSquareText, Package, Wand, Users } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface CreateMenuItem {
  icon: LucideIcon
  labelKey: string
  href: string
}

export const CREATE_MENU_ITEMS: CreateMenuItem[] = [
  { icon: MessageSquareText, labelKey: "nav.postMoment", href: "/moment" },
  { icon: FilePlus2, labelKey: "nav.createPage", href: "/pages/new" },
  { icon: Package, labelKey: "nav.publishMcp", href: "/publish?type=mcp" },
  { icon: Wand, labelKey: "nav.createSkill", href: "/publish?type=skill" },
]

// 额外在 CreateDropdown 组件中渲染的项（分割线 + 创建团队）
export const CREATE_TEAM_ITEM: CreateMenuItem = {
  icon: Users,
  labelKey: "nav.createTeam",
  href: "/account/teams/new",
}
```

- [ ] **Step 2: 修改 `create-dropdown.tsx` 渲染逻辑**

读取 `apps/web/components/layout/create-dropdown.tsx`，在现有的 separator 后再添加一个 separator，然后加 "创建团队"：

```typescript
// 在 CreateDropdown 组件内，已有 separator 后添加：
<DropdownMenuSeparator />
<DropdownMenuItem onClick={() => router.push(CREATE_TEAM_ITEM.href)}>
  <CREATE_TEAM_ITEM.icon className="mr-2 h-4 w-4 shrink-0" />
  {t(CREATE_TEAM_ITEM.labelKey)}
</DropdownMenuItem>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/navigation/create-menu-items.tsx apps/web/components/layout/create-dropdown.tsx
git commit -m "feat: add create team entry to CreateDropdown"
```

---

### Task 2.2: Header — UserMenu 添加"团队"

**Files:**
- Modify: `apps/web/components/layout/user-menu.tsx`

**Interfaces:**
- Consumes: Existing UserMenu component
- Produces: New "团队" link between "技能" and API Keys items

- [ ] **Step 1: 在 user-menu.tsx 中添加"团队"导航项**

在 "技能" (`/skills`) 的 DropdownMenuItem 之后添加：

```tsx
{/* 团队 */}
<DropdownMenuItem asChild>
  <Link href="/settings/teams">
    <Users className="mr-2 h-4 w-4 shrink-0" />
    {t("nav.teams", "团队")}
  </Link>
</DropdownMenuItem>
```

需要 import `Users` from `lucide-react`。

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/layout/user-menu.tsx
git commit -m "feat: add teams link to UserMenu"
```

---

### Task 2.3: 创建团队页面 — `/account/teams/new`

**Files:**
- Create: `apps/web/app/(auth)/teams/new/page.tsx`

**Interfaces:**
- Consumes: `GET /api/teams/check-slug` (Task 1.4), `POST /api/teams` (Task 1.5)
- Produces: 创建团队表单页面（auth layout 样式）

- [ ] **Step 1: 创建页面文件**

**注意**: `/account/teams/new` 放在 `(auth)` route group 下以使用 auth layout（居中、简单）。需要双层级目录：`app/(auth)/account/teams/new/page.tsx` 不，Next.js 会把 `(auth)` 从 URL 中去掉，所以目录结构应该是 `app/(auth)/account/teams/new/page.tsx` → URL: `/account/teams/new`。

页面是一个 client component（需要表单交互和 API 调用）：

```tsx
"use client"

import { useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"

export default function CreateTeamPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugError, setSlugError] = useState<string | null>(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // name → slug 自动生成
  const handleNameChange = useCallback((value: string) => {
    setName(value)
    const generated = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
    setSlug(generated)
    setSlugError(null)

    // debounce 校验
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (generated.length > 0) {
      debounceRef.current = setTimeout(async () => {
        setSlugChecking(true)
        try {
          const res = await fetch(`/api/teams/check-slug?slug=${encodeURIComponent(generated)}`)
          const data = await res.json()
          if (!data.available) {
            setSlugError(data.message)
          }
        } catch {
          // ignore
        } finally {
          setSlugChecking(false)
        }
      }, 500)
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!name || !slug || !!slugError || !acceptedTerms) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      })
      if (res.ok) {
        router.push(`/team/${slug}/invite`)
      } else {
        const data = await res.json()
        setSlugError(data.error || "Failed to create team")
      }
    } catch {
      setSlugError("Network error")
    } finally {
      setSubmitting(false)
    }
  }, [name, slug, slugError, acceptedTerms, router])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://viben-web.vercel.app"

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Tell us about your team</h2>
      </div>

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Set up your team</h1>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Team name</label>
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="my-awesome-team"
            autoFocus
          />
          {slugChecking && (
            <p className="text-sm text-muted-foreground">Checking availability...</p>
          )}
          {slugError && (
            <p className="text-sm text-destructive">{slugError}</p>
          )}
        </div>

        {slug && !slugError && (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>This will be the name of your account on Viben.</p>
            <p>
              Your URL will be:{" "}
              <span className="text-foreground font-medium">
                {appUrl}/{slug}
              </span>
              .
            </p>
          </div>
        )}

        <div className="flex items-start gap-2">
          <Checkbox
            id="terms"
            checked={acceptedTerms}
            onCheckedChange={(c) => setAcceptedTerms(c === true)}
          />
          <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
            I hereby accept the{" "}
            <a href="/terms" className="text-primary underline" target="_blank">
              Terms of Service
            </a>
            . For more information about Viben&apos;s privacy practices, see the{" "}
            <a href="/privacy" className="text-primary underline" target="_blank">
              Viben Privacy Statement
            </a>
            .
          </label>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!name || !slug || !!slugError || !acceptedTerms || submitting}
          className="w-full"
        >
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Next
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(auth\)/account/
git commit -m "feat: add create team page"
```

---

### Task 2.4: 邀请成员页面 — `/team/{team_slug}/invite`

**Files:**
- Create: `apps/web/app/(dashboard)/team/[team_slug]/invite/page.tsx`

**Interfaces:**
- Consumes: `GET /api/users/search?q=xxx`（需确认现有 API 或新建）, `POST /api/teams/{team_slug}/members` (Task 1.6)
- Produces: 邀请成员页面

- [ ] **Step 1: 创建页面**

```tsx
"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, X, Search } from "lucide-react"

interface UserResult {
  userSlug: string
  displayName: string
  avatarUrl: string | null
}

export default function InviteMembersPage({
  params,
}: {
  params: Promise<{ team_slug: string }>
}) {
  const { t } = useTranslation()
  const router = useRouter()
  const [teamSlug, setTeamSlug] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UserResult[]>([])
  const [selected, setSelected] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    params.then((p) => setTeamSlug(p.team_slug))
  }, [params])

  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.length < 2) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(value)}`)
        if (res.ok) {
          const data = await res.json()
          const filtered = (data.users || []).filter(
            (u: UserResult) => !selected.some((s) => s.userSlug === u.userSlug)
          )
          setResults(filtered.slice(0, 10))
        }
      } catch {
        // ignore
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [selected])

  const addUser = useCallback((user: UserResult) => {
    setSelected((prev) => [...prev, user])
    setResults((prev) => prev.filter((r) => r.userSlug !== user.userSlug))
    setQuery("")
  }, [])

  const removeUser = useCallback((userSlug: string) => {
    setSelected((prev) => prev.filter((u) => u.userSlug !== userSlug))
  }, [])

  const handleComplete = useCallback(async () => {
    if (!teamSlug) return
    setSubmitting(true)
    try {
      for (const user of selected) {
        await fetch(`/api/teams/${teamSlug}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_slug: user.userSlug }),
        })
      }
    } catch {
      // ignore individual errors
    }
    router.push(`/${teamSlug}`)
  }, [teamSlug, selected, router])

  return (
    <div className="mx-auto w-full max-w-lg space-y-8 px-4 py-16">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-semibold">Start collaborating</h2>
        <h1 className="text-3xl font-bold">Welcome to {teamSlug}</h1>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Add team members</h3>
          <p className="text-sm text-muted-foreground">
            Team members will be able to view projects.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by username, full name or email address"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {results.length > 0 && (
          <div className="border rounded-lg divide-y">
            {results.map((user) => (
              <button
                key={user.userSlug}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary transition-colors text-left"
                onClick={() => addUser(user)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">@{user.userSlug}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {searching && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((user) => (
              <span
                key={user.userSlug}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1 text-sm"
              >
                {user.displayName}
                <button onClick={() => removeUser(user.userSlug)}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={handleComplete} disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Complete Setup
        </Button>
        <Button variant="ghost" onClick={() => router.push(`/${teamSlug}`)}>
          Skip this step
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/team/
git commit -m "feat: add invite members page"
```

---

## Phase 3: 团队主页 + 路由

### Task 3.1: 修改 `/[user_slug]` 路由支持 team

**Files:**
- Modify: `apps/web/app/(dashboard)/[user_slug]/page.tsx`

**Interfaces:**
- Consumes: `users.type` (Task 1.1), `teamMembers` (Task 1.2)
- Produces: 当 type='team' 时渲染 TeamShell（Tablist + content），当 type='user' 时渲染现有用户主页

- [ ] **Step 1: 修改 `page.tsx` 在数据查询后添加类型判断**

在 `UserSlugPage` 函数中，`getCachedProfileData` 返回的 `user` 对象现在会包含 `type` 字段。如果 `user.type === 'team'`，渲染 `TeamPageShell` 组件替代用户主页。

需要创建两个文件：
- `apps/web/app/(dashboard)/[user_slug]/team-page.tsx` — Server component 获取 team 数据
- `apps/web/components/team/team-page-shell.tsx` — Client component: Tablist + tabs 内容

具体逻辑（简化）：

```tsx
// 在 UserSlugPage 返回之前添加：
if (user.type === 'team') {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 rounded-xl bg-muted" />}>
      <TeamPage
        teamSlug={slug}
        session={session}
      />
    </Suspense>
  )
}
```

`TeamPage` 是一个 server component，从 DB 获取 team 的 projects 和 members 数据，传给 client component `TeamPageShell`。

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/\[user_slug\]/ apps/web/components/team/
git commit -m "feat: route team pages from [user_slug]"
```

---

### Task 3.2: 团队主页 TeamPageShell 组件

**Files:**
- Create: `apps/web/components/team/team-page-shell.tsx`
- Create: `apps/web/components/team/team-overview.tsx`
- Create: `apps/web/components/team/team-tablist.tsx`

**Interfaces:**
- Consumes: Team page data (team info, projects, members, currentUserRole)
- Produces: 居中 Tablist + 4 个 tab 的内容组件

- [ ] **Step 1: 创建 `team-tablist.tsx`**

```tsx
"use client"

import { usePathname, useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface TeamTablistProps {
  teamSlug: string
  activeTab: "overview" | "projects" | "members" | "settings"
  className?: string
}

const TABS = [
  { value: "overview", labelKey: "team.tabs.overview", href: (slug: string) => `/${slug}` },
  { value: "projects", labelKey: "team.tabs.projects", href: (slug: string) => `/team/${slug}/projects` },
  { value: "members", labelKey: "team.tabs.members", href: (slug: string) => `/team/${slug}/members` },
  { value: "settings", labelKey: "team.tabs.settings", href: (slug: string) => `/team/${slug}/settings` },
]

export function TeamTablist({ teamSlug, activeTab, className }: TeamTablistProps) {
  const { t } = useTranslation()
  const router = useRouter()

  return (
    <div className={cn("flex justify-center", className)}>
      <Tabs value={activeTab} onValueChange={(v) => {
        const tab = TABS.find((t) => t.value === v)
        if (tab) router.push(tab.href(teamSlug))
      }}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: 创建 `team-page-shell.tsx`**

Client component 包裹实际展示内容：

```tsx
"use client"

import { TeamTablist } from "./team-tablist"
import type { ReactNode } from "react"

interface TeamPageShellProps {
  teamSlug: string
  teamName: string
  teamAvatarUrl: string | null
  activeTab: "overview" | "projects" | "members" | "settings"
  children: ReactNode
}

export function TeamPageShell({
  teamSlug, teamName, teamAvatarUrl, activeTab, children,
}: TeamPageShellProps) {
  return (
    <div className="space-y-6">
      {/* 面包屑区域：Logo + team_slug + dropdown */}
      <div className="flex items-center gap-2">
        {/* 后续迭代中实现完整面包屑（team switcher dropdown），初期仅显示 team name */}
        <h1 className="text-lg font-semibold">{teamName}</h1>
      </div>

      <TeamTablist teamSlug={teamSlug} activeTab={activeTab} />

      <div className="min-w-0">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 `team-overview.tsx`**

Project 卡片列表 + 创建 Project 按钮：

```tsx
"use client"

import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface ProjectItem {
  project_slug: string
  name: string
  description: string | null
  created_at: string
}

interface TeamOverviewProps {
  teamSlug: string
  projects: ProjectItem[]
  currentUserRole: string | null
}

export function TeamOverview({ teamSlug, projects, currentUserRole }: TeamOverviewProps) {
  const { t } = useTranslation()
  const router = useRouter()

  const canCreate = currentUserRole === "owner" || currentUserRole === "member"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("team.projects", "Projects")}</h2>
        {canCreate && (
          <Button size="sm" onClick={() => router.push(`/team/${teamSlug}/projects/new`)}>
            <Plus className="mr-1 h-4 w-4" />
            {t("team.newProject", "New Project")}
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
          <h3 className="text-lg font-medium">
            {t("team.noProjects", "No projects yet")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {t("team.noProjectsHint", "Create your first project to get started")}
          </p>
          {canCreate && (
            <Button onClick={() => router.push(`/team/${teamSlug}/projects/new`)}>
              {t("team.createFirstProject", "Create Project")}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.project_slug}
              href={`/${teamSlug}/${project.project_slug}`}
              className="block rounded-lg border p-4 hover:border-primary/50 transition-colors"
            >
              <h3 className="font-semibold">{project.name}</h3>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {project.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/team/
git commit -m "feat: add TeamPageShell and TeamOverview components"
```

---

### Task 3.3: Team Members 页面

**Files:**
- Create: `apps/web/app/(dashboard)/team/[team_slug]/members/page.tsx`
- Create: `apps/web/components/team/team-members-list.tsx`

**Interfaces:**
- Consumes: `GET /api/teams/{team_slug}` + `GET /api/teams/{team_slug}/members` (Task 1.6)
- Produces: 成员列表 + 操作按钮

- [ ] **Step 1: 创建页面（server component 获取数据）**

```tsx
import { getSession } from "@/lib/auth/cookies"
import { notFound } from "next/navigation"
import { TeamPageShell } from "@/components/team/team-page-shell"
import { TeamMembersList } from "@/components/team/team-members-list"
import { db, users, teamMembers } from "@/lib/db"
import { eq, and } from "drizzle-orm"

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ team_slug: string }>
}) {
  const { team_slug } = await params
  const session = await getSession()

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, team_slug), eq(users.type, "team")),
    columns: { id: true, displayName: true, avatarUrl: true, userSlug: true },
  })
  if (!team) notFound()

  // 当前用户 role
  let currentUserRole: string | null = null
  if (session?.userId) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, session.userId)),
      columns: { role: true },
    })
    currentUserRole = membership?.role ?? null
  }

  // 成员列表
  const members = await db
    .select({
      userId: teamMembers.userId,
      userSlug: users.userSlug,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: teamMembers.role,
      joinedAt: teamMembers.joinedAt,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, team.id))
    .orderBy(teamMembers.joinedAt)

  return (
    <TeamPageShell
      teamSlug={team_slug}
      teamName={team.displayName}
      teamAvatarUrl={team.avatarUrl}
      activeTab="members"
    >
      <TeamMembersList
        teamSlug={team_slug}
        members={members}
        currentUserRole={currentUserRole}
      />
    </TeamPageShell>
  )
}
```

- [ ] **Step 2: 创建 client component `team-members-list.tsx`**

列表展示：avatar + name + role badge (Owner/Member) + 操作按钮（仅 owner 可见）。

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/team/ apps/web/components/team/
git commit -m "feat: add team members page"
```

---

### Task 3.4: Team Settings 页面

**Files:**
- Create: `apps/web/app/(dashboard)/team/[team_slug]/settings/page.tsx`
- Create: `apps/web/components/team/team-settings-form.tsx`
- Create: `apps/web/components/team/team-api-keys.tsx`

**Interfaces:**
- Consumes: `GET/PATCH /api/teams/{team_slug}` (Task 1.5), 复用现有 `api_keys` 表 API
- Produces: 单列布局 settings 页面（Profile 卡片 + API Key 卡片）

- [ ] **Step 1: 创建 settings 页面**

Server component + client form 子组件。单列布局（`max-w-2xl`），两个卡片上下排列。

团队设置只有 owner 可编辑（前端判断 currentUserRole）。

- [ ] **Step 2: 创建 `team-settings-form.tsx`**

Profile 卡片表单：displayName、slug（只读）、description/bio、avatar URL。

- [ ] **Step 3: 创建 `team-api-keys.tsx`**

复用现有 `components/profile/profile-api-keys.tsx` 的模式，但 API key 列表通过 `GET /api/api-keys` 获取（关联当前 team user id）。

API Keys 卡片：
- 顶部：标题 + Create New API Key 按钮
- 列表：name, key (masked), created_at, Revoke 按钮

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/team/ apps/web/components/team/
git commit -m "feat: add team settings page"
```

---

### Task 3.5: Settings Sidebar 添加"团队"入口

**Files:**
- Modify: `apps/web/components/profile/settings-sidebar.tsx`

- [ ] **Step 1: 在 NAV_ITEMS 数组的"Profile"之后添加"团队"**

```typescript
import { Users } from 'lucide-react'

// 在 NAV_ITEMS 数组的 Profile 项之后添加：
{ href: '/settings/teams', match: (p: string) => p.startsWith('/settings/teams'), label: 'nav.teams', icon: Users },
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/profile/settings-sidebar.tsx
git commit -m "feat: add teams entry to settings sidebar"
```

---

### Task 3.6: `/settings/teams` 团队列表页面

**Files:**
- Create: `apps/web/app/(dashboard)/settings/teams/page.tsx`

**Interfaces:**
- Consumes: `GET /api/teams` (Task 1.5)
- Produces: 团队管理列表页面

- [ ] **Step 1: 创建 server component 页面**

```tsx
import { getSession } from "@/lib/auth/cookies"
import { redirect } from "next/navigation"
import { db, users, teamMembers } from "@/lib/db"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Settings, LogOut } from "lucide-react"

export default async function TeamsListPage() {
  const session = await getSession()
  if (!session?.userId) redirect("/login")

  const memberships = await db
    .select({
      teamId: teamMembers.teamId,
      teamSlug: users.userSlug,
      teamName: users.displayName,
      teamAvatarUrl: users.avatarUrl,
      role: teamMembers.role,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.teamId, users.id))
    .where(eq(teamMembers.userId, session.userId))
    .orderBy(teamMembers.joinedAt)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Teams</h1>
        <Button asChild>
          <Link href="/account/teams/new">
            <Plus className="mr-1 h-4 w-4" />
            New Team
          </Link>
        </Button>
      </div>

      {memberships.length === 0 ? (
        <p className="text-muted-foreground">You are not a member of any team yet.</p>
      ) : (
        <div className="divide-y border rounded-lg">
          {memberships.map((m) => (
            <div key={m.teamId} className="flex items-center gap-4 px-4 py-3">
              <Link href={`/${m.teamSlug}`} className="flex items-center gap-3 flex-1 min-w-0 hover:underline">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={m.teamAvatarUrl ?? undefined} />
                  <AvatarFallback>{m.teamName[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.teamName}</p>
                  <span className="text-xs text-muted-foreground">
                    {m.role === "owner" ? "Owner" : "Member"}
                  </span>
                </div>
              </Link>

              <div className="flex items-center gap-1 shrink-0">
                {m.role === "owner" && (
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/team/${m.teamSlug}/settings`}>
                      <Settings className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button variant="ghost" size="icon">
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/settings/teams/
git commit -m "feat: add teams list settings page"
```

---

## Phase 4: Project 详情页

### Task 4.1: 修改 `/[user_slug]/[page_id]` 路由支持 Project 详情

**Files:**
- Modify: `apps/web/app/(dashboard)/[user_slug]/[page_id]/page.tsx`

**Interfaces:**
- Consumes: `users.type` (Task 1.1), `projects` table (Task 1.3)
- Produces: 当 user_slug 是 team 且 page_id 匹配 project_slug 时，渲染 Project 详情页

- [ ] **Step 1: 在现有 `page.tsx` 中添加 team/project 类型判断**

在页面数据查询前先判断 `user_slug` 是否是 team：

```typescript
// 在 generateMetadata 中
const user = await db.query.users.findFirst({
  where: eq(users.userSlug, user_slug),
  columns: { id: true, type: true },
})

if (user?.type === 'team') {
  // team → 按 project 处理
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.teamId, user.id), eq(projects.projectSlug, page_id)),
  })
  if (!project) notFound()
  // 渲染 Project 详情（metadata 用 project.name）
  return { title: `${project.name} - ${user_slug}` }
}

// 现有逻辑继续...
```

- [ ] **Step 2: 创建 project 详情页组件**

当 `type === 'team'` 时渲染 `ProjectPageShell`：

```tsx
if (user?.type === 'team') {
  return (
    <Suspense fallback={<div className="animate-pulse h-96" />}>
      <ProjectPage
        teamSlug={user_slug}
        projectSlug={page_id}
        session={session}
      />
    </Suspense>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/\[user_slug\]/\[page_id\]/
git commit -m "feat: route project pages from [user_slug]/[page_id]"
```

---

### Task 4.2: ProjectPageShell + Overview 组件

**Files:**
- Create: `apps/web/components/project/project-page-shell.tsx`
- Create: `apps/web/components/project/project-tablist.tsx`
- Create: `apps/web/components/project/project-overview.tsx`
- Create: `apps/web/app/(dashboard)/[user_slug]/[page_id]/project-page.tsx`

**Interfaces:**
- Consumes: Team data + Project data + Project pages
- Produces: Tablist (Overview / Pages / Settings) + tab 内容

- [ ] **Step 1: 创建 `project-page.tsx` (server component)**

```typescript
import { db, users, projects, projectPages, publishedPages } from "@/lib/db"
import { getSession } from "@/lib/auth/cookies"
import { eq, and } from "drizzle-orm"
import { notFound } from "next/navigation"
import { ProjectPageShell } from "@/components/project/project-page-shell"

interface Props {
  teamSlug: string
  projectSlug: string
}

export async function ProjectPage({ teamSlug, projectSlug }: Props) {
  const session = await getSession()

  const team = await db.query.users.findFirst({
    where: and(eq(users.userSlug, teamSlug), eq(users.type, "team")),
    columns: { id: true, displayName: true, avatarUrl: true },
  })
  if (!team) notFound()

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.teamId, team.id), eq(projects.projectSlug, projectSlug)),
    columns: {
      id: true, name: true, projectSlug: true,
      description: true, defaultPageId: true, createdBy: true,
    },
  })
  if (!project) notFound()

  // 获取 pages 列表
  const pages = await db
    .select({
      pageId: publishedPages.id,
      uid: publishedPages.uid,
      title: publishedPages.title,
      description: publishedPages.description,
      coverUrl: publishedPages.coverUrl,
      authorSlug: publishedPages.authorSlug,
      html: publishedPages.html,
      addedAt: projectPages.addedAt,
    })
    .from(projectPages)
    .innerJoin(publishedPages, eq(projectPages.pageId, publishedPages.id))
    .where(eq(projectPages.projectId, project.id))
    .orderBy(projectPages.addedAt)

  // 找默认 page
  const defaultPage = project.defaultPageId
    ? pages.find((p) => p.pageId === project.defaultPageId)
    : pages[0] ?? null

  return (
    <ProjectPageShell
      teamSlug={teamSlug}
      project={project}
      pages={pages}
      defaultPage={defaultPage}
    />
  )
}
```

- [ ] **Step 2: 创建 `project-page-shell.tsx` (client component)**

Tablist (Overview / Pages / Settings) + content area。

- [ ] **Step 3: 创建 `project-overview.tsx`**

iframe 展示默认 page：

```tsx
"use client"

interface ProjectOverviewProps {
  defaultPage: { html: string; title: string } | null
  teamSlug: string
  projectSlug: string
}

export function ProjectOverview({ defaultPage, teamSlug, projectSlug }: ProjectOverviewProps) {
  if (!defaultPage) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
        <h3 className="text-lg font-medium">No pages yet</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add a page to this project to get started
        </p>
      </div>
    )
  }

  return (
    <iframe
      title={defaultPage.title}
      srcDoc={defaultPage.html}
      sandbox="allow-scripts allow-same-origin"
      className="w-full border rounded-lg"
      style={{ minHeight: "60vh" }}
    />
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/project/ apps/web/app/\(dashboard\)/\[user_slug\]/\[page_id\]/
git commit -m "feat: add project overview page"
```

---

### Task 4.3: Project Pages 列表

**Files:**
- Create: `apps/web/components/project/project-pages-list.tsx`

**Interfaces:**
- Consumes: Project pages 数据, `POST /api/teams/{team_slug}/projects/{project_slug}/pages`
- Produces: Pages 列表 + 添加 page 功能

- [ ] **Step 1: 创建 `project-pages-list.tsx`**

列表显示项目下所有 pages（title, description, link 到 page），带"添加 page"按钮（弹出搜索/选择现有 pages 的 dialog）。

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/project/
git commit -m "feat: add project pages list component"
```

---

### Task 4.4: i18n 翻译 Key

**Files:**
- Modify: `apps/web/public/locales/zh-CN/` 和 `apps/web/public/locales/en/` 翻译 JSON 文件

添加以下翻译 keys：

```json
{
  "nav": {
    "createTeam": "创建团队",
    "teams": "团队"
  },
  "team": {
    "tabs": {
      "overview": "概览",
      "projects": "项目",
      "members": "成员",
      "settings": "设置"
    },
    "newProject": "新建项目",
    "noProjects": "暂无项目",
    "noProjectsHint": "创建你的第一个项目",
    "createFirstProject": "创建项目",
    "projects": "项目",
    "members": "成员",
    "role": {
      "owner": "Owner",
      "member": "Member"
    },
    "settings": {
      "profile": "团队信息",
      "apiKeys": "API Keys"
    },
    "invite": {
      "title": "添加成员",
      "placeholder": "按用户名、姓名或邮箱搜索",
      "complete": "完成设置",
      "skip": "跳过此步骤"
    }
  },
  "project": {
    "tabs": {
      "overview": "概览",
      "pages": "页面",
      "settings": "设置"
    }
  }
}
```

- [ ] **Step 1: 将上述 keys 添加到 zh-CN 和 en 对应的 JSON 文件中**
- [ ] **Step 2: 如有英文翻译文件同步添加英文翻译**
- [ ] **Step 3: Commit**

```bash
git add apps/web/public/locales/
git commit -m "feat: add team and project i18n keys"
```

---

## 文件结构总览

```
apps/web/
├── lib/db/
│   └── schema.ts                          # 修改: +type, +teamMembers, +projects, +projectPages
├── app/
│   ├── (auth)/account/teams/new/
│   │   └── page.tsx                       # 创建: 创建团队表单
│   ├── (dashboard)/
│   │   ├── [user_slug]/
│   │   │   ├── page.tsx                   # 修改: 判断 type → 渲染 user 主页 或 team shell
│   │   │   └── [page_id]/
│   │   │       ├── page.tsx               # 修改: 判断是 team → 渲染 project 详情
│   │   │       └── project-page.tsx       # 创建: project 数据获取 server component
│   │   ├── team/[team_slug]/
│   │   │   ├── invite/page.tsx            # 创建: 邀请成员
│   │   │   ├── members/page.tsx           # 创建: 成员列表
│   │   │   ├── projects/page.tsx          # 创建: projects 列表
│   │   │   └── settings/page.tsx          # 创建: 团队设置
│   │   └── settings/teams/
│   │       └── page.tsx                   # 创建: 我的团队列表
│   └── api/teams/
│       ├── check-slug/route.ts            # 创建: slug 可用性检查
│       ├── route.ts                       # 创建: GET(列表), POST(创建)
│       └── [team_slug]/
│           ├── route.ts                   # 创建: GET, PATCH, DELETE
│           ├── members/route.ts           # 创建: GET(列表), POST(邀请)
│           ├── members/[user_slug]/route.ts        # 创建: DELETE(移除)
│           ├── members/[user_slug]/role/route.ts   # 创建: PUT(修改角色)
│           ├── leave/route.ts             # 创建: POST(离开)
│           └── projects/
│               ├── route.ts               # 创建: GET(列表), POST(创建)
│               └── [project_slug]/
│                   ├── route.ts           # 创建: GET, PATCH, DELETE
│                   └── pages/route.ts     # 创建: GET(列表), POST(添加)
├── components/
│   ├── layout/
│   │   ├── user-menu.tsx                  # 修改: +团队入口
│   │   └── create-dropdown.tsx            # 修改: +创建团队
│   ├── profile/
│   │   └── settings-sidebar.tsx           # 修改: +团队入口
│   ├── team/
│   │   ├── team-page-shell.tsx            # 创建
│   │   ├── team-tablist.tsx               # 创建
│   │   ├── team-overview.tsx              # 创建
│   │   ├── team-members-list.tsx          # 创建
│   │   ├── team-settings-form.tsx         # 创建
│   │   └── team-api-keys.tsx              # 创建
│   └── project/
│       ├── project-page-shell.tsx         # 创建
│       ├── project-tablist.tsx            # 创建
│       ├── project-overview.tsx           # 创建
│       └── project-pages-list.tsx         # 创建
└── lib/navigation/
    └── create-menu-items.tsx              # 修改: +CREATE_TEAM_ITEM
```
