import { db, workspaces, workspaceEntities, mcpPackages, skillPackages } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceWithOwner extends Workspace {
  owner: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export interface WorkspaceEntity {
  entityType: 'mcp' | 'skill';
  entityId: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
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
// Workspace CRUD
// ============================================

export async function listWorkspaces(userId: string): Promise<WorkspaceWithOwner[]> {
  const results = await db.query.workspaces.findMany({
    where: eq(workspaces.ownerId, userId),
    orderBy: [desc(workspaces.createdAt)],
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

export async function getWorkspace(workspaceId: string): Promise<WorkspaceWithOwner | null> {
  const result = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
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

  return result || null;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string;
  isDefault?: boolean;
}

export async function createWorkspace(
  userId: string,
  input: CreateWorkspaceInput
): Promise<Workspace> {
  // If this is the first workspace, make it default
  const existingCount = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId));

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: input.name,
      description: input.description || null,
      ownerId: userId,
      isDefault: input.isDefault ?? existingCount.length === 0,
    })
    .returning();

  return workspace;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
}

export async function updateWorkspace(
  workspaceId: string,
  userId: string,
  input: UpdateWorkspaceInput
): Promise<Workspace | null> {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace || workspace.ownerId !== userId) {
    return null;
  }

  const [updated] = await db
    .update(workspaces)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
    })
    .where(eq(workspaces.id, workspaceId))
    .returning();

  return updated;
}

export async function deleteWorkspace(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace || workspace.ownerId !== userId) {
    return false;
  }

  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  return true;
}

// ============================================
// Workspace Packages
// ============================================

export async function listWorkspacePackages(
  workspaceId: string
): Promise<WorkspaceEntity[]> {
  const entities = await db.query.workspaceEntities.findMany({
    where: eq(workspaceEntities.workspaceId, workspaceId),
  });

  // Fetch package details for each entity
  const results: WorkspaceEntity[] = [];

  for (const entity of entities) {
    let pkg = null;

    if (entity.entityType === 'mcp') {
      pkg = await db.query.mcpPackages.findFirst({
        where: eq(mcpPackages.id, entity.entityId),
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
        where: eq(skillPackages.id, entity.entityId),
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
      entityType: entity.entityType,
      entityId: entity.entityId,
      enabled: entity.enabled,
      config: entity.config,
      addedAt: entity.addedAt,
      package: pkg || undefined,
    });
  }

  return results;
}

export interface AddPackageInput {
  entityType: 'mcp' | 'skill';
  entityId: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export async function addPackageToWorkspace(
  workspaceId: string,
  userId: string,
  input: AddPackageInput
): Promise<boolean> {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace || workspace.ownerId !== userId) {
    return false;
  }

  // Check if already exists
  const existing = await db.query.workspaceEntities.findFirst({
    where: and(
      eq(workspaceEntities.workspaceId, workspaceId),
      eq(workspaceEntities.entityType, input.entityType),
      eq(workspaceEntities.entityId, input.entityId)
    ),
  });

  if (existing) {
    // Update existing
    await db
      .update(workspaceEntities)
      .set({
        enabled: input.enabled ?? true,
        config: input.config || null,
      })
      .where(
        and(
          eq(workspaceEntities.workspaceId, workspaceId),
          eq(workspaceEntities.entityType, input.entityType),
          eq(workspaceEntities.entityId, input.entityId)
        )
      );
  } else {
    // Insert new
    await db.insert(workspaceEntities).values({
      workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
      enabled: input.enabled ?? true,
      config: input.config || null,
    });
  }

  return true;
}

export async function removePackageFromWorkspace(
  workspaceId: string,
  userId: string,
  entityType: 'mcp' | 'skill',
  entityId: string
): Promise<boolean> {
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });

  if (!workspace || workspace.ownerId !== userId) {
    return false;
  }

  await db
    .delete(workspaceEntities)
    .where(
      and(
        eq(workspaceEntities.workspaceId, workspaceId),
        eq(workspaceEntities.entityType, entityType),
        eq(workspaceEntities.entityId, entityId)
      )
    );

  return true;
}
