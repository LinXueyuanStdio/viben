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
import { eq, and, desc, count } from 'drizzle-orm';
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

  // Resolve entity names
  const logsWithNames = await Promise.all(
    logs.map(async (log) => {
      const entityName = await resolveEntityName(
        log.entityType as ModerationEntityType,
        log.entityId
      );

      return {
        id: log.id,
        admin: {
          id: log.adminId,
          username: log.adminUsername,
          displayName: log.adminDisplayName,
        },
        entityType: log.entityType as ModerationEntityType,
        entityId: log.entityId,
        entityName,
        action: log.action as ModerationAction,
        reason: log.reason,
        metadata: log.metadata as Record<string, unknown> | null,
        createdAt: log.createdAt,
      };
    })
  );

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
 * Resolve the name of an entity for display in logs.
 */
async function resolveEntityName(
  entityType: ModerationEntityType,
  entityId: string
): Promise<string> {
  switch (entityType) {
    case 'mcp': {
      const pkg = await db.query.mcpPackages.findFirst({
        where: eq(mcpPackages.id, entityId),
        columns: { name: true },
      });
      return pkg?.name ?? `MCP Package ${entityId.slice(0, 8)}`;
    }
    case 'skill': {
      const pkg = await db.query.skillPackages.findFirst({
        where: eq(skillPackages.id, entityId),
        columns: { name: true },
      });
      return pkg?.name ?? `Skill Package ${entityId.slice(0, 8)}`;
    }
    case 'comment': {
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, entityId),
        columns: { content: true },
      });
      // Truncate comment content for display
      const content = comment?.content ?? 'Unknown comment';
      return content.length > 50 ? `${content.slice(0, 50)}...` : content;
    }
    case 'collection': {
      const collection = await db.query.collections.findFirst({
        where: eq(collections.id, entityId),
        columns: { name: true },
      });
      return collection?.name ?? `Collection ${entityId.slice(0, 8)}`;
    }
    case 'user': {
      const user = await db.query.users.findFirst({
        where: eq(users.id, entityId),
        columns: { username: true },
      });
      return user ? `@${user.username}` : `User ${entityId.slice(0, 8)}`;
    }
    case 'report': {
      return `Report ${entityId.slice(0, 8)}`;
    }
    default:
      return `Unknown ${entityId.slice(0, 8)}`;
  }
}
