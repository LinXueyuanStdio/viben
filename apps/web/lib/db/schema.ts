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

// ============================================
// User System Tables
// ============================================

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
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
      .default('user')
      .notNull(),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    lastLoginAt: timestamp('last_login_at'),
  },
  (table) => [
    index('users_username_idx').on(table.username),
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
    favoritesCount: integer('favorites_count').default(0).notNull(),
    downloadsCount: integer('downloads_count').default(0).notNull(),
    ratingAvg: real('rating_avg').default(0).notNull(),
    ratingCount: integer('rating_count').default(0).notNull(),

    // Status
    isPublished: boolean('is_published').default(false).notNull(),

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
    favoritesCount: integer('favorites_count').default(0).notNull(),
    downloadsCount: integer('downloads_count').default(0).notNull(),
    ratingAvg: real('rating_avg').default(0).notNull(),
    ratingCount: integer('rating_count').default(0).notNull(),

    // Status
    isPublished: boolean('is_published').default(false).notNull(),

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
    favoritesCount: integer('favorites_count').default(0).notNull(),
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

export const favorites = pgTable(
  'favorites',
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
    index('favorites_entity_idx').on(table.entityType, table.entityId),
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
      enum: ['mcp', 'skill', 'comment', 'collection', 'user'],
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
      enum: ['mcp', 'skill', 'comment', 'collection', 'user', 'report'],
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
        'warn',
        'ban',
        'unban',
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
  organizations: many(organizations),
  mcpPackages: many(mcpPackages),
  skillPackages: many(skillPackages),
  collections: many(collections),
  comments: many(comments),
  workspaces: many(workspaces),
  reports: many(reports),
  moderationLogs: many(moderationLogs),
  drafts: many(drafts),
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

export const oauthConnectionsRelations = relations(oauthConnections, ({ one }) => ({
  user: one(users, {
    fields: [oauthConnections.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, {
    fields: [organizations.ownerId],
    references: [users.id],
  }),
  members: many(orgMembers),
  mcpPackages: many(mcpPackages),
  skillPackages: many(skillPackages),
}));

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [orgMembers.orgId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [orgMembers.userId],
    references: [users.id],
  }),
}));

export const mcpPackagesRelations = relations(mcpPackages, ({ one }) => ({
  author: one(users, {
    fields: [mcpPackages.authorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [mcpPackages.orgId],
    references: [organizations.id],
  }),
}));

export const skillPackagesRelations = relations(skillPackages, ({ one }) => ({
  author: one(users, {
    fields: [skillPackages.authorId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [skillPackages.orgId],
    references: [organizations.id],
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

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  entities: many(workspaceEntities),
}));

export const workspaceEntitiesRelations = relations(workspaceEntities, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceEntities.workspaceId],
    references: [workspaces.id],
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
