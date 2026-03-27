# T6: Skills API

> Implement Skill package management API routes.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T6 |
| Dependencies | T4 (User API) |
| Effort | 5 points |
| Priority | P0 |

---

## Objectives

1. Implement Skill package CRUD
2. Implement search and filtering
3. Implement pagination
4. Add compatibility filtering

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/skill` | List skills (paginated) | No |
| GET | `/api/skill/search` | Search skills | No |
| GET | `/api/skill/[id]` | Get skill details | No |
| POST | `/api/skill` | Create skill | Yes (developer) |
| PUT | `/api/skill/[id]` | Update skill | Yes (owner) |
| DELETE | `/api/skill/[id]` | Delete skill | Yes (owner) |

---

## Deliverables

### 1. List & Create (`apps/web/app/api/skill/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, skillPackages, users } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { generateId } from '@/lib/utils';
import { eq, desc, and, sql, arrayContains } from 'drizzle-orm';

const listQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  category: z.string().optional(),
  type: z.enum(['command', 'prompt', 'agent']).optional(),
  compatibility: z.string().optional(), // e.g., "claude-code"
  sort: z.enum(['latest', 'popular', 'downloads']).default('latest'),
});

// GET - List skills
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = listQuerySchema.parse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      category: searchParams.get('category'),
      type: searchParams.get('type'),
      compatibility: searchParams.get('compatibility'),
      sort: searchParams.get('sort'),
    });

    const { page, limit, category, type, compatibility, sort } = query;
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = [];
    if (category) {
      whereConditions.push(eq(skillPackages.category, category));
    }
    if (type) {
      whereConditions.push(eq(skillPackages.skillType, type));
    }
    // Note: compatibility filter requires JSON array contains query

    // Build order by
    let orderBy;
    switch (sort) {
      case 'popular':
        orderBy = desc(skillPackages.favoritesCount);
        break;
      case 'downloads':
        orderBy = desc(skillPackages.downloadsCount);
        break;
      default:
        orderBy = desc(skillPackages.createdAt);
    }

    const skills = await db
      .select({
        id: skillPackages.id,
        name: skillPackages.name,
        slug: skillPackages.slug,
        version: skillPackages.version,
        description: skillPackages.description,
        skillType: skillPackages.skillType,
        category: skillPackages.category,
        tags: skillPackages.tags,
        compatibility: skillPackages.compatibility,
        favoritesCount: skillPackages.favoritesCount,
        downloadsCount: skillPackages.downloadsCount,
        ratingAvg: skillPackages.ratingAvg,
        createdAt: skillPackages.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(skillPackages)
      .leftJoin(users, eq(skillPackages.authorId, users.id))
      .where(whereConditions.length ? and(...whereConditions) : undefined)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(skillPackages)
      .where(whereConditions.length ? and(...whereConditions) : undefined);

    return NextResponse.json({
      skills,
      pagination: {
        page,
        limit,
        total: Number(count),
        totalPages: Math.ceil(Number(count) / limit),
      },
    });
  } catch (error) {
    console.error('List skills error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().max(500),
  longDescription: z.string().optional(),
  skillType: z.enum(['command', 'prompt', 'agent']),
  triggerPatterns: z.array(z.string()).optional(),
  content: z.string().min(1),
  configSchema: z.record(z.unknown()).optional(),
  dependencies: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  compatibility: z.array(z.string()).optional(),
});

// POST - Create skill
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role !== 'developer' && session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only developers can create skills' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = createSchema.parse(body);

    // Check slug uniqueness
    const existing = await db.query.skillPackages.findFirst({
      where: eq(skillPackages.slug, data.slug),
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Skill slug already exists' },
        { status: 400 }
      );
    }

    const skillId = generateId();

    await db.insert(skillPackages).values({
      id: skillId,
      ...data,
      authorId: session.userId,
    });

    return NextResponse.json({ id: skillId, slug: data.slug });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Create skill error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### 2. Skill Detail (`apps/web/app/api/skill/[id]/route.ts`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db, skillPackages, packageReleases } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, and, desc } from 'drizzle-orm';

// GET - Skill detail
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const skill = await db.query.skillPackages.findFirst({
    where: eq(skillPackages.id, id),
    with: {
      author: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  // Get releases
  const releases = await db.query.packageReleases.findMany({
    where: and(
      eq(packageReleases.packageType, 'skill'),
      eq(packageReleases.packageId, id),
      eq(packageReleases.status, 'published')
    ),
    orderBy: desc(packageReleases.publishedAt),
    limit: 10,
  });

  return NextResponse.json({ skill, releases });
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  longDescription: z.string().optional(),
  triggerPatterns: z.array(z.string()).optional(),
  content: z.string().optional(),
  configSchema: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  compatibility: z.array(z.string()).optional(),
});

// PUT - Update skill
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const skill = await db.query.skillPackages.findFirst({
    where: eq(skillPackages.id, id),
  });

  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  if (skill.authorId !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const data = updateSchema.parse(body);

  await db
    .update(skillPackages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(skillPackages.id, id));

  return NextResponse.json({ success: true });
}

// DELETE - Delete skill
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const skill = await db.query.skillPackages.findFirst({
    where: eq(skillPackages.id, id),
  });

  if (!skill) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
  }

  if (skill.authorId !== session.userId && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db.delete(skillPackages).where(eq(skillPackages.id, id));

  return NextResponse.json({ success: true });
}
```

---

## Skill Types

| Type | Description | Example |
|------|-------------|---------|
| `command` | Slash command skill | `/commit`, `/review` |
| `prompt` | Prompt template | System prompts |
| `agent` | Autonomous agent | Code reviewer |

---

## Compatibility Options

```typescript
const COMPATIBILITY_OPTIONS = [
  'claude-code',
  'cursor',
  'windsurf',
  'aider',
  'copilot',
  'cody',
  'continue',
  'universal', // Works with any agent
];
```

---

## Response Shapes

### Skill (List)

```typescript
interface SkillListItem {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  skillType: 'command' | 'prompt' | 'agent';
  category: string | null;
  tags: string[];
  compatibility: string[];
  favoritesCount: number;
  downloadsCount: number;
  ratingAvg: number;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}
```

### Skill (Detail)

```typescript
interface SkillDetail extends SkillListItem {
  longDescription: string | null;
  triggerPatterns: string[];
  content: string;
  configSchema: Record<string, unknown> | null;
  dependencies: string[];
  updatedAt: string;
}
```

---

## Acceptance Criteria

- [ ] List skills with pagination
- [ ] Filter by category, type, compatibility
- [ ] Sort by latest/popular/downloads
- [ ] Search skills
- [ ] Get skill detail with releases
- [ ] Create skill (developer only)
- [ ] Update skill (owner only)
- [ ] Delete skill (owner only)
- [ ] Skill content stored correctly

---

## Notes

- Skills API mirrors MCP API structure
- `content` field stores the actual skill markdown/code
- `triggerPatterns` defines when skill activates
- `compatibility` helps users find skills for their agent
