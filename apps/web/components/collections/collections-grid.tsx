import { db, collections, users, bookmarks } from '@/lib/db';
import { getSession } from '@/lib/auth/cookies';
import { eq, desc, ilike, or, and, count, inArray } from 'drizzle-orm';
import { CollectionCard } from './collection-card';
import { CollectionsEmpty } from './collections-empty';
import { Pagination } from '@/components/shared/pagination';

interface CollectionsGridProps {
  searchParams: {
    q?: string;
    sort?: string;
    page?: string;
  };
}

export async function CollectionsGrid({ searchParams }: CollectionsGridProps) {
  const session = await getSession();
  const { q, sort, page = '1' } = searchParams;
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
        ilike(collections.slug, `%${q}%`),
        ilike(collections.description, `%${q}%`)
      )
    );
  }

  // Build order by clause based on sort param
  function getOrderBy() {
    switch (sort) {
      case 'recent':
        return [desc(collections.createdAt)];
      case 'items':
        return [desc(collections.itemCount), desc(collections.createdAt)];
      case 'forks':
        return [desc(collections.forksCount), desc(collections.createdAt)];
      default: // 'default' or undefined = most popular
        return [desc(collections.bookmarksCount), desc(collections.createdAt)];
    }
  }

  // Query
  const results = await db
    .select({
      id: collections.id,
      name: collections.name,
      slug: collections.slug,
      description: collections.description,
      isPublic: collections.isPublic,
      itemCount: collections.itemCount,
      forksCount: collections.forksCount,
      bookmarksCount: collections.bookmarksCount,
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
    .orderBy(...getOrderBy())
    .limit(limit)
    .offset(offset);

  const [totalResult] = await db
    .select({ count: count() })
    .from(collections)
    .where(and(...conditions));

  const total = totalResult?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  if (results.length === 0) {
    return <CollectionsEmpty hasQuery={!!q} />;
  }

  // Filter out collections without owners (shouldn't happen, but handle gracefully)
  const validResults = results.filter(
    (c): c is typeof c & { owner: NonNullable<typeof c.owner> } =>
      c.owner !== null
  );

  // Query user's bookmarks for displayed collections
  const bookmarkedIds = new Set<string>();
  if (session?.userId && validResults.length > 0) {
    const userBookmarks = await db
      .select({ entityId: bookmarks.entityId })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.userId, session.userId),
          eq(bookmarks.entityType, 'collection'),
          inArray(bookmarks.entityId, validResults.map((c) => c.id))
        )
      );
    for (const b of userBookmarks) {
      bookmarkedIds.add(b.entityId);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {validResults.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={{
              id: collection.id,
              name: collection.name,
              slug: collection.slug,
              description: collection.description,
              isPublic: collection.isPublic,
              itemCount: collection.itemCount,
              forksCount: collection.forksCount,
              bookmarksCount: collection.bookmarksCount,
              owner: collection.owner,
            }}
            isOwner={session?.userId === collection.ownerId}
            isAuthenticated={!!session}
            hasBookmarked={bookmarkedIds.has(collection.id)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={Number(page)} totalPages={totalPages} />
      )}
    </div>
  );
}
