import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  json,
  jsonb,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { SandboxState } from "@viben/sandbox";

// ============================================
// User System Tables
// ============================================

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
    userSlug: text('user_slug').notNull().unique(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    websiteUrl: text('website_url'),
    githubUsername: text('github_username'),

    // Auth
    passwordHash: text('password_hash'),
    emailVerified: boolean('email_verified').default(false).notNull(),

    // Role - expanded to include admin roles
    // 'admin' is legacy, treated as 'super_admin' for backward compatibility
    role: text('role', {
      enum: ['user', 'developer', 'admin', 'super_admin', 'moderator', 'support'],
    })
      .default('developer')
      .notNull(),

    // Account type - distinguishes personal users from team accounts
    type: text('type', {
      enum: ['user', 'team'],
    }).default('user').notNull(),
    followersCount: integer('followers_count').default(0).notNull(),
    pageCount: integer('page_count').default(0),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    lastLoginAt: timestamp('last_login_at'),

    // Moderation
    bannedAt: timestamp('banned_at'),
    bannedReason: text('banned_reason'),
    warnedAt: timestamp('warned_at'),
    warnedReason: text('warned_reason'),
  },
  (table) => [
    index('users_username_idx').on(table.username),
    index('users_user_slug_idx').on(table.userSlug),
    index('users_email_idx').on(table.email),
  ]
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(), // First 13 chars: bmcp_XXXXXXXX
    scopes: json('scopes').$type<string[]>().default(['read']).notNull(),
    expiresAt: timestamp('expires_at'),
    lastUsedAt: timestamp('last_used_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('api_keys_user_id_idx').on(table.userId),
    uniqueIndex('api_keys_key_prefix_idx').on(table.keyPrefix),
  ]
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    teamId: text('team_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', {
      enum: ['owner', 'member'],
    }).default('member').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('team_members_team_user_idx').on(table.teamId, table.userId),
    index('team_members_team_id_idx').on(table.teamId),
    index('team_members_user_id_idx').on(table.userId),
  ]
);

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    teamId: text('team_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    projectSlug: text('project_slug').notNull(),
    description: text('description'),
    visibility: text('visibility', { enum: ['public', 'private'] }).default('public').notNull(),
    defaultPageId: text('default_page_id'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('projects_team_slug_idx').on(table.teamId, table.projectSlug),
    index('projects_team_id_idx').on(table.teamId),
  ]
);

export const oauthConnections = pgTable(
  'oauth_connections',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: ['github', 'google'] }).notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('oauth_provider_id_idx').on(table.provider, table.providerId),
    index('oauth_user_id_idx').on(table.userId),
  ]
);

// ============================================
// MCP Package Tables
// ============================================

export const mcpPackages = pgTable(
  'mcp_packages',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    version: text('version').notNull().default('1.0.0'),
    description: text('description').notNull(),
    longDescription: text('long_description'),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Links
    repositoryUrl: text('repository_url'),
    homepageUrl: text('homepage_url'),
    license: text('license').default('MIT'),

    // Technical
    transport: text('transport', { enum: ['stdio', 'sse', 'http'] })
      .default('stdio')
      .notNull(),
    entryPoint: text('entry_point').notNull(),
    configSchema: json('config_schema').$type<Record<string, unknown>>(),
    dependencies: json('dependencies').$type<string[]>().default([]),

    // Metadata
    tags: json('tags').$type<string[]>().default([]),
    category: text('category').default('general'),

    // Social counts (denormalized for performance)
    bookmarksCount: integer('bookmarks_count').default(0).notNull(),
    downloadsCount: integer('downloads_count').default(0).notNull(),
    ratingAvg: real('rating_avg').default(0).notNull(),
    ratingCount: integer('rating_count').default(0).notNull(),

    // Status
    isPublished: boolean('is_published').default(false).notNull(),
    visibility: text('visibility', {
      enum: ['public', 'unlisted', 'private'],
    }).default('public').notNull(),

    // Moderation status
    status: text('status', {
      enum: ['pending', 'approved', 'rejected', 'featured'],
    }).default('pending'),
    featuredAt: timestamp('featured_at'),
    featuredBy: text('featured_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    reviewedBy: text('reviewed_by').references(() => users.id),
    rejectionReason: text('rejection_reason'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('mcp_packages_author_id_idx').on(table.authorId),
    index('mcp_packages_category_idx').on(table.category),
    index('mcp_packages_created_at_idx').on(table.createdAt),
    index('mcp_packages_status_idx').on(table.status),
  ]
);

// ============================================
// Skill Package Tables
// ============================================

export const skillPackages = pgTable(
  'skill_packages',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    version: text('version').notNull().default('1.0.0'),
    description: text('description').notNull(),
    longDescription: text('long_description'),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Technical
    skillType: text('skill_type', { enum: ['command', 'prompt', 'agent'] })
      .default('command')
      .notNull(),
    triggerPatterns: json('trigger_patterns').$type<string[]>().default([]),
    content: text('content').notNull(),
    configSchema: json('config_schema').$type<Record<string, unknown>>(),
    dependencies: json('dependencies').$type<string[]>().default([]),

    // Metadata
    tags: json('tags').$type<string[]>().default([]),
    category: text('category').default('general'),
    compatibility: json('compatibility').$type<string[]>().default([]),

    // Social counts
    bookmarksCount: integer('bookmarks_count').default(0).notNull(),
    downloadsCount: integer('downloads_count').default(0).notNull(),
    ratingAvg: real('rating_avg').default(0).notNull(),
    ratingCount: integer('rating_count').default(0).notNull(),

    // Status
    isPublished: boolean('is_published').default(false).notNull(),
    visibility: text('visibility', {
      enum: ['public', 'unlisted', 'private'],
    }).default('public').notNull(),

    // Moderation status
    status: text('status', {
      enum: ['pending', 'approved', 'rejected', 'featured'],
    }).default('pending'),
    featuredAt: timestamp('featured_at'),
    featuredBy: text('featured_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at'),
    reviewedBy: text('reviewed_by').references(() => users.id),
    rejectionReason: text('rejection_reason'),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('skill_packages_author_id_idx').on(table.authorId),
    index('skill_packages_category_idx').on(table.category),
    index('skill_packages_skill_type_idx').on(table.skillType),
    index('skill_packages_status_idx').on(table.status),
  ]
);

// ============================================
// Collection Tables
// ============================================

export const collections = pgTable(
  'collections',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isPublic: boolean('is_public').default(true).notNull(),
    itemCount: integer('item_count').default(0).notNull(),
    forksCount: integer('forks_count').default(0).notNull(),
    forkedFromId: text('forked_from_id'),
    bookmarksCount: integer('bookmarks_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('collections_owner_id_idx').on(table.ownerId),
    index('collections_slug_idx').on(table.slug),
    uniqueIndex('collections_owner_slug_idx').on(table.ownerId, table.slug),
  ]
);

export const collectionItems = pgTable(
  'collection_items',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(), // MCP or Skill ID
    itemType: text('item_type', { enum: ['mcp', 'skill'] }).notNull(),
    note: text('note'),
    position: integer('position').default(0).notNull(),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => [
    index('collection_items_collection_id_idx').on(table.collectionId),
    uniqueIndex('collection_items_collection_item_idx').on(
      table.collectionId,
      table.itemId
    ),
  ]
);

// ============================================
// Social Tables
// ============================================

export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    entityType: text('entity_type', { enum: ['mcp', 'skill', 'collection'] }).notNull(),
    entityId: text('entity_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    parentId: text('parent_id'), // For threaded comments
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('comments_entity_idx').on(table.entityType, table.entityId),
    index('comments_user_id_idx').on(table.userId),
  ]
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type', { enum: ['mcp', 'skill', 'collection'] }).notNull(),
    entityId: text('entity_id').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.entityType, table.entityId] }),
    index('bookmarks_entity_idx').on(table.entityType, table.entityId),
  ]
);

export const ratings = pgTable(
  'ratings',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type', { enum: ['mcp', 'skill'] }).notNull(),
    entityId: text('entity_id').notNull(),
    score: integer('score').notNull(), // 1-5
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.entityType, table.entityId] }),
    index('ratings_entity_idx').on(table.entityType, table.entityId),
  ]
);

// ============================================
// Package Release Tables
// ============================================

export const packageReleases = pgTable(
  'package_releases',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    entityType: text('entity_type', { enum: ['mcp', 'skill'] }).notNull(),
    entityId: text('entity_id').notNull(),
    version: text('version').notNull(),
    releaseNotes: text('release_notes'),
    downloadUrl: text('download_url'),
    checksum: text('checksum'),
    fileSize: integer('file_size'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('package_releases_entity_idx').on(table.entityType, table.entityId),
    uniqueIndex('package_releases_version_idx').on(
      table.entityType,
      table.entityId,
      table.version
    ),
  ]
);

export const downloadRecords = pgTable(
  'download_records',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    entityType: text('entity_type', { enum: ['mcp', 'skill'] }).notNull(),
    entityId: text('entity_id').notNull(),
    releaseId: text('release_id').references(() => packageReleases.id, {
      onDelete: 'set null',
    }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('download_records_entity_idx').on(table.entityType, table.entityId),
    index('download_records_created_at_idx').on(table.createdAt),
  ]
);

// ============================================
// Draft Tables (for publish workflow)
// ============================================

export const drafts = pgTable(
  'drafts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    packageType: text('package_type', { enum: ['mcp', 'skill'] }).notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => [
    index('drafts_user_id_idx').on(table.userId),
    index('drafts_expires_at_idx').on(table.expiresAt),
  ]
);

// ============================================
// GitHub Connection Tables (for skill import)
// ============================================

export const githubConnections = pgTable(
  'github_connections',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    scope: text('scope').notNull(),
    githubUserId: text('github_user_id'),
    githubUsername: text('github_username'),
    connectedAt: timestamp('connected_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('github_connections_user_id_idx').on(table.userId),
  ]
);

// ============================================
// Admin & Moderation Tables
// ============================================

export const reports = pgTable(
  'reports',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

    // What is being reported
    entityType: text('entity_type', {
      enum: ['mcp', 'skill', 'comment', 'collection', 'user', 'published_page'],
    }).notNull(),
    entityId: text('entity_id').notNull(),

    // Who reported
    reporterId: text('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Report details
    reason: text('reason', {
      enum: ['spam', 'inappropriate', 'copyright', 'security', 'other'],
    }).notNull(),
    description: text('description'),

    // Resolution
    status: text('status', {
      enum: ['pending', 'resolved', 'dismissed'],
    }).default('pending'),
    resolvedAt: timestamp('resolved_at'),
    resolvedBy: text('resolved_by').references(() => users.id),
    resolution: text('resolution'), // Admin notes

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('reports_entity_idx').on(table.entityType, table.entityId),
    index('reports_reporter_id_idx').on(table.reporterId),
    index('reports_status_idx').on(table.status),
    index('reports_created_at_idx').on(table.createdAt),
  ]
);

// ============================================
// Feedback Tables
// ============================================

export const feedbacks = pgTable(
  'feedbacks',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    pageId: text('page_id').notNull(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    category: text('category', {
      enum: ['bug', 'suggestion', 'other'],
    }).notNull(),
    rating: integer('rating').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('feedbacks_page_id_idx').on(table.pageId),
    index('feedbacks_reporter_idx').on(table.reporterId),
  ]
);

export const moderationLogs = pgTable(
  'moderation_logs',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

    // Who performed the action
    adminId: text('admin_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // What was affected
    entityType: text('entity_type', {
      enum: ['mcp', 'skill', 'comment', 'collection', 'user', 'report', 'moment', 'published_page', 'notification', 'media_asset', 'share', 'feedback'],
    }).notNull(),
    entityId: text('entity_id').notNull(),

    // Action details
    action: text('action', {
      enum: [
        'approve',
        'reject',
        'feature',
        'unfeature',
        'delete',
        'edit',
        'warn',
        'ban',
        'unban',
        'hide',
        'unhide',
        'role_change',
        'revoke',
      ],
    }).notNull(),

    reason: text('reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('moderation_logs_admin_id_idx').on(table.adminId),
    index('moderation_logs_entity_idx').on(table.entityType, table.entityId),
    index('moderation_logs_action_idx').on(table.action),
    index('moderation_logs_created_at_idx').on(table.createdAt),
  ]
);

// ============================================
// Relations
// ============================================

export const usersRelations = relations(users, ({ many, one }) => ({
  apiKeys: many(apiKeys),
  oauthConnections: many(oauthConnections),
  mcpPackages: many(mcpPackages),
  skillPackages: many(skillPackages),
  collections: many(collections),
  comments: many(comments),
  reports: many(reports),
  feedbacks: many(feedbacks),
  moderationLogs: many(moderationLogs),
  drafts: many(drafts),
  notes: many(notes),
  githubConnection: one(githubConnections, {
    fields: [users.id],
    references: [githubConnections.userId],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(users, {
    fields: [teamMembers.teamId],
    references: [users.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  team: one(users, {
    fields: [projects.teamId],
    references: [users.id],
  }),
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  pages: many(projectPages),
}));

export const oauthConnectionsRelations = relations(oauthConnections, ({ one }) => ({
  user: one(users, {
    fields: [oauthConnections.userId],
    references: [users.id],
  }),
}));

export const mcpPackagesRelations = relations(mcpPackages, ({ one }) => ({
  author: one(users, {
    fields: [mcpPackages.authorId],
    references: [users.id],
  }),
}));

export const skillPackagesRelations = relations(skillPackages, ({ one }) => ({
  author: one(users, {
    fields: [skillPackages.authorId],
    references: [users.id],
  }),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  owner: one(users, {
    fields: [collections.ownerId],
    references: [users.id],
  }),
  forkedFrom: one(collections, {
    fields: [collections.forkedFromId],
    references: [collections.id],
    relationName: 'forkedFrom',
  }),
  forks: many(collections, { relationName: 'forkedFrom' }),
  items: many(collectionItems),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionItems.collectionId],
    references: [collections.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, {
    fields: [reports.reporterId],
    references: [users.id],
  }),
  resolver: one(users, {
    fields: [reports.resolvedBy],
    references: [users.id],
  }),
}));

export const feedbacksRelations = relations(feedbacks, ({ one }) => ({
  reporter: one(users, {
    fields: [feedbacks.reporterId],
    references: [users.id],
  }),
}));

export const moderationLogsRelations = relations(moderationLogs, ({ one }) => ({
  admin: one(users, {
    fields: [moderationLogs.adminId],
    references: [users.id],
  }),
}));

export const draftsRelations = relations(drafts, ({ one }) => ({
  user: one(users, {
    fields: [drafts.userId],
    references: [users.id],
  }),
}));

export const githubConnectionsRelations = relations(githubConnections, ({ one }) => ({
  user: one(users, {
    fields: [githubConnections.userId],
    references: [users.id],
  }),
}));

// ============================================
// Published Pages Tables
// ============================================

export const publishedPages = pgTable(
  'published_pages',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    uid: text('uid').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    icon: jsonb('icon').$type<{ type: string; value: string } | null>(),
    description: text('description'),
    html: text('html').notNull(),
    currentVersion: integer('current_version'),
    categoryId: text('category_id'),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    visibility: text('visibility', {
      enum: ['public', 'unlisted', 'private'],
    })
      .default('public')
      .notNull(),
    moderationStatus: text('moderation_status', {
      enum: ['pending', 'approved', 'rejected', 'hidden'],
    })
      .default('approved')
      .notNull(),
    publishedAt: timestamp('published_at').defaultNow().notNull(),
    lastPublishedAt: timestamp('last_published_at').defaultNow().notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    uniqueViewCount: integer('unique_view_count').default(0).notNull(),
    readCount: integer('read_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    bookmarkCount: integer('bookmark_count').default(0).notNull(),
    commentCount: integer('comment_count').default(0).notNull(),
    shareCount: integer('share_count').default(0).notNull(),
    repostCount: integer('repost_count').default(0).notNull(),
    subscriberCount: integer('subscriber_count').default(0).notNull(),
    versionCount: integer('version_count').default(0).notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    pinnedAt: timestamp('pinned_at'),
    statsUpdatedAt: timestamp('stats_updated_at'),
    coverUrl: text('cover_url'),
    authorDisplayName: text('author_display_name'),
    authorAvatarUrl: text('author_avatar_url'),
    authorSlug: text('author_slug').notNull(),
    sidePageUid: text('side_page_uid'),
    chaptersJson: jsonb('chapters_json'),
    // SEO metadata
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    seoKeywords: text('seo_keywords'),
    isDiscoverable: boolean('is_discoverable').default(true).notNull(),
    // Scheduled publishing
    scheduledAt: timestamp('scheduled_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('published_pages_user_id_idx').on(table.userId),
    index('published_pages_visibility_moderation_idx').on(
      table.visibility,
      table.moderationStatus
    ),
    index('published_pages_last_published_at_idx').on(table.lastPublishedAt),
    index('published_pages_category_id_idx').on(table.categoryId),
    uniqueIndex('published_pages_user_id_uid_idx').on(table.userId, table.uid),
    uniqueIndex('published_pages_author_slug_uid_idx').on(table.authorSlug, table.uid),
  ]
);

export const publishedPagesRelations = relations(publishedPages, ({ one }) => ({
  user: one(users, {
    fields: [publishedPages.userId],
    references: [users.id],
  }),
}));

export const projectPages = pgTable(
  'project_pages',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    pageId: text('page_id')
      .notNull()
      .references(() => publishedPages.id),
    addedBy: text('added_by')
      .notNull()
      .references(() => users.id),
    addedAt: timestamp('added_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('project_pages_unique_idx').on(table.projectId, table.pageId),
    index('project_pages_project_id_idx').on(table.projectId),
  ]
);

export const projectPagesRelations = relations(projectPages, ({ one }) => ({
  project: one(projects, {
    fields: [projectPages.projectId],
    references: [projects.id],
  }),
  page: one(publishedPages, {
    fields: [projectPages.pageId],
    references: [publishedPages.id],
  }),
  addedByUser: one(users, {
    fields: [projectPages.addedBy],
    references: [users.id],
  }),
}));

// ============================================
// Profile Pins — unified pin for pages/MCP/skills
// ============================================

export const profilePins = pgTable(
  'profile_pins',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type', {
      enum: ['page', 'mcp', 'skill'],
    }).notNull(),
    entityId: text('entity_id').notNull(),
    position: integer('position').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('profile_pins_user_entity_idx').on(table.userId, table.entityType, table.entityId),
    index('profile_pins_user_id_idx').on(table.userId),
  ]
);

export const profilePinsRelations = relations(profilePins, ({ one }) => ({
  user: one(users, {
    fields: [profilePins.userId],
    references: [users.id],
  }),
}));

export const publishedPageVersions = pgTable(
  'published_page_versions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    publishedPageId: text('published_page_id')
      .notNull()
      .references(() => publishedPages.id, { onDelete: 'cascade' }),
    uid: text('uid').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    title: text('title').notNull(),
    icon: jsonb('icon').$type<{ type: string; value: string } | null>(),
    description: text('description'),
    html: text('html').notNull(),
    categoryId: text('category_id'),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    visibility: text('visibility', {
      enum: ['public', 'unlisted', 'private'],
    })
      .default('public')
      .notNull(),
    moderationStatus: text('moderation_status', {
      enum: ['pending', 'approved', 'rejected', 'hidden'],
    })
      .default('approved')
      .notNull(),
    publishedAt: timestamp('published_at').defaultNow().notNull(),
    coverUrl: text('cover_url'),
    authorDisplayName: text('author_display_name'),
    authorAvatarUrl: text('author_avatar_url'),
    sidePageUid: text('side_page_uid'),
    chaptersJson: jsonb('chapters_json'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('published_page_versions_page_id_idx').on(table.publishedPageId),
    index('published_page_versions_user_id_uid_idx').on(table.userId, table.uid),
    uniqueIndex('published_page_versions_user_id_uid_version_idx').on(
      table.userId,
      table.uid,
      table.version
    ),
  ]
);

// ============================================
// Web Community Tables
// ============================================

export const pageCategories = pgTable(
  'page_categories',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    icon: jsonb('icon').$type<Record<string, unknown> | string | null>(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('page_categories_slug_idx').on(table.slug),
    index('page_categories_active_sort_idx').on(table.isActive, table.sortOrder),
  ]
);

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    ownerUserId: text('owner_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    kind: text('kind').notNull(),
    source: text('source', {
      enum: ['external_url', 'object_storage', 'generated'],
    }).notNull(),
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    mimeType: text('mime_type'),
    width: integer('width'),
    height: integer('height'),
    sizeBytes: integer('size_bytes'),
    altText: text('alt_text'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('media_assets_owner_user_id_idx').on(table.ownerUserId),
    index('media_assets_kind_idx').on(table.kind),
  ]
);

export const entityStatsDaily = pgTable(
  'entity_stats_daily',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    statDate: timestamp('stat_date').notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    uniqueViewCount: integer('unique_view_count').default(0).notNull(),
    readCount: integer('read_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    bookmarkCount: integer('bookmark_count').default(0).notNull(),
    commentCount: integer('comment_count').default(0).notNull(),
    shareCount: integer('share_count').default(0).notNull(),
    repostCount: integer('repost_count').default(0).notNull(),
    subscriberCount: integer('subscriber_count').default(0).notNull(),
    uniqueViewerCount: integer('unique_viewer_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('entity_stats_daily_entity_date_idx').on(
      table.entityType,
      table.entityId,
      table.statDate
    ),
    index('entity_stats_daily_date_idx').on(table.statDate),
  ]
);

export const communityEntities = pgTable(
  'community_entities',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    entityType: text('entity_type', {
      enum: ['published_page', 'moment', 'comment', 'project'],
    }).notNull(),
    entityId: text('entity_id').notNull(),
    ownerUserId: text('owner_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    visibility: text('visibility', {
      enum: ['public', 'unlisted', 'private'],
    })
      .default('public')
      .notNull(),
    status: text('status', { enum: ['active', 'deleted', 'hidden'] })
      .default('active')
      .notNull(),
    title: text('title'),
    canonicalPath: text('canonical_path'),
    reactionsCount: integer('reactions_count').default(0).notNull(),
    bookmarksCount: integer('bookmarks_count').default(0).notNull(),
    commentsCount: integer('comments_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('community_entities_entity_idx').on(table.entityType, table.entityId),
    index('community_entities_owner_idx').on(table.ownerUserId, table.createdAt),
    index('community_entities_visibility_idx').on(
      table.entityType,
      table.status,
      table.visibility
    ),
  ]
);

export const communityReactions = pgTable(
  'community_reactions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    communityEntityId: text('community_entity_id')
      .notNull()
      .references(() => communityEntities.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reactionType: text('reaction_type').default('like').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('community_reactions_unique_idx').on(
      table.communityEntityId,
      table.userId,
      table.reactionType
    ),
    index('community_reactions_entity_idx').on(
      table.communityEntityId,
      table.reactionType
    ),
    index('community_reactions_user_idx').on(table.userId, table.createdAt),
  ]
);

export const communityBookmarks = pgTable(
  'community_bookmarks',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    communityEntityId: text('community_entity_id')
      .notNull()
      .references(() => communityEntities.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('community_bookmarks_unique_idx').on(
      table.communityEntityId,
      table.userId
    ),
    index('community_bookmarks_user_idx').on(table.userId, table.createdAt),
    index('community_bookmarks_entity_idx').on(
      table.communityEntityId,
      table.createdAt
    ),
  ]
);

export const communityComments = pgTable(
  'community_comments',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    communityEntityId: text('community_entity_id')
      .notNull()
      .references(() => communityEntities.id, { onDelete: 'cascade' }),
    parentCommentId: text('parent_comment_id'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    status: text('status', { enum: ['active', 'deleted', 'hidden'] })
      .default('active')
      .notNull(),
    depth: integer('depth').default(0).notNull(),
    repliesCount: integer('replies_count').default(0).notNull(),
    reactionsCount: integer('reactions_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
    deletedByUserId: text('deleted_by_user_id').references(() => users.id),
  },
  (table) => [
    index('community_comments_entity_parent_idx').on(
      table.communityEntityId,
      table.parentCommentId,
      table.createdAt
    ),
    index('community_comments_user_idx').on(table.userId, table.createdAt),
    index('community_comments_status_idx').on(table.status, table.createdAt),
  ]
);

export const viewEvents = pgTable(
  'view_events',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    anonymousViewerHash: text('anonymous_viewer_hash'),
    sessionIdHash: text('session_id_hash'),
    source: text('source').notNull(),
    route: text('route').notNull(),
    referrerType: text('referrer_type').default('unknown').notNull(),
    referrerUrlHash: text('referrer_url_hash'),
    shareLinkId: text('share_link_id'),
    repostId: text('repost_id'),
    userAgentHash: text('user_agent_hash'),
    ipHash: text('ip_hash'),
    countryCode: text('country_code'),
    regionCode: text('region_code'),
    durationMs: integer('duration_ms'),
    scrollDepth: integer('scroll_depth'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('view_events_entity_created_idx').on(
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    index('view_events_actor_created_idx').on(table.actorUserId, table.createdAt),
  ]
);

export const userBrowseHistory = pgTable(
  'user_browse_history',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    lastViewEventId: text('last_view_event_id').references(() => viewEvents.id, {
      onDelete: 'set null',
    }),
    lastViewedAt: timestamp('last_viewed_at').defaultNow().notNull(),
    firstViewedAt: timestamp('first_viewed_at').defaultNow().notNull(),
    viewCount: integer('view_count').default(1).notNull(),
    lastSource: text('last_source'),
    lastRoute: text('last_route'),
    lastProgress: jsonb('last_progress').$type<Record<string, unknown>>(),
    snapshotTitle: text('snapshot_title'),
    snapshotAuthorUserId: text('snapshot_author_user_id'),
    coverUrl: text('cover_url'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    snapshotAuthorName: text('snapshot_author_name'),
  },
  (table) => [
    uniqueIndex('user_browse_history_unique_idx').on(
      table.userId,
      table.entityType,
      table.entityId
    ),
    index('user_browse_history_user_viewed_idx').on(table.userId, table.lastViewedAt),
  ]
);

export const shareLinks = pgTable(
  'share_links',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    uid: text('uid').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    createdByUserId: text('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    visibilitySnapshot: text('visibility_snapshot').notNull(),
    channel: text('channel').default('copy_link').notNull(),
    targetUrl: text('target_url').notNull(),
    htmlDirectUrl: text('html_direct_url'),
    expiresAt: timestamp('expires_at'),
    revokedAt: timestamp('revoked_at'),
    openCount: integer('open_count').default(0).notNull(),
    uniqueOpenCount: integer('unique_open_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('share_links_uid_idx').on(table.uid),
    index('share_links_entity_idx').on(table.entityType, table.entityId),
  ]
);

export const shareEvents = pgTable(
  'share_events',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    shareLinkId: text('share_link_id').references(() => shareLinks.id, {
      onDelete: 'set null',
    }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    anonymousActorHash: text('anonymous_actor_hash'),
    eventType: text('event_type').notNull(),
    channel: text('channel').default('copy_link').notNull(),
    target: text('target'),
    sourceRoute: text('source_route'),
    viewerHash: text('viewer_hash'),
    ipHash: text('ip_hash'),
    userAgentHash: text('user_agent_hash'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('share_events_entity_created_idx').on(
      table.entityType,
      table.entityId,
      table.createdAt
    ),
    index('share_events_link_idx').on(table.shareLinkId),
  ]
);

export const reposts = pgTable(
  'reposts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    momentId: text('moment_id'),
    comment: text('comment'),
    visibility: text('visibility', {
      enum: ['public', 'followers', 'private'],
    })
      .default('public')
      .notNull(),
    status: text('status', {
      enum: ['pending', 'active', 'failed', 'deleted'],
    })
      .default('pending')
      .notNull(),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    index('reposts_entity_idx').on(table.entityType, table.entityId),
    index('reposts_user_idx').on(table.userId, table.createdAt),
  ]
);

export const moments = pgTable(
  'moments',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    uid: text('uid').notNull(),
    authorUserId: text('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: ['post', 'page_update', 'repost', 'system'],
    })
      .default('post')
      .notNull(),
    body: text('body'),
    bodyFormat: text('body_format').default('plain_text').notNull(),
    visibility: text('visibility', {
      enum: ['public', 'unlisted', 'private'],
    })
      .default('public')
      .notNull(),
    sourceEventId: text('source_event_id'),
    sourcePageUpdateEventId: text('source_page_update_event_id'),
    repostOfMomentId: text('repost_of_moment_id'),
    replyToMomentId: text('reply_to_moment_id'),
    likeCount: integer('like_count').default(0).notNull(),
    commentCount: integer('comment_count').default(0).notNull(),
    repostCount: integer('repost_count').default(0).notNull(),
    attachmentCount: integer('attachment_count').default(0).notNull(),
    topicCount: integer('topic_count').default(0).notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    source: text('source'),
    quoteText: text('quote_text'),
    viewCount: integer('view_count').default(0),
    bookmarkCount: integer('bookmark_count').default(0),
  },
  (table) => [
    uniqueIndex('moments_uid_idx').on(table.uid),
    uniqueIndex('moments_page_update_event_unique_idx').on(
      table.authorUserId,
      table.sourcePageUpdateEventId
    ),
    index('moments_author_created_idx').on(table.authorUserId, table.createdAt),
    index('moments_feed_idx').on(table.visibility, table.isDeleted, table.createdAt),
  ]
);

export const momentAttachments = pgTable(
  'moment_attachments',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    momentId: text('moment_id')
      .notNull()
      .references(() => moments.id, { onDelete: 'cascade' }),
    attachmentType: text('attachment_type', {
      enum: ['published_page', 'collection', 'mcp', 'skill', 'media'],
    }).notNull(),
    attachmentId: text('attachment_id').notNull(),
    attachmentUid: text('attachment_uid'),
    titleSnapshot: text('title_snapshot').notNull(),
    descriptionSnapshot: text('description_snapshot'),
    coverUrlSnapshot: text('cover_url_snapshot'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    authorNameSnapshot: text('author_name_snapshot'),
    viewCountSnapshot: integer('view_count_snapshot').default(0),
    commentCountSnapshot: integer('comment_count_snapshot').default(0),
  },
  (table) => [
    index('moment_attachments_moment_idx').on(table.momentId, table.sortOrder),
  ]
);

export const momentTopics = pgTable(
  'moment_topics',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    description: text('description'),
    momentCount: integer('moment_count').default(0).notNull(),
    lastMomentAt: timestamp('last_moment_at'),
    isFeatured: boolean('is_featured').default(false).notNull(),
    isBlocked: boolean('is_blocked').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('moment_topics_slug_idx').on(table.slug),
    index('moment_topics_featured_idx').on(table.isFeatured, table.lastMomentAt),
  ]
);

export const momentTopicItems = pgTable(
  'moment_topic_items',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    momentId: text('moment_id')
      .notNull()
      .references(() => moments.id, { onDelete: 'cascade' }),
    topicId: text('topic_id')
      .notNull()
      .references(() => momentTopics.id, { onDelete: 'cascade' }),
    source: text('source', { enum: ['body', 'attachment', 'system'] })
      .default('body')
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('moment_topic_items_unique_idx').on(table.momentId, table.topicId),
    index('moment_topic_items_topic_idx').on(table.topicId, table.createdAt),
  ]
);

export const activityEvents = pgTable(
  'activity_events',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    actorUserId: text('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    eventType: text('event_type').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    targetUserId: text('target_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('activity_events_entity_idx').on(table.entityType, table.entityId),
    index('activity_events_created_idx').on(table.createdAt),
  ]
);

export const userFollows = pgTable(
  'user_follows',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    followerUserId: text('follower_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followeeUserId: text('followee_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    notifyLevel: text('notify_level', { enum: ['all', 'major', 'none'] })
      .default('all')
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('user_follows_unique_idx').on(
      table.followerUserId,
      table.followeeUserId
    ),
    index('user_follows_followee_idx').on(table.followeeUserId),
  ]
);

export const pageSubscriptions = pgTable(
  'page_subscriptions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publishedPageId: text('published_page_id')
      .notNull()
      .references(() => publishedPages.id, { onDelete: 'cascade' }),
    notifyLevel: text('notify_level', { enum: ['all', 'major', 'none'] })
      .default('all')
      .notNull(),
    lastSeenVersion: integer('last_seen_version').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('page_subscriptions_unique_idx').on(
      table.userId,
      table.publishedPageId
    ),
    index('page_subscriptions_page_idx').on(table.publishedPageId),
  ]
);

export const pageUpdateEvents = pgTable(
  'page_update_events',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    publishedPageId: text('published_page_id')
      .notNull()
      .references(() => publishedPages.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    userSlug: text('user_slug').notNull(),
    pageId: text('page_id').notNull(),
    version: integer('version').notNull(),
    eventType: text('event_type', {
      enum: ['published', 'updated', 'republished', 'unpublished'],
    }).notNull(),
    importance: text('importance', { enum: ['normal', 'major'] })
      .default('normal')
      .notNull(),
    title: text('title').notNull(),
    description: text('description'),
    changeSummary: text('change_summary'),
    visibility: text('visibility').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('page_update_events_unique_idx').on(
      table.publishedPageId,
      table.version,
      table.eventType
    ),
    index('page_update_events_page_created_idx').on(
      table.publishedPageId,
      table.createdAt
    ),
    index('page_update_events_user_created_idx').on(table.userId, table.createdAt),
    index('page_update_events_created_idx').on(table.createdAt, table.id),
  ]
);

export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    recipientUserId: text('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    type: text('type').notNull(),
    pageUpdateEventId: text('page_update_event_id').references(
      () => pageUpdateEvents.id,
      { onDelete: 'cascade' }
    ),
    publishedPageId: text('published_page_id').references(() => publishedPages.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    body: text('body'),
    readAt: timestamp('read_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    actorName: text('actor_name'),
    actorAvatarUrl: text('actor_avatar_url'),
    pageUid: text('page_uid'),
    pageAuthorSlug: text('page_author_slug'),
  },
  (table) => [
    uniqueIndex('notifications_event_unique_idx').on(
      table.recipientUserId,
      table.pageUpdateEventId,
      table.type
    ),
    index('notifications_recipient_created_idx').on(
      table.recipientUserId,
      table.createdAt,
      table.id
    ),
    index('notifications_unread_idx').on(table.recipientUserId, table.readAt),
  ]
);

export const rankingSnapshots = pgTable(
  'ranking_snapshots',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    rankingKey: text('ranking_key').notNull(),
    entityType: text('entity_type').notNull(),
    timeWindow: text('time_window').default('7d').notNull(),
    scopeType: text('scope_type').default('global').notNull(),
    scopeId: text('scope_id'),
    algorithmVersion: text('algorithm_version').notNull(),
    status: text('status', {
      enum: ['building', 'ready', 'failed', 'expired'],
    })
      .default('building')
      .notNull(),
    generatedAt: timestamp('generated_at'),
    validFrom: timestamp('valid_from').defaultNow().notNull(),
    validUntil: timestamp('valid_until'),
    sourceFrom: timestamp('source_from'),
    sourceUntil: timestamp('source_until'),
    itemCount: integer('item_count').default(0).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('ranking_snapshots_lookup_idx').on(
      table.rankingKey,
      table.timeWindow,
      table.scopeType,
      table.scopeId,
      table.status,
      table.validFrom
    ),
  ]
);

export const rankingItems = pgTable(
  'ranking_items',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    snapshotId: text('snapshot_id')
      .notNull()
      .references(() => rankingSnapshots.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    score: real('score').default(0).notNull(),
    rawScore: real('raw_score').default(0).notNull(),
    decayFactor: real('decay_factor').default(1).notNull(),
    reason: text('reason').notNull(),
    breakdown: jsonb('breakdown').$type<Record<string, unknown>>(),
    title: text('title').notNull(),
    description: text('description'),
    userId: text('user_id'),
    userSlug: text('user_slug'),
    pageId: text('page_id'),
    categoryId: text('category_id'),
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    publishedAt: timestamp('published_at'),
    lastPublishedAt: timestamp('last_published_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    delta: text('delta'),
    scoreLabel: text('score_label').default('热度'),
    viewCount: integer('view_count').default(0),
    likeCount: integer('like_count').default(0),
    commentCount: integer('comment_count').default(0),
    authorDisplayName: text('author_display_name'),
    authorAvatarUrl: text('author_avatar_url'),
  },
  (table) => [
    uniqueIndex('ranking_items_snapshot_entity_idx').on(
      table.snapshotId,
      table.entityType,
      table.entityId
    ),
    uniqueIndex('ranking_items_snapshot_rank_idx').on(table.snapshotId, table.rank),
    index('ranking_items_entity_idx').on(table.entityType, table.entityId),
  ]
);

export const operationSlots = pgTable(
  'operation_slots',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    uid: text('uid').notNull(),
    surface: text('surface').notNull(),
    slotKey: text('slot_key').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    layoutType: text('layout_type').notNull(),
    locale: text('locale').default('default').notNull(),
    minItems: integer('min_items').default(0).notNull(),
    maxItems: integer('max_items').default(10).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    fallbackStrategy: text('fallback_strategy').default('none').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdBy: text('created_by').references(() => users.id),
    updatedBy: text('updated_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('operation_slots_surface_locale_key_idx').on(
      table.surface,
      table.locale,
      table.slotKey
    ),
    uniqueIndex('operation_slots_uid_idx').on(table.uid),
  ]
);

export const operationItems = pgTable(
  'operation_items',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    uid: text('uid').notNull(),
    slotId: text('slot_id')
      .notNull()
      .references(() => operationSlots.id, { onDelete: 'cascade' }),
    itemType: text('item_type').notNull(),
    targetEntityType: text('target_entity_type'),
    targetEntityId: text('target_entity_id'),
    targetEntityUid: text('target_entity_uid'),
    targetUrl: text('target_url'),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    description: text('description'),
    imageUrl: text('image_url'),
    ctaLabel: text('cta_label'),
    badgeLabel: text('badge_label'),
    locale: text('locale').default('default').notNull(),
    startsAt: timestamp('starts_at'),
    endsAt: timestamp('ends_at'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    visibility: text('visibility', {
      enum: ['draft', 'scheduled', 'published', 'archived'],
    })
      .default('draft')
      .notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdBy: text('created_by').references(() => users.id),
    updatedBy: text('updated_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('operation_items_uid_idx').on(table.uid),
    index('operation_items_slot_idx').on(table.slotId, table.sortOrder),
  ]
);

export const operationRevisions = pgTable(
  'operation_revisions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    uid: text('uid').notNull(),
    surface: text('surface').notNull(),
    locale: text('locale').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    status: text('status', {
      enum: ['draft', 'published', 'rolled_back', 'archived'],
    })
      .default('draft')
      .notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    validationReport: jsonb('validation_report').$type<Record<string, unknown>>(),
    publishedAt: timestamp('published_at'),
    publishedBy: text('published_by').references(() => users.id),
    createdBy: text('created_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('operation_revisions_number_idx').on(
      table.surface,
      table.locale,
      table.revisionNumber
    ),
    uniqueIndex('operation_revisions_uid_idx').on(table.uid),
    index('operation_revisions_active_idx').on(table.surface, table.locale, table.status),
  ]
);

export const publishedPageVersionsRelations = relations(
  publishedPageVersions,
  ({ one }) => ({
    publishedPage: one(publishedPages, {
      fields: [publishedPageVersions.publishedPageId],
      references: [publishedPages.id],
    }),
    user: one(users, {
      fields: [publishedPageVersions.userId],
      references: [users.id],
    }),
  })
);

export const publishedPageRecords = pgTable(
  'published_page_records',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    publishedPageId: text('published_page_id')
      .notNull()
      .references(() => publishedPages.id, { onDelete: 'cascade' }),
    uid: text('uid').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recordNumber: integer('record_number').notNull(),
    version: integer('version').notNull(),
    action: text('action', { enum: ['publish', 'rollback'] }).notNull(),
    title: text('title').notNull(),
    icon: jsonb('icon').$type<{ type: string; value: string } | null>(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('published_page_records_page_id_idx').on(table.publishedPageId),
    index('published_page_records_user_id_uid_idx').on(table.userId, table.uid),
    uniqueIndex('published_page_records_user_id_uid_record_number_idx').on(
      table.userId,
      table.uid,
      table.recordNumber
    ),
  ]
);

export const publishedPageRecordsRelations = relations(
  publishedPageRecords,
  ({ one }) => ({
    publishedPage: one(publishedPages, {
      fields: [publishedPageRecords.publishedPageId],
      references: [publishedPages.id],
    }),
    user: one(users, {
      fields: [publishedPageRecords.userId],
      references: [users.id],
    }),
  })
);

// ============================================
// Search Query Logging
// ============================================

export const searchQueries = pgTable(
  "search_queries",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    query: text("query").notNull(),
    resultCount: integer("result_count").default(0),
    searchedAt: timestamp("searched_at").defaultNow().notNull(),
  },
  (table) => [
    index("search_queries_query_idx").on(table.query),
    index("search_queries_searched_at_idx").on(table.searchedAt),
    index("search_queries_user_id_idx").on(table.userId),
  ]
);

// ============================================
// Notes Table
// ============================================

export const notes = pgTable(
  'notes',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    uid: text('uid').notNull(),
    entityType: text('entity_type').notNull().default('published_page'),
    entityId: text('entity_id').notNull(),
    authorUserId: text('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    contentFormat: text('content_format').default('markdown').notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('notes_uid_idx').on(table.uid),
    index('notes_entity_author_idx').on(table.entityType, table.entityId, table.authorUserId, table.createdAt.desc()),
  ]
);

export const notesRelations = relations(notes, ({ one }) => ({
  author: one(users, {
    fields: [notes.authorUserId],
    references: [users.id],
  }),
}));

// ============================================
// OAuth 2.1 Authorization Server Tables
// ============================================

export const oauthGrants = pgTable(
  'oauth_grants',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    code: text('code').notNull().unique(),
    codeChallenge: text('code_challenge'),
    codeChallengeMethod: text('code_challenge_method'), // "S256"
    clientId: text('client_id'),
    redirectUri: text('redirect_uri'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scopes: text('scopes'), // space-separated "read write"
    expiresAt: timestamp('expires_at').notNull(),
    used: boolean('used').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('oauth_grants_code_idx').on(table.code),
    index('oauth_grants_user_idx').on(table.userId),
  ]
);

export const oauthTokens = pgTable(
  'oauth_tokens',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    clientId: text('client_id'),
    scopes: text('scopes'), // space-separated
    tokenHash: text('token_hash').notNull().unique(),
    refreshTokenHash: text('refresh_token_hash').unique(),
    expiresAt: timestamp('expires_at').notNull(),
    revoked: boolean('revoked').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('oauth_tokens_hash_idx').on(table.tokenHash),
    index('oauth_tokens_user_idx').on(table.userId),
    index('oauth_tokens_refresh_idx').on(table.refreshTokenHash),
  ]
);

export const oauthGrantsRelations = relations(oauthGrants, ({ one }) => ({
  user: one(users, { fields: [oauthGrants.userId], references: [users.id] }),
}));

export const oauthTokensRelations = relations(oauthTokens, ({ one }) => ({
  user: one(users, { fields: [oauthTokens.userId], references: [users.id] }),
}));

// ============================================
// Viben Assistant tables
// ============================================

export const githubInstallations = pgTable(
  "github_installations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    installationId: integer("installation_id").notNull(),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type", {
      enum: ["User", "Organization"],
    }).notNull(),
    repositorySelection: text("repository_selection", {
      enum: ["all", "selected"],
    }).notNull(),
    installationUrl: text("installation_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("github_installations_user_installation_idx").on(
      table.userId,
      table.installationId,
    ),
    uniqueIndex("github_installations_user_account_idx").on(
      table.userId,
      table.accountLogin,
    ),
  ],
);

export const vercelProjectLinks = pgTable(
  "vercel_project_links",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repoOwner: text("repo_owner").notNull(),
    repoName: text("repo_name").notNull(),
    projectId: text("project_id").notNull(),
    projectName: text("project_name").notNull(),
    teamId: text("team_id"),
    teamSlug: text("team_slug"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.repoOwner, table.repoName],
    }),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: text("status", {
      enum: ["running", "completed", "failed", "archived"],
    })
      .notNull()
      .default("running"),
    agentType: text("agent_type", { enum: ["work", "chat"] })
      .notNull()
      .default("work"),
    publishedPageId: text("published_page_id").references(
      () => publishedPages.id,
      { onDelete: "set null" },
    ),
    pageUserSlug: text("page_user_slug"),
    pageSlug: text("page_slug"),
    repoOwner: text("repo_owner"),
    repoName: text("repo_name"),
    branch: text("branch"),
    cloneUrl: text("clone_url"),
    vercelProjectId: text("vercel_project_id"),
    vercelProjectName: text("vercel_project_name"),
    vercelTeamId: text("vercel_team_id"),
    vercelTeamSlug: text("vercel_team_slug"),
    isNewBranch: boolean("is_new_branch").default(false).notNull(),
    autoCommitPushOverride: boolean("auto_commit_push_override"),
    autoCreatePrOverride: boolean("auto_create_pr_override"),
    globalSkillRefs: jsonb("global_skill_refs").notNull().default([]),
    sandboxState: jsonb("sandbox_state").$type<SandboxState>(),
    lifecycleState: text("lifecycle_state", {
      enum: [
        "provisioning",
        "active",
        "hibernating",
        "hibernated",
        "restoring",
        "archived",
        "failed",
      ],
    }),
    lifecycleVersion: integer("lifecycle_version").notNull().default(0),
    lastActivityAt: timestamp("last_activity_at"),
    sandboxExpiresAt: timestamp("sandbox_expires_at"),
    hibernateAfter: timestamp("hibernate_after"),
    lifecycleRunId: text("lifecycle_run_id"),
    sandboxProvisioningRunId: text("sandbox_provisioning_run_id"),
    lifecycleError: text("lifecycle_error"),
    linesAdded: integer("lines_added").default(0),
    linesRemoved: integer("lines_removed").default(0),
    prNumber: integer("pr_number"),
    prStatus: text("pr_status", {
      enum: ["open", "merged", "closed"],
    }),
    snapshotUrl: text("snapshot_url"),
    snapshotCreatedAt: timestamp("snapshot_created_at"),
    snapshotSizeBytes: integer("snapshot_size_bytes"),
    cachedDiff: jsonb("cached_diff"),
    cachedDiffUpdatedAt: timestamp("cached_diff_updated_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

export const chats = pgTable(
  "chats",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    modelId: text("model_id").default("anthropic/claude-haiku-4.5"),
    activeStreamId: text("active_stream_id"),
    lastAssistantMessageAt: timestamp("last_assistant_message_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("chats_session_id_idx").on(table.sessionId)],
);

export const shares = pgTable(
  "shares",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("shares_chat_id_idx").on(table.chatId)],
);

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", {
    enum: ["user", "assistant"],
  }).notNull(),
  parts: jsonb("parts").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chatReads = pgTable(
  "chat_reads",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.chatId] }),
    index("chat_reads_chat_id_idx").on(table.chatId),
  ],
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modelId: text("model_id"),
    status: text("status", {
      enum: ["completed", "aborted", "failed"],
    }).notNull(),
    startedAt: timestamp("started_at").notNull(),
    finishedAt: timestamp("finished_at").notNull(),
    totalDurationMs: integer("total_duration_ms").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("workflow_runs_chat_id_idx").on(table.chatId),
    index("workflow_runs_session_id_idx").on(table.sessionId),
    index("workflow_runs_user_id_idx").on(table.userId),
  ],
);

export const workflowRunSteps = pgTable(
  "workflow_run_steps",
  {
    id: text("id").primaryKey(),
    workflowRunId: text("workflow_run_id")
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    stepNumber: integer("step_number").notNull(),
    startedAt: timestamp("started_at").notNull(),
    finishedAt: timestamp("finished_at").notNull(),
    durationMs: integer("duration_ms").notNull(),
    finishReason: text("finish_reason"),
    rawFinishReason: text("raw_finish_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("workflow_run_steps_run_id_idx").on(table.workflowRunId),
    uniqueIndex("workflow_run_steps_run_step_idx").on(
      table.workflowRunId,
      table.stepNumber,
    ),
  ],
);

export const userPreferences = pgTable("user_preferences", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  defaultModelId: text("default_model_id").default(
    "anthropic/claude-haiku-4.5",
  ),
  defaultSubagentModelId: text("default_subagent_model_id"),
  defaultSandboxType: text("default_sandbox_type", {
    enum: ["vercel"],
  }).default("vercel"),
  defaultDiffMode: text("default_diff_mode", {
    enum: ["unified", "split"],
  }).default("unified"),
  autoCommitPush: boolean("auto_commit_push").notNull().default(false),
  autoCreatePr: boolean("auto_create_pr").notNull().default(false),
  alertsEnabled: boolean("alerts_enabled").notNull().default(true),
  alertSoundEnabled: boolean("alert_sound_enabled").notNull().default(true),
  publicUsageEnabled: boolean("public_usage_enabled").notNull().default(false),
  globalSkillRefs: jsonb("global_skill_refs").notNull().default([]),
  modelVariants: jsonb("model_variants").notNull().default([]),
  enabledModelIds: jsonb("enabled_model_ids").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usageEvents = pgTable("usage_events", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  source: text("source", { enum: ["web"] })
    .notNull()
    .default("web"),
  agentType: text("agent_type", { enum: ["main", "subagent"] })
    .notNull()
    .default("main"),
  provider: text("provider"),
  modelId: text("model_id"),
  inputTokens: integer("input_tokens").notNull().default(0),
  cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  toolCallCount: integer("tool_call_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports for assistant tables
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionAgentType = Session["agentType"];
export type VercelProjectLink = typeof vercelProjectLinks.$inferSelect;
export type NewVercelProjectLink = typeof vercelProjectLinks.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Share = typeof shares.$inferSelect;
export type NewShare = typeof shares.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type ChatRead = typeof chatReads.$inferSelect;
export type NewChatRead = typeof chatReads.$inferInsert;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type NewWorkflowRun = typeof workflowRuns.$inferInsert;
export type WorkflowRunStep = typeof workflowRunSteps.$inferSelect;
export type NewWorkflowRunStep = typeof workflowRunSteps.$inferInsert;
export type GitHubInstallation = typeof githubInstallations.$inferSelect;
export type NewGitHubInstallation = typeof githubInstallations.$inferInsert;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type NewUserPreferences = typeof userPreferences.$inferInsert;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
