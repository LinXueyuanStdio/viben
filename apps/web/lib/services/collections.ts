import { db, collections, collectionItems, mcpPackages, skillPackages } from '@/lib/db';
import { eq, and, desc, max, asc, sql } from 'drizzle-orm';
import { slugify, generateId } from '@/lib/utils';

// ============================================
// Types
// ============================================

export interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  ownerId: string;
  isPublic: boolean;
  itemCount: number;
  forksCount: number;
  forkedFromId: string | null;
  bookmarksCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionWithOwner extends Collection {
  owner: {
    id: string;
    username: string;
    userSlug: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface CollectionItem {
  id: string;
  itemId: string;
  itemType: 'mcp' | 'skill';
  note: string | null;
  position: number;
  addedAt: Date;
  package?: {
    id: string;
    name: string;
    slug: string;
    description: string;
    version: string;
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique slug for a collection within a user's namespace.
 */
async function generateUniqueSlug(
  userId: string,
  baseName: string
): Promise<string> {
  let baseSlug = slugify(baseName);
  if (!baseSlug) {
    baseSlug = 'collection';
  }

  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await db.query.collections.findFirst({
      where: and(
        eq(collections.ownerId, userId),
        eq(collections.slug, slug)
      ),
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    // Safety limit
    if (counter > 1000) {
      slug = `${baseSlug}-${generateId().slice(0, 8)}`;
      return slug;
    }
  }
}

// ============================================
// Collection CRUD
// ============================================

export async function listPublicCollections(): Promise<CollectionWithOwner[]> {
  const results = await db.query.collections.findMany({
    where: eq(collections.isPublic, true),
    orderBy: [desc(collections.bookmarksCount), desc(collections.createdAt)],
    with: {
      owner: {
        columns: {
          id: true,
          username: true,
          userSlug: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return results;
}

export async function listUserCollections(userId: string): Promise<CollectionWithOwner[]> {
  const results = await db.query.collections.findMany({
    where: eq(collections.ownerId, userId),
    orderBy: [desc(collections.createdAt)],
    with: {
      owner: {
        columns: {
          id: true,
          username: true,
          userSlug: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return results;
}

export async function getCollection(
  collectionId: string,
  userId?: string
): Promise<CollectionWithOwner | null> {
  const result = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
    with: {
      owner: {
        columns: {
          id: true,
          username: true,
          userSlug: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (!result) return null;

  // Check access
  if (!result.isPublic && result.ownerId !== userId) {
    return null;
  }

  return result;
}

export interface CreateCollectionInput {
  name: string;
  slug?: string;
  description?: string;
  isPublic?: boolean;
}

export async function createCollection(
  userId: string,
  input: CreateCollectionInput
): Promise<Collection> {
  // Generate slug if not provided
  let slug = input.slug;
  if (!slug) {
    slug = await generateUniqueSlug(userId, input.name);
  } else {
    // Validate provided slug is unique for this user
    const existing = await db.query.collections.findFirst({
      where: and(
        eq(collections.ownerId, userId),
        eq(collections.slug, slug)
      ),
    });

    if (existing) {
      throw new Error('Collection slug already exists');
    }
  }

  const [collection] = await db
    .insert(collections)
    .values({
      name: input.name,
      slug,
      description: input.description || null,
      ownerId: userId,
      isPublic: input.isPublic ?? true,
      itemCount: 0,
      forksCount: 0,
    })
    .returning();

  return collection;
}

export interface UpdateCollectionInput {
  name?: string;
  slug?: string;
  description?: string;
  isPublic?: boolean;
}

export async function updateCollection(
  collectionId: string,
  userId: string,
  input: UpdateCollectionInput
): Promise<Collection | null> {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!collection || collection.ownerId !== userId) {
    return null;
  }

  // If updating slug, validate uniqueness
  if (input.slug && input.slug !== collection.slug) {
    const existing = await db.query.collections.findFirst({
      where: and(
        eq(collections.ownerId, userId),
        eq(collections.slug, input.slug)
      ),
    });

    if (existing) {
      throw new Error('Collection slug already exists');
    }
  }

  const [updated] = await db
    .update(collections)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
    })
    .where(eq(collections.id, collectionId))
    .returning();

  return updated;
}

export async function deleteCollection(
  collectionId: string,
  userId: string
): Promise<boolean> {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!collection || collection.ownerId !== userId) {
    return false;
  }

  await db.delete(collections).where(eq(collections.id, collectionId));
  return true;
}

// ============================================
// Collection Items
// ============================================

export async function listCollectionItems(
  collectionId: string,
  userId?: string
): Promise<CollectionItem[]> {
  const collection = await getCollection(collectionId, userId);
  if (!collection) return [];

  const items = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, collectionId),
    orderBy: [asc(collectionItems.position)],
  });

  const results: CollectionItem[] = [];

  for (const item of items) {
    let pkg = null;

    if (item.itemType === 'mcp') {
      pkg = await db.query.mcpPackages.findFirst({
        where: eq(mcpPackages.id, item.itemId),
        columns: {
          id: true,
          name: true,
          slug: true,
          description: true,
          version: true,
        },
      });
    } else {
      pkg = await db.query.skillPackages.findFirst({
        where: eq(skillPackages.id, item.itemId),
        columns: {
          id: true,
          name: true,
          slug: true,
          description: true,
          version: true,
        },
      });
    }

    results.push({
      id: item.id,
      itemId: item.itemId,
      itemType: item.itemType,
      note: item.note,
      position: item.position,
      addedAt: item.addedAt,
      package: pkg || undefined,
    });
  }

  return results;
}

export interface AddItemInput {
  itemId: string;
  itemType: 'mcp' | 'skill';
  note?: string;
}

export async function addItemToCollection(
  collectionId: string,
  userId: string,
  input: AddItemInput
): Promise<{ success: boolean; item?: CollectionItem }> {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!collection || collection.ownerId !== userId) {
    return { success: false };
  }

  // Check if already exists
  const existing = await db.query.collectionItems.findFirst({
    where: and(
      eq(collectionItems.collectionId, collectionId),
      eq(collectionItems.itemId, input.itemId)
    ),
  });

  if (existing) {
    // Update note if already exists
    await db
      .update(collectionItems)
      .set({ note: input.note || null })
      .where(eq(collectionItems.id, existing.id));

    return {
      success: true,
      item: {
        id: existing.id,
        itemId: existing.itemId,
        itemType: existing.itemType,
        note: input.note || null,
        position: existing.position,
        addedAt: existing.addedAt,
      },
    };
  }

  // Get next position
  const [maxResult] = await db
    .select({ maxPos: max(collectionItems.position) })
    .from(collectionItems)
    .where(eq(collectionItems.collectionId, collectionId));

  const position = (maxResult?.maxPos ?? -1) + 1;

  // Insert new item
  const [newItem] = await db
    .insert(collectionItems)
    .values({
      collectionId,
      itemId: input.itemId,
      itemType: input.itemType,
      note: input.note || null,
      position,
    })
    .returning();

  // Update item count
  await db
    .update(collections)
    .set({ itemCount: collection.itemCount + 1 })
    .where(eq(collections.id, collectionId));

  return {
    success: true,
    item: {
      id: newItem.id,
      itemId: newItem.itemId,
      itemType: newItem.itemType,
      note: newItem.note,
      position: newItem.position,
      addedAt: newItem.addedAt,
    },
  };
}

export async function removeItemFromCollection(
  collectionId: string,
  userId: string,
  itemId: string
): Promise<boolean> {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!collection || collection.ownerId !== userId) {
    return false;
  }

  const item = await db.query.collectionItems.findFirst({
    where: and(
      eq(collectionItems.collectionId, collectionId),
      eq(collectionItems.itemId, itemId)
    ),
  });

  if (!item) {
    return false;
  }

  await db
    .delete(collectionItems)
    .where(eq(collectionItems.id, item.id));

  // Update item count
  await db
    .update(collections)
    .set({ itemCount: Math.max(0, collection.itemCount - 1) })
    .where(eq(collections.id, collectionId));

  return true;
}

/**
 * Reorder items in a collection
 */
export async function reorderCollectionItems(
  collectionId: string,
  userId: string,
  itemIds: string[]
): Promise<boolean> {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!collection || collection.ownerId !== userId) {
    return false;
  }

  // Update positions based on array order
  for (let i = 0; i < itemIds.length; i++) {
    await db
      .update(collectionItems)
      .set({ position: i })
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.itemId, itemIds[i])
        )
      );
  }

  return true;
}

// ============================================
// Fork Collection
// ============================================

export async function forkCollection(
  collectionId: string,
  userId: string
): Promise<Collection | null> {
  const original = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!original) return null;

  // Check access (can only fork public or own collections)
  if (!original.isPublic && original.ownerId !== userId) {
    return null;
  }

  // Generate unique slug for fork
  const slug = await generateUniqueSlug(userId, `${original.slug}-fork`);

  // Create new collection
  const [forked] = await db
    .insert(collections)
    .values({
      name: `${original.name} (Fork)`,
      slug,
      description: original.description,
      ownerId: userId,
      isPublic: false, // Forks start private
      forkedFromId: original.id,
      itemCount: 0,
      forksCount: 0,
    })
    .returning();

  // Copy items
  const items = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, collectionId),
    orderBy: [asc(collectionItems.position)],
  });

  if (items.length > 0) {
    await db.insert(collectionItems).values(
      items.map((item, index) => ({
        collectionId: forked.id,
        itemId: item.itemId,
        itemType: item.itemType,
        note: item.note,
        position: index,
      }))
    );

    // Update forked collection item count
    await db
      .update(collections)
      .set({ itemCount: items.length })
      .where(eq(collections.id, forked.id));
  }

  // Increment forks count on original
  await db
    .update(collections)
    .set({ forksCount: sql`${collections.forksCount} + 1` })
    .where(eq(collections.id, collectionId));

  return forked;
}
