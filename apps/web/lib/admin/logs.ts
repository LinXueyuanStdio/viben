/**
 * Admin Moderation Logs Functions
 *
 * Database queries for creating and retrieving moderation logs.
 */

import {
  db,
  moderationLogs,
  users,
  mcpPackages,
  skillPackages,
  comments,
  collections,
} from '@/lib/db';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import type { ModerationAction, ModerationEntityType } from '@/lib/types/admin';

// ============================================
// Types
// ============================================

export interface ModerationLogEntry {
  id: string;
  admin: {
    id: string;
    username: string;
    displayName: string;
  };
  entityType: ModerationEntityType;
  entityId: string;
  entityName: string;
  action: ModerationAction;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ListLogsOptions {
  entityType?: ModerationEntityType;
  entityId?: string;
  adminId?: string;
  action?: ModerationAction;
  page: number;
  limit: number;
}

export interface ListLogsResult {
  logs: ModerationLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateLogOptions {
  adminId: string;
  entityType: ModerationEntityType;
  entityId: string;
  action: ModerationAction;
  reason?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Create Moderation Log
// ============================================

export async function createModerationLog(
  options: CreateLogOptions
): Promise<string> {
  const { adminId, entityType, entityId, action, reason, metadata } = options;

  const [log] = await db
    .insert(moderationLogs)
    .values({
      adminId,
      entityType,
      entityId,
      action,
      reason: reason ?? null,
      metadata: metadata ?? null,
    })
    .returning({ id: moderationLogs.id });

  return log.id;
}

// ============================================
// List Moderation Logs
// ============================================

export async function listModerationLogs(
  options: ListLogsOptions
): Promise<ListLogsResult> {
  const { entityType, entityId, adminId, action, page, limit } = options;
  const offset = (page - 1) * limit;

  // Build where conditions
  const conditions = [];
  if (entityType) {
    conditions.push(eq(moderationLogs.entityType, entityType));
  }
  if (entityId) {
    conditions.push(eq(moderationLogs.entityId, entityId));
  }
  if (adminId) {
    conditions.push(eq(moderationLogs.adminId, adminId));
  }
  if (action) {
    conditions.push(eq(moderationLogs.action, action));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Query logs with admin info
  const logs = await db
    .select({
      id: moderationLogs.id,
      adminId: moderationLogs.adminId,
      adminUsername: users.username,
      adminDisplayName: users.displayName,
      entityType: moderationLogs.entityType,
      entityId: moderationLogs.entityId,
      action: moderationLogs.action,
      reason: moderationLogs.reason,
      metadata: moderationLogs.metadata,
      createdAt: moderationLogs.createdAt,
    })
    .from(moderationLogs)
    .innerJoin(users, eq(moderationLogs.adminId, users.id))
    .where(whereClause)
    .orderBy(desc(moderationLogs.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(moderationLogs)
    .where(whereClause);

  const total = totalResult?.count ?? 0;

  // Batch resolve entity names by type
  const entityNameMap = await batchResolveEntityNames(logs);

  const logsWithNames = logs.map((log) => ({
    id: log.id,
    admin: {
      id: log.adminId,
      username: log.adminUsername,
      displayName: log.adminDisplayName,
    },
    entityType: log.entityType as ModerationEntityType,
    entityId: log.entityId,
    entityName: entityNameMap.get(`${log.entityType}:${log.entityId}`) ?? `Unknown ${log.entityId.slice(0, 8)}`,
    action: log.action as ModerationAction,
    reason: log.reason,
    metadata: log.metadata as Record<string, unknown> | null,
    createdAt: log.createdAt,
  }));

  return {
    logs: logsWithNames,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Batch resolve entity names to avoid N+1 queries.
 */
async function batchResolveEntityNames(
  logs: Array<{ entityType: string; entityId: string }>
): Promise<Map<string, string>> {
  const entityNameMap = new Map<string, string>();

  // Group entity IDs by type
  const entityIdsByType: Record<string, Set<string>> = {};
  
  for (const log of logs) {
    if (!entityIdsByType[log.entityType]) {
      entityIdsByType[log.entityType] = new Set();
    }
    entityIdsByType[log.entityType].add(log.entityId);
  }

  // Batch fetch names for each entity type
  for (const [entityType, entityIds] of Object.entries(entityIdsByType)) {
    if (entityIds.size === 0) continue;

    const idsArray = Array.from(entityIds);

    switch (entityType as ModerationEntityType) {
      case 'mcp': {
        const packages = await db
          .select({ id: mcpPackages.id, name: mcpPackages.name })
          .from(mcpPackages)
          .where(inArray(mcpPackages.id, idsArray));
        
        for (const pkg of packages) {
          entityNameMap.set(`mcp:${pkg.id}`, pkg.name);
        }
        // Fill in missing IDs with fallback
        for (const id of idsArray) {
          if (!entityNameMap.has(`mcp:${id}`)) {
            entityNameMap.set(`mcp:${id}`, `MCP Package ${id.slice(0, 8)}`);
          }
        }
        break;
      }
      case 'skill': {
        const packages = await db
          .select({ id: skillPackages.id, name: skillPackages.name })
          .from(skillPackages)
          .where(inArray(skillPackages.id, idsArray));
        
        for (const pkg of packages) {
          entityNameMap.set(`skill:${pkg.id}`, pkg.name);
        }
        // Fill in missing IDs with fallback
        for (const id of idsArray) {
          if (!entityNameMap.has(`skill:${id}`)) {
            entityNameMap.set(`skill:${id}`, `Skill Package ${id.slice(0, 8)}`);
          }
        }
        break;
      }
      case 'comment': {
        const commentResults = await db
          .select({ id: comments.id, content: comments.content })
          .from(comments)
          .where(inArray(comments.id, idsArray));
        
        for (const comment of commentResults) {
          const content = comment.content;
          const displayContent = content.length > 50 ? `${content.slice(0, 50)}...` : content;
          entityNameMap.set(`comment:${comment.id}`, displayContent);
        }
        // Fill in missing IDs with fallback
        for (const id of idsArray) {
          if (!entityNameMap.has(`comment:${id}`)) {
            entityNameMap.set(`comment:${id}`, 'Unknown comment');
          }
        }
        break;
      }
      case 'collection': {
        const collectionResults = await db
          .select({ id: collections.id, name: collections.name })
          .from(collections)
          .where(inArray(collections.id, idsArray));
        
        for (const collection of collectionResults) {
          entityNameMap.set(`collection:${collection.id}`, collection.name);
        }
        // Fill in missing IDs with fallback
        for (const id of idsArray) {
          if (!entityNameMap.has(`collection:${id}`)) {
            entityNameMap.set(`collection:${id}`, `Collection ${id.slice(0, 8)}`);
          }
        }
        break;
      }
      case 'user': {
        const userResults = await db
          .select({ id: users.id, username: users.username })
          .from(users)
          .where(inArray(users.id, idsArray));
        
        for (const user of userResults) {
          entityNameMap.set(`user:${user.id}`, `@${user.username}`);
        }
        // Fill in missing IDs with fallback
        for (const id of idsArray) {
          if (!entityNameMap.has(`user:${id}`)) {
            entityNameMap.set(`user:${id}`, `User ${id.slice(0, 8)}`);
          }
        }
        break;
      }
      case 'report': {
        // Reports don't have names, just use ID
        for (const id of idsArray) {
          entityNameMap.set(`report:${id}`, `Report ${id.slice(0, 8)}`);
        }
        break;
      }
      default: {
        // Unknown entity types
        for (const id of idsArray) {
          entityNameMap.set(`${entityType}:${id}`, `Unknown ${id.slice(0, 8)}`);
        }
      }
    }
  }

  return entityNameMap;
}

