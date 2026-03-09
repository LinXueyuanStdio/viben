# T8: MCP UI

> Implement MCP marketplace UI pages and components.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T8 |
| Dependencies | T5 (MCP API), T3 (UI Shell) |
| Effort | 5 points |
| Priority | P0 |

---

## Objectives

1. Create MCP marketplace listing page
2. Create MCP detail page
3. Implement search and filtering
4. Add favorite/rating interactions

---

## Deliverables

### 1. Marketplace Page (`apps/web/app/(dashboard)/mcp/page.tsx`)

```tsx
import { Suspense } from 'react';
import { McpGrid } from '@/components/mcp/mcp-grid';
import { McpFilters } from '@/components/mcp/mcp-filters';
import { SearchInput } from '@/components/shared/search-input';

interface McpPageProps {
  searchParams: {
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  };
}

export default function McpPage({ searchParams }: McpPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">MCP Marketplace</h1>
        <p className="mt-2 text-muted-foreground">
          Discover and install Model Context Protocol servers
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchInput
          placeholder="Search MCP packages..."
          defaultValue={searchParams.q}
        />
        <McpFilters
          category={searchParams.category}
          sort={searchParams.sort}
        />
      </div>

      <Suspense fallback={<McpGridSkeleton />}>
        <McpGrid searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function McpGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-lg border bg-muted"
        />
      ))}
    </div>
  );
}
```

### 2. MCP Grid Component (`apps/web/components/mcp/mcp-grid.tsx`)

```tsx
import { db, mcpPackages, users } from '@/lib/db';
import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';
import { McpCard } from './mcp-card';
import { Pagination } from '@/components/shared/pagination';

interface McpGridProps {
  searchParams: {
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  };
}

export async function McpGrid({ searchParams }: McpGridProps) {
  const { q, category, sort = 'latest', page = '1' } = searchParams;
  const limit = 12;
  const offset = (Number(page) - 1) * limit;

  // Build conditions
  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(mcpPackages.name, `%${q}%`),
        ilike(mcpPackages.description, `%${q}%`)
      )
    );
  }
  if (category) {
    conditions.push(eq(mcpPackages.category, category));
  }

  // Build order
  const orderBy =
    sort === 'popular'
      ? desc(mcpPackages.favoritesCount)
      : sort === 'downloads'
      ? desc(mcpPackages.downloadsCount)
      : desc(mcpPackages.createdAt);

  // Query
  const packages = await db
    .select({
      id: mcpPackages.id,
      name: mcpPackages.name,
      slug: mcpPackages.slug,
      version: mcpPackages.version,
      description: mcpPackages.description,
      category: mcpPackages.category,
      transport: mcpPackages.transport,
      favoritesCount: mcpPackages.favoritesCount,
      downloadsCount: mcpPackages.downloadsCount,
      ratingAvg: mcpPackages.ratingAvg,
      author: {
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(mcpPackages)
    .leftJoin(users, eq(mcpPackages.authorId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(mcpPackages)
    .where(conditions.length ? and(...conditions) : undefined);

  const totalPages = Math.ceil(Number(count) / limit);

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">No packages found</p>
        {q && (
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search or filters
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <McpCard key={pkg.id} package={pkg} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={Number(page)} totalPages={totalPages} />
      )}
    </div>
  );
}
```

### 3. MCP Card (`apps/web/components/mcp/mcp-card.tsx`)

```tsx
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, Download, Star } from 'lucide-react';

interface McpCardProps {
  package: {
    id: string;
    name: string;
    slug: string;
    version: string;
    description: string | null;
    category: string | null;
    transport: string;
    favoritesCount: number;
    downloadsCount: number;
    ratingAvg: number;
    author: {
      username: string;
      avatarUrl: string | null;
    } | null;
  };
}

export function McpCard({ package: pkg }: McpCardProps) {
  return (
    <Link href={`/mcp/${pkg.id}`}>
      <div className="group relative flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold group-hover:text-primary">
              {pkg.name}
            </h3>
            <p className="text-xs text-muted-foreground">v{pkg.version}</p>
          </div>
          <Badge variant="secondary">{pkg.transport}</Badge>
        </div>

        <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
          {pkg.description || 'No description'}
        </p>

        <div className="mt-4 flex items-center justify-between">
          {pkg.author && (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={pkg.author.avatarUrl || undefined} />
                <AvatarFallback>
                  {pkg.author.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {pkg.author.username}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {pkg.favoritesCount}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {pkg.downloadsCount}
            </span>
            {pkg.ratingAvg > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {pkg.ratingAvg.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
```

### 4. MCP Detail Page (`apps/web/app/(dashboard)/mcp/[id]/page.tsx`)

```tsx
import { notFound } from 'next/navigation';
import { db, mcpPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { McpHeader } from '@/components/mcp/mcp-header';
import { McpReadme } from '@/components/mcp/mcp-readme';
import { McpSidebar } from '@/components/mcp/mcp-sidebar';
import { McpComments } from '@/components/mcp/mcp-comments';

interface McpDetailPageProps {
  params: { id: string };
}

export default async function McpDetailPage({ params }: McpDetailPageProps) {
  const pkg = await db.query.mcpPackages.findFirst({
    where: eq(mcpPackages.id, params.id),
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

  if (!pkg) {
    notFound();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <McpHeader package={pkg} />
        <McpReadme content={pkg.longDescription} />
        <McpComments packageId={pkg.id} />
      </div>
      <McpSidebar package={pkg} />
    </div>
  );
}
```

### 5. MCP Header (`apps/web/components/mcp/mcp-header.tsx`)

```tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, Download, Star, ExternalLink } from 'lucide-react';
import { FavoriteButton } from './favorite-button';
import { RatingButton } from './rating-button';

interface McpHeaderProps {
  package: {
    id: string;
    name: string;
    version: string;
    description: string | null;
    transport: string;
    category: string | null;
    tags: string[] | null;
    favoritesCount: number;
    downloadsCount: number;
    ratingAvg: number;
    ratingCount: number;
    repositoryUrl: string | null;
    author: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    } | null;
  };
}

export function McpHeader({ package: pkg }: McpHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{pkg.name}</h1>
            <Badge variant="secondary">v{pkg.version}</Badge>
            <Badge>{pkg.transport}</Badge>
          </div>
          <p className="mt-2 text-lg text-muted-foreground">
            {pkg.description}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {pkg.author && (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={pkg.author.avatarUrl || undefined} />
              <AvatarFallback>
                {pkg.author.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm">
              by <span className="font-medium">{pkg.author.displayName}</span>
            </span>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Heart className="h-4 w-4" />
            {pkg.favoritesCount} favorites
          </span>
          <span className="flex items-center gap-1">
            <Download className="h-4 w-4" />
            {pkg.downloadsCount} downloads
          </span>
          {pkg.ratingCount > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {pkg.ratingAvg.toFixed(1)} ({pkg.ratingCount})
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button asChild>
          <a href={`/api/packages/mcp/${pkg.id}/download`}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </a>
        </Button>
        <FavoriteButton packageId={pkg.id} entityType="mcp" />
        <RatingButton packageId={pkg.id} entityType="mcp" />
        {pkg.repositoryUrl && (
          <Button variant="outline" asChild>
            <a href={pkg.repositoryUrl} target="_blank" rel="noopener">
              <ExternalLink className="mr-2 h-4 w-4" />
              Repository
            </a>
          </Button>
        )}
      </div>

      {pkg.tags && pkg.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pkg.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Required shadcn/ui Components

```bash
pnpm dlx shadcn@latest add avatar
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add card
pnpm dlx shadcn@latest add select
```

---

## Acceptance Criteria

- [ ] Marketplace shows paginated grid
- [ ] Search filters results
- [ ] Category filter works
- [ ] Sort options work (latest/popular/downloads)
- [ ] Package cards show key info
- [ ] Detail page shows full info
- [ ] Favorite button works (logged in)
- [ ] Rating button works (logged in)
- [ ] Download button triggers download
- [ ] Comments section loads

---

## Notes

- Server components for data fetching
- Client components for interactions
- Suspense boundaries for loading
- URL-based filtering for shareability
