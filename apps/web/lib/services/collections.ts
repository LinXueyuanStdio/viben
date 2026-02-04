import { db, collections, collectionItems, mcpPackages, skillPackages } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isPublic: boolean;
  entityType: 'mcp' | 'skill';
  favoritesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectionWithOwner extends Collection {
  owner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface CollectionItem {
  entityId: string;
  note: string | null;
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
// Collection CRUD
// ============================================

export async function listPublicCollections(
  entityType?: 'mcp' | 'skill'
): Promise<CollectionWithOwner[]> {
  const conditions = [eq(collections.isPublic, true)];
  if (entityType) {
    conditions.push(eq(collections.entityType, entityType));
  }

  const results = await db.query.collections.findMany({
    where: and(...conditions),
    orderBy: [desc(collections.favoritesCount), desc(collections.createdAt)],
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
  description?: string;
  entityType: 'mcp' | 'skill';
  isPublic?: boolean;
}

export async function createCollection(
  userId: string,
  input: CreateCollectionInput
): Promise<Collection> {
  const [collection] = await db
    .insert(collections)
    .values({
      name: input.name,
      description: input.description || null,
      ownerId: userId,
      entityType: input.entityType,
      isPublic: input.isPublic ?? true,
    })
    .returning();

  return collection;
}

export interface UpdateCollectionInput {
  name?: string;
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

  const [updated] = await db
    .update(collections)
    .set({
      ...(input.name !== undefined && { name: input.name }),
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
  });

  const results: CollectionItem[] = [];

  for (const item of items) {
    let pkg = null;

    if (collection.entityType === 'mcp') {
      pkg = await db.query.mcpPackages.findFirst({
        where: eq(mcpPackages.id, item.entityId),
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
        where: eq(skillPackages.id, item.entityId),
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
      entityId: item.entityId,
      note: item.note,
      addedAt: item.addedAt,
      package: pkg || undefined,
    });
  }

  return results;
}

export interface AddItemInput {
  entityId: string;
  note?: string;
}

export async function addItemToCollection(
  collectionId: string,
  userId: string,
  input: AddItemInput
): Promise<boolean> {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!collection || collection.ownerId !== userId) {
    return false;
  }

  // Check if already exists
  const existing = await db.query.collectionItems.findFirst({
    where: and(
      eq(collectionItems.collectionId, collectionId),
      eq(collectionItems.entityId, input.entityId)
    ),
  });

  if (existing) {
    // Update note
    await db
      .update(collectionItems)
      .set({ note: input.note || null })
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.entityId, input.entityId)
        )
      );
  } else {
    await db.insert(collectionItems).values({
      collectionId,
      entityId: input.entityId,
      note: input.note || null,
    });
  }

  return true;
}

export async function removeItemFromCollection(
  collectionId: string,
  userId: string,
  entityId: string
): Promise<boolean> {
  const collection = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
  });

  if (!collection || collection.ownerId !== userId) {
    return false;
  }

  await db
    .delete(collectionItems)
    .where(
      and(
        eq(collectionItems.collectionId, collectionId),
        eq(collectionItems.entityId, entityId)
      )
    );

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

  // Create new collection
  const [forked] = await db
    .insert(collections)
    .values({
      name: `${original.name} (Fork)`,
      description: original.description,
      ownerId: userId,
      entityType: original.entityType,
      isPublic: false, // Forks start private
    })
    .returning();

  // Copy items
  const items = await db.query.collectionItems.findMany({
    where: eq(collectionItems.collectionId, collectionId),
  });

  if (items.length > 0) {
    await db.insert(collectionItems).values(
      items.map((item) => ({
        collectionId: forked.id,
        entityId: item.entityId,
        note: item.note,
      }))
    );
  }

  return forked;
}
