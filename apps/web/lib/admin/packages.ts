/**
 * Admin Package Query Functions
 *
 * Database queries for package moderation in the admin panel.
 */

import {
  db,
  mcpPackages,
  skillPackages,
  users,
  moderationLogs,
  comments,
} from '@/lib/db';
import { eq, and, desc, asc, count, sql } from 'drizzle-orm';
import type { PackageStatus } from '@/lib/types/admin';

// ============================================
// Types
// ============================================

export interface PackageAuthor {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface PackageForReview {
  id: string;
  type: 'mcp' | 'skill';
  name: string;
  slug: string;
  version: string;
  description: string;
  author: PackageAuthor;
  tags: string[];
  status: PackageStatus;
  createdAt: Date;
  // MCP specific
  transport?: string;
  entryPoint?: string;
  // Skill specific
  skillType?: string;
}

export interface PackageDetails extends PackageForReview {
  longDescription: string | null;
  // Skill specific
  content?: string | null;
  triggerPatterns?: string[] | null;
  // Review history
  reviewHistory: ReviewHistoryEntry[];
  // Stats
  favoritesCount: number;
  downloadsCount: number;
  commentsCount: number;
}

export interface ReviewHistoryEntry {
  action: string;
  reason: string | null;
  adminName: string;
  createdAt: Date;
}

export interface ListPackagesOptions {
  type?: 'mcp' | 'skill';
  status?: PackageStatus;
  page: number;
  limit: number;
  sort: 'newest' | 'oldest';
}

export interface ListPackagesResult {
  packages: PackageForReview[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// List Packages for Review
// ============================================

export async function listPackagesForReview(
  options: ListPackagesOptions
): Promise<ListPackagesResult> {
  const { type, status = 'pending', page, limit, sort } = options;
  const offset = (page - 1) * limit;

  // Determine ordering
  const orderDirection = sort === 'newest' ? 'DESC' : 'ASC';

  // If specific type is requested, query only that type
  if (type === 'mcp') {
    const mcpConditions = [eq(mcpPackages.status, status)];

    const mcpResults = await db
      .select({
        id: mcpPackages.id,
        name: mcpPackages.name,
        slug: mcpPackages.slug,
        version: mcpPackages.version,
        description: mcpPackages.description,
        tags: mcpPackages.tags,
        status: mcpPackages.status,
        transport: mcpPackages.transport,
        entryPoint: mcpPackages.entryPoint,
        createdAt: mcpPackages.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(mcpPackages)
      .innerJoin(users, eq(mcpPackages.authorId, users.id))
      .where(and(...mcpConditions))
      .orderBy(sort === 'newest' ? desc(mcpPackages.createdAt) : asc(mcpPackages.createdAt))
      .limit(limit)
      .offset(offset);

    const [mcpCount] = await db
      .select({ count: count() })
      .from(mcpPackages)
      .where(and(...mcpConditions));

    return {
      packages: mcpResults.map((p) => ({
        ...p,
        type: 'mcp' as const,
        tags: (p.tags as string[]) || [],
        status: p.status as PackageStatus,
      })),
      pagination: {
        page,
        limit,
        total: mcpCount?.count ?? 0,
        totalPages: Math.ceil((mcpCount?.count ?? 0) / limit),
      },
    };
  }

  if (type === 'skill') {
    const skillConditions = [eq(skillPackages.status, status)];

    const skillResults = await db
      .select({
        id: skillPackages.id,
        name: skillPackages.name,
        slug: skillPackages.slug,
        version: skillPackages.version,
        description: skillPackages.description,
        tags: skillPackages.tags,
        status: skillPackages.status,
        skillType: skillPackages.skillType,
        createdAt: skillPackages.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(skillPackages)
      .innerJoin(users, eq(skillPackages.authorId, users.id))
      .where(and(...skillConditions))
      .orderBy(sort === 'newest' ? desc(skillPackages.createdAt) : asc(skillPackages.createdAt))
      .limit(limit)
      .offset(offset);

    const [skillCount] = await db
      .select({ count: count() })
      .from(skillPackages)
      .where(and(...skillConditions));

    return {
      packages: skillResults.map((p) => ({
        ...p,
        type: 'skill' as const,
        tags: (p.tags as string[]) || [],
        status: p.status as PackageStatus,
      })),
      pagination: {
        page,
        limit,
        total: skillCount?.count ?? 0,
        totalPages: Math.ceil((skillCount?.count ?? 0) / limit),
      },
    };
  }

  // When no specific type is requested, use UNION ALL to combine both types
  // Build MCP subquery
  const mcpSubquery = db
    .select({
      id: mcpPackages.id,
      type: sql<string>`'mcp'`.as('type'),
      name: mcpPackages.name,
      slug: mcpPackages.slug,
      version: mcpPackages.version,
      description: mcpPackages.description,
      tags: mcpPackages.tags,
      status: mcpPackages.status,
      createdAt: mcpPackages.createdAt,
      authorId: mcpPackages.authorId,
      transport: mcpPackages.transport,
      entryPoint: mcpPackages.entryPoint,
      skillType: sql<string | null>`NULL`.as('skillType'),
    })
    .from(mcpPackages)
    .where(eq(mcpPackages.status, status));

  // Build Skill subquery
  const skillSubquery = db
    .select({
      id: skillPackages.id,
      type: sql<string>`'skill'`.as('type'),
      name: skillPackages.name,
      slug: skillPackages.slug,
      version: skillPackages.version,
      description: skillPackages.description,
      tags: skillPackages.tags,
      status: skillPackages.status,
      createdAt: skillPackages.createdAt,
      authorId: skillPackages.authorId,
      transport: sql<string | null>`NULL`.as('transport'),
      entryPoint: sql<string | null>`NULL`.as('entryPoint'),
      skillType: skillPackages.skillType,
    })
    .from(skillPackages)
    .where(eq(skillPackages.status, status));

  // Combine with UNION ALL and apply ordering + pagination
  const unionQuery = mcpSubquery.unionAll(skillSubquery).as('packages');

  const results = await db
    .select({
      id: unionQuery.id,
      type: unionQuery.type,
      name: unionQuery.name,
      slug: unionQuery.slug,
      version: unionQuery.version,
      description: unionQuery.description,
      tags: unionQuery.tags,
      status: unionQuery.status,
      createdAt: unionQuery.createdAt,
      authorId: unionQuery.authorId,
      transport: unionQuery.transport,
      entryPoint: unionQuery.entryPoint,
      skillType: unionQuery.skillType,
      author: {
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(unionQuery)
    .innerJoin(users, eq(unionQuery.authorId, users.id))
    .orderBy(sql.raw(`created_at ${orderDirection}`))
    .limit(limit)
    .offset(offset);

  // Get total count for both types
  const [mcpCount] = await db
    .select({ count: count() })
    .from(mcpPackages)
    .where(eq(mcpPackages.status, status));

  const [skillCount] = await db
    .select({ count: count() })
    .from(skillPackages)
    .where(eq(skillPackages.status, status));

  const total = (mcpCount?.count ?? 0) + (skillCount?.count ?? 0);

  return {
    packages: results.map((p) => ({
      id: p.id,
      type: p.type as 'mcp' | 'skill',
      name: p.name,
      slug: p.slug,
      version: p.version,
      description: p.description,
      author: p.author,
      tags: (p.tags as string[]) || [],
      status: p.status as PackageStatus,
      createdAt: p.createdAt,
      ...(p.type === 'mcp' ? { transport: p.transport!, entryPoint: p.entryPoint! } : {}),
      ...(p.type === 'skill' ? { skillType: p.skillType! } : {}),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ============================================
// Get Package Details
// ============================================

export async function getPackageDetails(
  id: string
): Promise<PackageDetails | null> {
  // Try MCP first
  const mcpPkg = await db.query.mcpPackages.findFirst({
    where: eq(mcpPackages.id, id),
    with: {
      author: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (mcpPkg) {
    const reviewHistory = await getReviewHistory('mcp', id);
    const commentsCount = await getCommentsCount('mcp', id);

    return {
      id: mcpPkg.id,
      type: 'mcp',
      name: mcpPkg.name,
      slug: mcpPkg.slug,
      version: mcpPkg.version,
      description: mcpPkg.description,
      longDescription: mcpPkg.longDescription,
      author: mcpPkg.author,
      tags: (mcpPkg.tags as string[]) || [],
      status: mcpPkg.status as PackageStatus,
      createdAt: mcpPkg.createdAt,
      transport: mcpPkg.transport,
      entryPoint: mcpPkg.entryPoint,
      reviewHistory,
      favoritesCount: mcpPkg.favoritesCount,
      downloadsCount: mcpPkg.downloadsCount,
      commentsCount,
    };
  }

  // Try Skill
  const skillPkg = await db.query.skillPackages.findFirst({
    where: eq(skillPackages.id, id),
    with: {
      author: {
        columns: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  if (skillPkg) {
    const reviewHistory = await getReviewHistory('skill', id);
    const commentsCount = await getCommentsCount('skill', id);

    return {
      id: skillPkg.id,
      type: 'skill',
      name: skillPkg.name,
      slug: skillPkg.slug,
      version: skillPkg.version,
      description: skillPkg.description,
      longDescription: skillPkg.longDescription,
      author: skillPkg.author,
      tags: (skillPkg.tags as string[]) || [],
      status: skillPkg.status as PackageStatus,
      createdAt: skillPkg.createdAt,
      skillType: skillPkg.skillType,
      content: skillPkg.content,
      triggerPatterns: skillPkg.triggerPatterns as string[] | null,
      reviewHistory,
      favoritesCount: skillPkg.favoritesCount,
      downloadsCount: skillPkg.downloadsCount,
      commentsCount,
    };
  }

  return null;
}

// ============================================
// Update Package Status
// ============================================

export async function updateMcpPackageStatus(
  id: string,
  status: PackageStatus,
  reviewedBy: string,
  rejectionReason?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    reviewedAt: new Date(),
    reviewedBy,
  };

  if (status === 'rejected') {
    updateData.rejectionReason = rejectionReason;
  }

  if (status === 'featured') {
    updateData.featuredAt = new Date();
    updateData.featuredBy = reviewedBy;
  } else if (status === 'approved') {
    // Clear featured status if going back to approved
    updateData.featuredAt = null;
    updateData.featuredBy = null;
  }

  await db.update(mcpPackages).set(updateData).where(eq(mcpPackages.id, id));
}

export async function updateSkillPackageStatus(
  id: string,
  status: PackageStatus,
  reviewedBy: string,
  rejectionReason?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    reviewedAt: new Date(),
    reviewedBy,
  };

  if (status === 'rejected') {
    updateData.rejectionReason = rejectionReason;
  }

  if (status === 'featured') {
    updateData.featuredAt = new Date();
    updateData.featuredBy = reviewedBy;
  } else if (status === 'approved') {
    // Clear featured status if going back to approved
    updateData.featuredAt = null;
    updateData.featuredBy = null;
  }

  await db.update(skillPackages).set(updateData).where(eq(skillPackages.id, id));
}

// ============================================
// Helper Functions
// ============================================

async function getReviewHistory(
  entityType: 'mcp' | 'skill',
  entityId: string
): Promise<ReviewHistoryEntry[]> {
  const logs = await db
    .select({
      action: moderationLogs.action,
      reason: moderationLogs.reason,
      adminName: users.displayName,
      createdAt: moderationLogs.createdAt,
    })
    .from(moderationLogs)
    .innerJoin(users, eq(moderationLogs.adminId, users.id))
    .where(
      and(
        eq(moderationLogs.entityType, entityType),
        eq(moderationLogs.entityId, entityId)
      )
    )
    .orderBy(desc(moderationLogs.createdAt));

  return logs;
}

async function getCommentsCount(
  entityType: 'mcp' | 'skill',
  entityId: string
): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(comments)
    .where(
      and(eq(comments.entityType, entityType), eq(comments.entityId, entityId))
    );

  return result?.count ?? 0;
}

/**
 * Get package type by ID (checks both MCP and Skill tables).
 */
export async function getPackageType(
  id: string
): Promise<'mcp' | 'skill' | null> {
  const mcpPkg = await db.query.mcpPackages.findFirst({
    where: eq(mcpPackages.id, id),
    columns: { id: true },
  });

  if (mcpPkg) {
    return 'mcp';
  }

  const skillPkg = await db.query.skillPackages.findFirst({
    where: eq(skillPackages.id, id),
    columns: { id: true },
  });

  if (skillPkg) {
    return 'skill';
  }

  return null;
}

/**
 * Get package current status by ID.
 */
export async function getPackageStatus(
  id: string,
  type: 'mcp' | 'skill'
): Promise<PackageStatus | null> {
  if (type === 'mcp') {
    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, id),
      columns: { status: true },
    });
    return (pkg?.status as PackageStatus) ?? null;
  } else {
    const pkg = await db.query.skillPackages.findFirst({
      where: eq(skillPackages.id, id),
      columns: { status: true },
    });
    return (pkg?.status as PackageStatus) ?? null;
  }
}

/**
 * Get package name by ID for logging purposes.
 */
export async function getPackageName(
  id: string,
  type: 'mcp' | 'skill'
): Promise<string | null> {
  if (type === 'mcp') {
    const pkg = await db.query.mcpPackages.findFirst({
      where: eq(mcpPackages.id, id),
      columns: { name: true },
    });
    return pkg?.name ?? null;
  } else {
    const pkg = await db.query.skillPackages.findFirst({
      where: eq(skillPackages.id, id),
      columns: { name: true },
    });
    return pkg?.name ?? null;
  }
}
