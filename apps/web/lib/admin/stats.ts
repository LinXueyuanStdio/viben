/**
 * Admin Statistics Service
 *
 * Provides query functions for admin dashboard statistics.
 */

import {
  db,
  mcpPackages,
  skillPackages,
  reports,
  moderationLogs,
  users,
  publishedPages,
  moments,
  comments,
} from '@/lib/db';
import { eq, gte, count, inArray, sum } from 'drizzle-orm';

/**
 * Stats for the admin dashboard overview.
 */
export interface AdminStats {
  pendingPackages: number;
  openReports: number;
  todayActions: number;
  totalUsers: number;
  totalPublishedPages: number;
  totalMoments: number;
  totalPackages: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  totalDownloads: number;
  totalComments: number;
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
 * Count published pages with approved moderation status.
 */
export async function countPublishedPages(): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(publishedPages)
    .where(eq(publishedPages.moderationStatus, 'approved'));

  return result[0]?.count ?? 0;
}

/**
 * Count total moments (non-deleted).
 */
export async function countTotalMoments(): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(moments)
    .where(eq(moments.isDeleted, false));

  return result[0]?.count ?? 0;
}

/**
 * Count total packages (MCP + Skill).
 */
export async function countTotalPackages(): Promise<number> {
  const [mcpResult, skillResult] = await Promise.all([
    db.select({ count: count() }).from(mcpPackages),
    db.select({ count: count() }).from(skillPackages),
  ]);

  return (mcpResult[0]?.count ?? 0) + (skillResult[0]?.count ?? 0);
}

/**
 * Count users created today.
 */
export async function countNewUsersToday(): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, today));

  return result[0]?.count ?? 0;
}

/**
 * Count users created in the last 7 days.
 */
export async function countNewUsersThisWeek(): Promise<number> {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const result = await db
    .select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, weekAgo));

  return result[0]?.count ?? 0;
}

/**
 * Sum total downloads across all packages.
 */
export async function countTotalDownloads(): Promise<number> {
  const [mcpResult, skillResult] = await Promise.all([
    db.select({ total: sum(mcpPackages.downloadsCount) }).from(mcpPackages),
    db.select({ total: sum(skillPackages.downloadsCount) }).from(skillPackages),
  ]);

  return Number(mcpResult[0]?.total ?? 0) + Number(skillResult[0]?.total ?? 0);
}

/**
 * Count total comments.
 */
export async function countTotalComments(): Promise<number> {
  const result = await db.select({ count: count() }).from(comments);

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

  // Group entity IDs by type for batch fetching (using Sets to avoid duplicates)
  const mcpIds = new Set<string>();
  const skillIds = new Set<string>();
  const userIds = new Set<string>();

  for (const log of logs) {
    if (log.entityType === 'mcp') {
      mcpIds.add(log.entityId);
    } else if (log.entityType === 'skill') {
      skillIds.add(log.entityId);
    } else if (log.entityType === 'user') {
      userIds.add(log.entityId);
    }
  }

  // Batch fetch entities
  const [mcpEntities, skillEntities, userEntities] = await Promise.all([
    mcpIds.size > 0
      ? db.query.mcpPackages.findMany({
          where: inArray(mcpPackages.id, Array.from(mcpIds)),
          columns: { id: true, name: true },
        })
      : Promise.resolve([]),
    skillIds.size > 0
      ? db.query.skillPackages.findMany({
          where: inArray(skillPackages.id, Array.from(skillIds)),
          columns: { id: true, name: true },
        })
      : Promise.resolve([]),
    userIds.size > 0
      ? db.query.users.findMany({
          where: inArray(users.id, Array.from(userIds)),
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
    totalPublishedPages,
    totalMoments,
    totalPackages,
    newUsersToday,
    newUsersThisWeek,
    totalDownloads,
    totalComments,
    recentActivity,
    pendingQueue,
  ] = await Promise.all([
    countPendingPackages(),
    countOpenReports(),
    countTodayActions(),
    countTotalUsers(),
    countPublishedPages(),
    countTotalMoments(),
    countTotalPackages(),
    countNewUsersToday(),
    countNewUsersThisWeek(),
    countTotalDownloads(),
    countTotalComments(),
    getRecentActivity(10),
    getPendingQueue(5),
  ]);

  return {
    pendingPackages,
    openReports,
    todayActions,
    totalUsers,
    totalPublishedPages,
    totalMoments,
    totalPackages,
    newUsersToday,
    newUsersThisWeek,
    totalDownloads,
    totalComments,
    recentActivity,
    pendingQueue,
  };
}
