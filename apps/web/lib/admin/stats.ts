/**
 * Admin Statistics Service
 *
 * Provides query functions for admin dashboard statistics.
 */

import { db, mcpPackages, skillPackages, reports, moderationLogs, users } from '@/lib/db';
import { eq, gte, count, inArray } from 'drizzle-orm';

/**
 * Stats for the admin dashboard overview.
 */
export interface AdminStats {
  pendingPackages: number;
  openReports: number;
  todayActions: number;
  totalUsers: number;
  recentActivity: ActivityItem[];
  pendingQueue: QueueItem[];
}

/**
 * Recent moderation activity item.
 */
export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityName: string;
  adminName: string;
  createdAt: Date;
}

/**
 * Pending item in the moderation queue.
 */
export interface QueueItem {
  id: string;
  type: 'mcp' | 'skill' | 'report';
  name: string;
  submittedAt: Date;
  author: string;
}

/**
 * Count pending packages (MCP + Skill).
 */
export async function countPendingPackages(): Promise<number> {
  const [mcpResult, skillResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(mcpPackages)
      .where(eq(mcpPackages.status, 'pending')),
    db
      .select({ count: count() })
      .from(skillPackages)
      .where(eq(skillPackages.status, 'pending')),
  ]);

  return (mcpResult[0]?.count ?? 0) + (skillResult[0]?.count ?? 0);
}

/**
 * Count open reports.
 */
export async function countOpenReports(): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(reports)
    .where(eq(reports.status, 'pending'));

  return result[0]?.count ?? 0;
}

/**
 * Count moderation actions from today.
 */
export async function countTodayActions(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({ count: count() })
    .from(moderationLogs)
    .where(gte(moderationLogs.createdAt, today));

  return result[0]?.count ?? 0;
}

/**
 * Count total users.
 */
export async function countTotalUsers(): Promise<number> {
  const result = await db.select({ count: count() }).from(users);

  return result[0]?.count ?? 0;
}

/**
 * Get recent moderation activity.
 */
export async function getRecentActivity(limit: number = 10): Promise<ActivityItem[]> {
  const logs = await db.query.moderationLogs.findMany({
    orderBy: (logs, { desc }) => [desc(logs.createdAt)],
    limit,
    with: {
      admin: {
        columns: {
          username: true,
        },
      },
    },
  });

  // Group entity IDs by type for batch fetching
  const mcpIds: string[] = [];
  const skillIds: string[] = [];
  const userIds: string[] = [];

  for (const log of logs) {
    if (log.entityType === 'mcp') {
      mcpIds.push(log.entityId);
    } else if (log.entityType === 'skill') {
      skillIds.push(log.entityId);
    } else if (log.entityType === 'user') {
      userIds.push(log.entityId);
    }
  }

  // Batch fetch entities
  const [mcpEntities, skillEntities, userEntities] = await Promise.all([
    mcpIds.length > 0
      ? db.query.mcpPackages.findMany({
          where: inArray(mcpPackages.id, mcpIds),
          columns: { id: true, name: true },
        })
      : Promise.resolve([]),
    skillIds.length > 0
      ? db.query.skillPackages.findMany({
          where: inArray(skillPackages.id, skillIds),
          columns: { id: true, name: true },
        })
      : Promise.resolve([]),
    userIds.length > 0
      ? db.query.users.findMany({
          where: inArray(users.id, userIds),
          columns: { id: true, username: true },
        })
      : Promise.resolve([]),
  ]);

  // Create lookup maps
  const mcpMap = new Map(mcpEntities.map((m) => [m.id, m.name]));
  const skillMap = new Map(skillEntities.map((s) => [s.id, s.name]));
  const userMap = new Map(userEntities.map((u) => [u.id, u.username]));

  // Build activity items using lookup maps
  const activities: ActivityItem[] = logs.map((log) => {
    let entityName = 'Unknown';

    if (log.entityType === 'mcp') {
      entityName = mcpMap.get(log.entityId) ?? 'Deleted Package';
    } else if (log.entityType === 'skill') {
      entityName = skillMap.get(log.entityId) ?? 'Deleted Package';
    } else if (log.entityType === 'user') {
      entityName = userMap.get(log.entityId) ?? 'Deleted User';
    } else if (log.entityType === 'report') {
      entityName = `Report #${log.entityId.slice(0, 8)}`;
    } else {
      entityName = `${log.entityType} #${log.entityId.slice(0, 8)}`;
    }

    return {
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityName,
      adminName: log.admin?.username ?? 'Unknown',
      createdAt: log.createdAt,
    };
  });

  return activities;
}

/**
 * Get pending items for the queue preview.
 */
export async function getPendingQueue(limit: number = 5): Promise<QueueItem[]> {
  const items: QueueItem[] = [];

  // Get pending MCP packages
  const pendingMcps = await db.query.mcpPackages.findMany({
    where: eq(mcpPackages.status, 'pending'),
    orderBy: (packages, { asc }) => [asc(packages.createdAt)],
    limit,
    with: {
      author: {
        columns: {
          username: true,
        },
      },
    },
  });

  for (const mcp of pendingMcps) {
    items.push({
      id: mcp.id,
      type: 'mcp',
      name: mcp.name,
      submittedAt: mcp.createdAt,
      author: mcp.author?.username ?? 'Unknown',
    });
  }

  // Get pending Skill packages
  const pendingSkills = await db.query.skillPackages.findMany({
    where: eq(skillPackages.status, 'pending'),
    orderBy: (packages, { asc }) => [asc(packages.createdAt)],
    limit,
    with: {
      author: {
        columns: {
          username: true,
        },
      },
    },
  });

  for (const skill of pendingSkills) {
    items.push({
      id: skill.id,
      type: 'skill',
      name: skill.name,
      submittedAt: skill.createdAt,
      author: skill.author?.username ?? 'Unknown',
    });
  }

  // Get pending reports
  const pendingReports = await db.query.reports.findMany({
    where: eq(reports.status, 'pending'),
    orderBy: (reports, { asc }) => [asc(reports.createdAt)],
    limit,
    with: {
      reporter: {
        columns: {
          username: true,
        },
      },
    },
  });

  for (const report of pendingReports) {
    items.push({
      id: report.id,
      type: 'report',
      name: `${report.reason} - ${report.entityType}`,
      submittedAt: report.createdAt,
      author: report.reporter?.username ?? 'Unknown',
    });
  }

  // Sort by submission time (oldest first) and limit
  return items
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
    .slice(0, limit);
}

/**
 * Get all admin stats in one call.
 */
export async function getAdminStats(): Promise<AdminStats> {
  const [
    pendingPackages,
    openReports,
    todayActions,
    totalUsers,
    recentActivity,
    pendingQueue,
  ] = await Promise.all([
    countPendingPackages(),
    countOpenReports(),
    countTodayActions(),
    countTotalUsers(),
    getRecentActivity(10),
    getPendingQueue(5),
  ]);

  return {
    pendingPackages,
    openReports,
    todayActions,
    totalUsers,
    recentActivity,
    pendingQueue,
  };
}
