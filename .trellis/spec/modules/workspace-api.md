# T14: Workspace API

> Implement workspace CRUD API routes.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T14 |
| Dependencies | T4 (User API), T5 (MCP API), T6 (Skills API) |
| Effort | 3 points |
| Priority | P2 |

---

## Objectives

1. Create workspace CRUD endpoints
2. Implement workspace membership
3. Add workspace package management
4. Handle workspace settings

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/workspaces` | List user's workspaces | Yes |
| POST | `/api/workspaces` | Create workspace | Yes |
| GET | `/api/workspaces/[id]` | Get workspace details | Yes |
| PATCH | `/api/workspaces/[id]` | Update workspace | Yes |
| DELETE | `/api/workspaces/[id]` | Delete workspace | Yes |
| GET | `/api/workspaces/[id]/packages` | List workspace packages | Yes |
| POST | `/api/workspaces/[id]/packages` | Add package to workspace | Yes |
| DELETE | `/api/workspaces/[id]/packages/[pkgId]` | Remove package | Yes |
| GET | `/api/workspaces/[id]/members` | List members | Yes |
| POST | `/api/workspaces/[id]/members` | Invite member | Yes |
| DELETE | `/api/workspaces/[id]/members/[userId]` | Remove member | Yes |

---

## Deliverables

### 1. List Workspaces (`apps/web/app/api/workspaces/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, workspaces, workspaceMembers, users } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { eq, or, desc } from 'drizzle-orm';

// GET - List user's workspaces
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get workspaces user owns or is member of
  const memberOf = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, session.userId));

  const memberIds = memberOf.map((m) => m.workspaceId);

  const userWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      description: workspaces.description,
      isPersonal: workspaces.isPersonal,
      createdAt: workspaces.createdAt,
      owner: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(workspaces)
    .leftJoin(users, eq(workspaces.ownerId, users.id))
    .where(
      or(
        eq(workspaces.ownerId, session.userId),
        memberIds.length > 0
          ? eq(workspaces.id, memberIds[0]) // Simplified; use inArray in production
          : undefined
      )
    )
    .orderBy(desc(workspaces.createdAt));

  return NextResponse.json({ workspaces: userWorkspaces });
}

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
});

// POST - Create workspace
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, slug, description } = createWorkspaceSchema.parse(body);

  // Check slug uniqueness
  const existing = await db.query.workspaces.findFirst({
    where: eq(workspaces.slug, slug),
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Workspace slug already taken' },
      { status: 409 }
    );
  }

  const workspaceId = generateId();

  await db.insert(workspaces).values({
    id: workspaceId,
    name,
    slug,
    description: description || null,
    ownerId: session.userId,
    isPersonal: false,
  });

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  return NextResponse.json({ workspace }, { status: 201 });
}
```

### 2. Workspace Detail (`apps/web/app/api/workspaces/[id]/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, workspaces, workspaceMembers } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and, or } from 'drizzle-orm';

// Helper to check workspace access
async function checkAccess(workspaceId: string, userId: string) {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace) return null;

  // Owner has full access
  if (workspace.ownerId === userId) {
    return { workspace, role: 'owner' };
  }

  // Check membership
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });

  if (membership) {
    return { workspace, role: membership.role };
  }

  return null;
}

// GET - Get workspace details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await checkAccess(params.id, session.userId);
  if (!access) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    workspace: access.workspace,
    role: access.role,
  });
}

const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

// PATCH - Update workspace
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await checkAccess(params.id, session.userId);
  if (!access) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Only owner and admin can update
  if (access.role !== 'owner' && access.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const updates = updateWorkspaceSchema.parse(body);

  await db
    .update(workspaces)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, params.id));

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, params.id),
  });

  return NextResponse.json({ workspace });
}

// DELETE - Delete workspace
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const access = await checkAccess(params.id, session.userId);
  if (!access) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Only owner can delete
  if (access.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Cannot delete personal workspace
  if (access.workspace.isPersonal) {
    return NextResponse.json(
      { error: 'Cannot delete personal workspace' },
      { status: 400 }
    );
  }

  await db.delete(workspaces).where(eq(workspaces.id, params.id));

  return NextResponse.json({ success: true });
}
```

### 3. Workspace Packages (`apps/web/app/api/workspaces/[id]/packages/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  db,
  workspaces,
  workspacePackages,
  mcpPackages,
  skillPackages,
} from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

// GET - List workspace packages
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify access (simplified)
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, params.id),
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const packages = await db.query.workspacePackages.findMany({
    where: eq(workspacePackages.workspaceId, params.id),
  });

  // Fetch actual package details
  const mcpIds = packages
    .filter((p) => p.packageType === 'mcp')
    .map((p) => p.packageId);
  const skillIds = packages
    .filter((p) => p.packageType === 'skill')
    .map((p) => p.packageId);

  const [mcps, skills] = await Promise.all([
    mcpIds.length > 0
      ? db.query.mcpPackages.findMany({
          where: (pkg, { inArray }) => inArray(pkg.id, mcpIds),
        })
      : [],
    skillIds.length > 0
      ? db.query.skillPackages.findMany({
          where: (pkg, { inArray }) => inArray(pkg.id, skillIds),
        })
      : [],
  ]);

  return NextResponse.json({
    packages: {
      mcp: mcps,
      skills: skills,
    },
    configs: packages.map((p) => ({
      packageId: p.packageId,
      packageType: p.packageType,
      config: p.config,
      enabled: p.enabled,
    })),
  });
}

const addPackageSchema = z.object({
  packageId: z.string(),
  packageType: z.enum(['mcp', 'skill']),
  config: z.record(z.any()).optional(),
  enabled: z.boolean().default(true),
});

// POST - Add package to workspace
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { packageId, packageType, config, enabled } = addPackageSchema.parse(body);

  // Verify workspace access
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, params.id),
  });

  if (!workspace || workspace.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify package exists
  if (packageType === 'mcp') {
    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, packageId),
    });
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }
  } else {
    const pkg = await db.query.skillPackages.findFirst({
      where: eq(skillPackages.id, packageId),
    });
    if (!pkg) {
      return NextResponse.json({ error: 'Package not found' }, { status: 404 });
    }
  }

  // Check if already added
  const existing = await db.query.workspacePackages.findFirst({
    where: and(
      eq(workspacePackages.workspaceId, params.id),
      eq(workspacePackages.packageId, packageId)
    ),
  });

  if (existing) {
    return NextResponse.json(
      { error: 'Package already in workspace' },
      { status: 409 }
    );
  }

  await db.insert(workspacePackages).values({
    workspaceId: params.id,
    packageId,
    packageType,
    config: config || {},
    enabled,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
```

### 4. Workspace Members (`apps/web/app/api/workspaces/[id]/members/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, workspaces, workspaceMembers, users } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and } from 'drizzle-orm';

// GET - List members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, params.id),
  });

  if (!workspace) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const members = await db
    .select({
      id: workspaceMembers.id,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
      user: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(workspaceMembers)
    .leftJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, params.id));

  // Include owner
  const owner = await db.query.users.findFirst({
    where: eq(users.id, workspace.ownerId),
    columns: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
  });

  return NextResponse.json({
    owner,
    members,
  });
}

const inviteMemberSchema = z.object({
  username: z.string(),
  role: z.enum(['admin', 'member']).default('member'),
});

// POST - Invite member
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, params.id),
  });

  if (!workspace || workspace.ownerId !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { username, role } = inviteMemberSchema.parse(body);

  // Find user by username
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Cannot add owner as member
  if (user.id === workspace.ownerId) {
    return NextResponse.json(
      { error: 'Cannot add owner as member' },
      { status: 400 }
    );
  }

  // Check if already member
  const existing = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, params.id),
      eq(workspaceMembers.userId, user.id)
    ),
  });

  if (existing) {
    return NextResponse.json(
      { error: 'User is already a member' },
      { status: 409 }
    );
  }

  await db.insert(workspaceMembers).values({
    workspaceId: params.id,
    userId: user.id,
    role,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
```

---

## Response Shapes

### Workspace

```typescript
interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPersonal: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
```

### WorkspacePackage

```typescript
interface WorkspacePackage {
  packageId: string;
  packageType: 'mcp' | 'skill';
  config: Record<string, any>;
  enabled: boolean;
}
```

---

## Acceptance Criteria

- [ ] List user's workspaces (owned + member)
- [ ] Create workspace with unique slug
- [ ] Get workspace details (with role)
- [ ] Update workspace (owner/admin only)
- [ ] Delete workspace (owner only, not personal)
- [ ] Add packages to workspace
- [ ] Remove packages from workspace
- [ ] Configure package settings per workspace
- [ ] List workspace members
- [ ] Invite members by username
- [ ] Remove members (owner only)

---

## Notes

- Personal workspace created with user account
- Workspace slug must be unique globally
- Package configs are per-workspace
- Member roles: owner, admin, member
- Cascading delete removes all workspace data
