import { db, collections, users } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, desc, ilike, or, and, count } from 'drizzle-orm';
import { CollectionCard } from './collection-card';
import { Pagination } from '@/components/shared/pagination';

interface CollectionsGridProps {
  searchParams: {
    q?: string;
    type?: string;
    page?: string;
  };
}

export async function CollectionsGrid({ searchParams }: CollectionsGridProps) {
  const session = await getSession();
  const { q, type, page = '1' } = searchParams;
  const limit = 12;
  const offset = (Number(page) - 1) * limit;

  // Build conditions
  const conditions = [];

  // Public collections, or user's private ones if logged in
  if (session?.userId) {
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

  if (type && (type === 'mcp' || type === 'skill')) {
    conditions.push(eq(collections.entityType, type));
  }

  // Query
  const results = await db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      isPublic: collections.isPublic,
      entityType: collections.entityType,
      favoritesCount: collections.favoritesCount,
      createdAt: collections.createdAt,
      ownerId: collections.ownerId,
      owner: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(collections)
    .leftJoin(users, eq(collections.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(collections.favoritesCount), desc(collections.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalResult] = await db
    .select({ count: count() })
    .from(collections)
    .where(and(...conditions));

  const total = totalResult?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

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

  // Filter out collections without owners (shouldn't happen, but handle gracefully)
  const validResults = results.filter(
    (c): c is typeof c & { owner: NonNullable<typeof c.owner> } =>
      c.owner !== null
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {validResults.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={{
              id: collection.id,
              name: collection.name,
              description: collection.description,
              isPublic: collection.isPublic,
              entityType: collection.entityType,
              favoritesCount: collection.favoritesCount,
              owner: collection.owner,
            }}
            isOwner={session?.userId === collection.ownerId}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={Number(page)} totalPages={totalPages} />
      )}
    </div>
  );
}
