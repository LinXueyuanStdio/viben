# T18: Collections UI

> Implement collections pages and components.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Task ID | T18 |
| Dependencies | T15 (Collections API), T3 (UI Shell) |
| Effort | 3 points |
| Priority | P2 |

---

## Objectives

1. Create collections listing page
2. Implement collection detail page
3. Add collection creation/edit UI
4. Enable fork functionality

---

## Deliverables

### 1. Collections List Page (`apps/web/app/(dashboard)/collections/page.tsx`)

```tsx
import { Suspense } from 'react';
import { CollectionsGrid } from '@/components/collections/collections-grid';
import { SearchInput } from '@/components/shared/search-input';
import { CreateCollectionButton } from '@/components/collections/create-collection-button';
import { getSession } from '@/lib/auth/cookies';

interface CollectionsPageProps {
  searchParams: {
    q?: string;
    page?: string;
  };
}

export default async function CollectionsPage({
  searchParams,
}: CollectionsPageProps) {
  const session = await getSession();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Collections</h1>
          <p className="mt-2 text-muted-foreground">
            Curated lists of MCP servers and skills
          </p>
        </div>
        {session && <CreateCollectionButton />}
      </div>

      <SearchInput
        placeholder="Search collections..."
        defaultValue={searchParams.q}
      />

      <Suspense fallback={<CollectionsGridSkeleton />}>
        <CollectionsGrid searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function CollectionsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="h-40 animate-pulse rounded-lg border bg-muted"
        />
      ))}
    </div>
  );
}
```

### 2. Collections Grid (`apps/web/components/collections/collections-grid.tsx`)

```tsx
import { db, collections, users } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, desc, ilike, or, and, sql } from 'drizzle-orm';
import { CollectionCard } from './collection-card';
import { Pagination } from '@/components/shared/pagination';

interface CollectionsGridProps {
  searchParams: {
    q?: string;
    page?: string;
  };
}

export async function CollectionsGrid({ searchParams }: CollectionsGridProps) {
  const session = await getSession();
  const { q, page = '1' } = searchParams;
  const limit = 12;
  const offset = (Number(page) - 1) * limit;

  // Build conditions
  const conditions = [];

  // Public collections, or user's private ones if logged in
  if (session) {
    conditions.push(
      or(
        eq(collections.isPublic, true),
        eq(collections.ownerId, session.userId)
      )
    );
  } else {
    conditions.push(eq(collections.isPublic, true));
  }

  if (q) {
    conditions.push(
      or(
        ilike(collections.name, `%${q}%`),
        ilike(collections.description, `%${q}%`)
      )
    );
  }

  const results = await db
    .select({
      id: collections.id,
      name: collections.name,
      slug: collections.slug,
      description: collections.description,
      isPublic: collections.isPublic,
      itemCount: collections.itemCount,
      forksCount: collections.forksCount,
      createdAt: collections.createdAt,
      owner: {
        id: users.id,
        username: users.username,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(collections)
    .leftJoin(users, eq(collections.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(collections.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(collections)
    .where(and(...conditions));

  const totalPages = Math.ceil(Number(count) / limit);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-lg text-muted-foreground">No collections found</p>
        {q && (
          <p className="mt-2 text-sm text-muted-foreground">
            Try adjusting your search
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {results.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            isOwner={session?.userId === collection.owner?.id}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={Number(page)} totalPages={totalPages} />
      )}
    </div>
  );
}
```

### 3. Collection Card (`apps/web/components/collections/collection-card.tsx`)

```tsx
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Layers, Lock, GitFork, Package } from 'lucide-react';

interface CollectionCardProps {
  collection: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPublic: boolean;
    itemCount: number;
    forksCount: number;
    createdAt: Date;
    owner: {
      id: string;
      username: string;
      avatarUrl: string | null;
    } | null;
  };
  isOwner: boolean;
}

export function CollectionCard({ collection, isOwner }: CollectionCardProps) {
  return (
    <Link href={`/collections/${collection.id}`}>
      <div className="group flex h-full flex-col rounded-lg border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-accent/50">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Layers className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold group-hover:text-primary">
                  {collection.name}
                </h3>
                {!collection.isPublic && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                @{collection.slug}
              </p>
            </div>
          </div>
          {isOwner && <Badge variant="outline">Owner</Badge>}
        </div>

        <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
          {collection.description || 'No description'}
        </p>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          {collection.owner && (
            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={collection.owner.avatarUrl || undefined} />
                <AvatarFallback>
                  {collection.owner.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>{collection.owner.username}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {collection.itemCount}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="h-3 w-3" />
              {collection.forksCount}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

### 4. Collection Detail Page (`apps/web/app/(dashboard)/collections/[id]/page.tsx`)

```tsx
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth/cookies';
import { db, collections, collectionItems } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { CollectionHeader } from '@/components/collections/collection-header';
import { CollectionItems } from '@/components/collections/collection-items';

interface CollectionDetailPageProps {
  params: { id: string };
}

export default async function CollectionDetailPage({
  params,
}: CollectionDetailPageProps) {
  const session = await getSession();

  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, params.id),
    with: {
      owner: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!collection) {
    notFound();
  }

  // Check access for private collections
  if (!collection.isPublic) {
    if (!session || session.userId !== collection.ownerId) {
      notFound();
    }
  }

  const isOwner = session?.userId === collection.ownerId;

  return (
    <div className="space-y-6">
      <CollectionHeader
        collection={collection}
        isOwner={isOwner}
        isLoggedIn={!!session}
      />
      <CollectionItems collectionId={collection.id} isOwner={isOwner} />
    </div>
  );
}
```

### 5. Collection Header (`apps/web/components/collections/collection-header.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Layers,
  Lock,
  Globe,
  GitFork,
  Package,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

interface CollectionHeaderProps {
  collection: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    isPublic: boolean;
    itemCount: number;
    forksCount: number;
    forkedFromId: string | null;
    owner: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    } | null;
  };
  isOwner: boolean;
  isLoggedIn: boolean;
}

export function CollectionHeader({
  collection,
  isOwner,
  isLoggedIn,
}: CollectionHeaderProps) {
  const router = useRouter();
  const [isForking, setIsForking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleFork() {
    setIsForking(true);
    try {
      const res = await fetch(`/api/collections/${collection.id}/fork`, {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error('Failed to fork collection');
      }

      const { collection: forked } = await res.json();
      toast.success('Collection forked!');
      router.push(`/collections/${forked.id}`);
    } catch (error) {
      toast.error('Failed to fork collection');
    } finally {
      setIsForking(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this collection?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await fetch(`/api/collections/${collection.id}`, {
        method: 'DELETE',
      });
      toast.success('Collection deleted');
      router.push('/collections');
    } catch (error) {
      toast.error('Failed to delete collection');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-purple-500/10">
            <Layers className="h-8 w-8 text-purple-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{collection.name}</h1>
              <Badge variant={collection.isPublic ? 'secondary' : 'outline'}>
                {collection.isPublic ? (
                  <>
                    <Globe className="mr-1 h-3 w-3" />
                    Public
                  </>
                ) : (
                  <>
                    <Lock className="mr-1 h-3 w-3" />
                    Private
                  </>
                )}
              </Badge>
            </div>
            <p className="text-muted-foreground">@{collection.slug}</p>
            {collection.description && (
              <p className="mt-2">{collection.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn && !isOwner && collection.isPublic && (
            <Button
              variant="outline"
              onClick={handleFork}
              disabled={isForking}
            >
              {isForking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <GitFork className="mr-2 h-4 w-4" />
              )}
              Fork
            </Button>
          )}

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/collections/${collection.id}/edit`)
                  }
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive"
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6 text-sm text-muted-foreground">
        {collection.owner && (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={collection.owner.avatarUrl || undefined} />
              <AvatarFallback>
                {collection.owner.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span>by {collection.owner.displayName}</span>
          </div>
        )}
        <span className="flex items-center gap-1">
          <Package className="h-4 w-4" />
          {collection.itemCount} items
        </span>
        <span className="flex items-center gap-1">
          <GitFork className="h-4 w-4" />
          {collection.forksCount} forks
        </span>
      </div>
    </div>
  );
}
```

### 6. Collection Items (`apps/web/components/collections/collection-items.tsx`)

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Plus,
  Trash2,
  Server,
  Zap,
  GripVertical,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AddItemDialog } from './add-item-dialog';

interface CollectionItem {
  id: string;
  itemId: string;
  itemType: 'mcp' | 'skill';
  note: string | null;
  position: number;
  package?: {
    id: string;
    name: string;
    slug: string;
    version: string;
    description: string;
    favoritesCount: number;
    downloadsCount: number;
  };
}

interface CollectionItemsProps {
  collectionId: string;
  isOwner: boolean;
}

export function CollectionItems({
  collectionId,
  isOwner,
}: CollectionItemsProps) {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [collectionId]);

  async function fetchItems() {
    try {
      const res = await fetch(`/api/collections/${collectionId}`);
      const data = await res.json();
      setItems(data.items);
    } catch (error) {
      toast.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(itemId: string) {
    try {
      await fetch(`/api/collections/${collectionId}/items/${itemId}`, {
        method: 'DELETE',
      });
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      toast.success('Item removed');
    } catch (error) {
      toast.error('Failed to remove item');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Items</h2>
        {isOwner && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">This collection is empty</p>
          {isOwner && (
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowAdd(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add your first item
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-center gap-4">
                {isOwner && (
                  <GripVertical className="h-5 w-5 cursor-grab text-muted-foreground" />
                )}

                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  {item.itemType === 'mcp' ? (
                    <Server className="h-5 w-5 text-blue-500" />
                  ) : (
                    <Zap className="h-5 w-5 text-yellow-500" />
                  )}
                </div>

                <div className="flex-1">
                  <Link
                    href={`/${item.itemType === 'mcp' ? 'mcp' : 'skills'}/${item.package?.id}`}
                    className="font-semibold hover:text-primary"
                  >
                    {item.package?.name || 'Unknown Package'}
                  </Link>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {item.package?.description}
                  </p>
                  {item.note && (
                    <p className="mt-1 text-sm italic text-muted-foreground">
                      "{item.note}"
                    </p>
                  )}
                </div>

                <Badge variant="secondary">
                  {item.itemType === 'mcp' ? 'MCP' : 'Skill'}
                </Badge>

                <span className="text-sm text-muted-foreground">
                  v{item.package?.version}
                </span>

                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddItemDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        collectionId={collectionId}
        onAdded={fetchItems}
      />
    </div>
  );
}
```

### 7. Create Collection Button (`apps/web/components/collections/create-collection-button.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers, and hyphens only'),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
});

type CreateValues = z.infer<typeof createSchema>;

export function CreateCollectionButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      isPublic: true,
    },
  });

  async function onSubmit(data: CreateValues) {
    setIsLoading(true);

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create collection');
      }

      const { collection } = await response.json();
      toast.success('Collection created');
      setOpen(false);
      form.reset();
      router.push(`/collections/${collection.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Collection
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Create Collection</DialogTitle>
            <DialogDescription>
              Create a curated list of MCP servers and skills to share.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="My Awesome Collection"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                placeholder="my-awesome-collection"
                {...form.register('slug')}
              />
              {form.formState.errors.slug && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.slug.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What is this collection about?"
                {...form.register('description')}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Public</Label>
                <p className="text-xs text-muted-foreground">
                  Anyone can view this collection
                </p>
              </div>
              <Switch
                checked={form.watch('isPublic')}
                onCheckedChange={(checked) => form.setValue('isPublic', checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Collection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Required shadcn/ui Components

```bash
pnpm dlx shadcn@latest add dropdown-menu
```

---

## Acceptance Criteria

- [ ] Collections list shows public collections
- [ ] Search filters collections
- [ ] User's private collections shown when logged in
- [ ] Collection cards show item count and forks
- [ ] Create collection dialog works
- [ ] Public/private toggle works
- [ ] Collection detail page shows all items
- [ ] Add item to collection works
- [ ] Remove item from collection works
- [ ] Fork collection creates copy
- [ ] Edit collection settings works
- [ ] Delete collection works
- [ ] Items show package details

---

## Notes

- Collections can mix MCP and Skills
- Items ordered by position (drag reorder future enhancement)
- Forked collections start private
- Slug unique per user, not global
- Lock icon indicates private collections
