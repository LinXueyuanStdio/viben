# T9: Skills UI

> Implement Skills marketplace UI pages and components.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T9 |
| Dependencies | T6 (Skills API), T3 (UI Shell) |
| Effort | 5 points |
| Priority | P0 |

---

## Objectives

1. Create Skills marketplace listing page
2. Create Skill detail page
3. Implement search and filtering
4. Add favorite/rating interactions

---

## Deliverables

### 1. Marketplace Page (`apps/web/app/(dashboard)/skills/page.tsx`)

```tsx
import { Suspense } from 'react';
import { SkillsGrid } from '@/components/skills/skills-grid';
import { SkillsFilters } from '@/components/skills/skills-filters';
import { SearchInput } from '@/components/shared/search-input';

interface SkillsPageProps {
  searchParams: {
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  };
}

export default function SkillsPage({ searchParams }: SkillsPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Skills Marketplace</h1>
        <p className="mt-2 text-muted-foreground">
          Discover and install AI agent skills and capabilities
        </p>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <SearchInput
          placeholder="Search skills..."
          defaultValue={searchParams.q}
        />
        <SkillsFilters
          category={searchParams.category}
          sort={searchParams.sort}
        />
      </div>

      <Suspense fallback={<SkillsGridSkeleton />}>
        <SkillsGrid searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function SkillsGridSkeleton() {
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

### 2. Skills Grid Component (`apps/web/components/skills/skills-grid.tsx`)

```tsx
import { db, skillPackages, users } from '@/lib/db';
import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';
import { SkillCard } from './skill-card';
import { Pagination } from '@/components/shared/pagination';

interface SkillsGridProps {
  searchParams: {
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  };
}

export async function SkillsGrid({ searchParams }: SkillsGridProps) {
  const { q, category, sort = 'latest', page = '1' } = searchParams;
  const limit = 12;
  const offset = (Number(page) - 1) * limit;

  // Build conditions
  const conditions = [];
  if (q) {
    conditions.push(
      or(
        ilike(skillPackages.name, `%${q}%`),
        ilike(skillPackages.description, `%${q}%`)
      )
    );
  }
  if (category) {
    conditions.push(eq(skillPackages.category, category));
  }

  // Build order
  const orderBy =
    sort === 'popular'
      ? desc(skillPackages.favoritesCount)
      : sort === 'downloads'
      ? desc(skillPackages.downloadsCount)
      : desc(skillPackages.createdAt);

  // Query
  const packages = await db
    .select({
      id: skillPackages.id,
      name: skillPackages.name,
      slug: skillPackages.slug,
      version: skillPackages.version,
      description: skillPackages.description,
      category: skillPackages.category,
      skillType: skillPackages.skillType,
      favoritesCount: skillPackages.favoritesCount,
      downloadsCount: skillPackages.downloadsCount,
      ratingAvg: skillPackages.ratingAvg,
      author: {
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(skillPackages)
    .leftJoin(users, eq(skillPackages.authorId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(skillPackages)
    .where(conditions.length ? and(...conditions) : undefined);

  const totalPages = Math.ceil(Number(count) / limit);

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">No skills found</p>
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
          <SkillCard key={pkg.id} package={pkg} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={Number(page)} totalPages={totalPages} />
      )}
    </div>
  );
}
```

### 3. Skill Card (`apps/web/components/skills/skill-card.tsx`)

```tsx
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Heart, Download, Star, Zap } from 'lucide-react';

interface SkillCardProps {
  package: {
    id: string;
    name: string;
    slug: string;
    version: string;
    description: string | null;
    category: string | null;
    skillType: string;
    favoritesCount: number;
    downloadsCount: number;
    ratingAvg: number;
    author: {
      username: string;
      avatarUrl: string | null;
    } | null;
  };
}

export function SkillCard({ package: pkg }: SkillCardProps) {
  return (
    <Link href={`/skills/${pkg.id}`}>
      <div className="group relative flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              <h3 className="font-semibold group-hover:text-primary">
                {pkg.name}
              </h3>
            </div>
            <p className="text-xs text-muted-foreground">v{pkg.version}</p>
          </div>
          <Badge variant="secondary">{pkg.skillType}</Badge>
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

### 4. Skill Detail Page (`apps/web/app/(dashboard)/skills/[id]/page.tsx`)

```tsx
import { notFound } from 'next/navigation';
import { db, skillPackages } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { SkillHeader } from '@/components/skills/skill-header';
import { SkillReadme } from '@/components/skills/skill-readme';
import { SkillSidebar } from '@/components/skills/skill-sidebar';
import { SkillComments } from '@/components/skills/skill-comments';

interface SkillDetailPageProps {
  params: { id: string };
}

export default async function SkillDetailPage({ params }: SkillDetailPageProps) {
  const pkg = await db.query.skillPackages.findFirst({
    where: eq(skillPackages.id, params.id),
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
        <SkillHeader package={pkg} />
        <SkillReadme content={pkg.longDescription} />
        <SkillComments packageId={pkg.id} />
      </div>
      <SkillSidebar package={pkg} />
    </div>
  );
}
```

### 5. Skill Filters (`apps/web/components/skills/skills-filters.tsx`)

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const SKILL_CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'automation', label: 'Automation' },
  { value: 'coding', label: 'Coding' },
  { value: 'data', label: 'Data Processing' },
  { value: 'communication', label: 'Communication' },
  { value: 'research', label: 'Research' },
  { value: 'other', label: 'Other' },
];

const SORT_OPTIONS = [
  { value: 'latest', label: 'Latest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'downloads', label: 'Most Downloads' },
];

interface SkillsFiltersProps {
  category?: string;
  sort?: string;
}

export function SkillsFilters({ category, sort }: SkillsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset pagination
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex gap-2">
      <Select
        value={category || 'all'}
        onValueChange={(v) => updateFilter('category', v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {SKILL_CATEGORIES.map((cat) => (
            <SelectItem key={cat.value} value={cat.value}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={sort || 'latest'}
        onValueChange={(v) => updateFilter('sort', v)}
      >
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

---

## Acceptance Criteria

- [ ] Marketplace shows paginated grid
- [ ] Search filters results
- [ ] Category filter works
- [ ] Sort options work (latest/popular/downloads)
- [ ] Skill cards show key info with icon
- [ ] Detail page shows full info
- [ ] Favorite button works (logged in)
- [ ] Rating button works (logged in)
- [ ] Download button triggers download
- [ ] Comments section loads

---

## Notes

- Mirrors MCP UI structure for consistency
- Uses Zap icon to differentiate from MCP
- Server components for data fetching
- Client components for interactions
- URL-based filtering for shareability
