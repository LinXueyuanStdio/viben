import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as schema from './schema';

// ============================================
// Select Types (for reading from database)
// ============================================

export type User = InferSelectModel<typeof schema.users>;
export type ApiKey = InferSelectModel<typeof schema.apiKeys>;
export type OAuthConnection = InferSelectModel<typeof schema.oauthConnections>;
export type McpPackage = InferSelectModel<typeof schema.mcpPackages>;
export type SkillPackage = InferSelectModel<typeof schema.skillPackages>;
export type Collection = InferSelectModel<typeof schema.collections>;
export type CollectionItem = InferSelectModel<typeof schema.collectionItems>;
export type Comment = InferSelectModel<typeof schema.comments>;
export type Favorite = InferSelectModel<typeof schema.favorites>;
export type Rating = InferSelectModel<typeof schema.ratings>;
export type PackageRelease = InferSelectModel<typeof schema.packageReleases>;
export type DownloadRecord = InferSelectModel<typeof schema.downloadRecords>;
export type Report = InferSelectModel<typeof schema.reports>;
export type ModerationLog = InferSelectModel<typeof schema.moderationLogs>;
export type Draft = InferSelectModel<typeof schema.drafts>;
export type GithubConnection = InferSelectModel<typeof schema.githubConnections>;

// ============================================
// Insert Types (for creating new records)
// ============================================

export type NewUser = InferInsertModel<typeof schema.users>;
export type NewApiKey = InferInsertModel<typeof schema.apiKeys>;
export type NewOAuthConnection = InferInsertModel<typeof schema.oauthConnections>;
export type NewMcpPackage = InferInsertModel<typeof schema.mcpPackages>;
export type NewSkillPackage = InferInsertModel<typeof schema.skillPackages>;
export type NewCollection = InferInsertModel<typeof schema.collections>;
export type NewCollectionItem = InferInsertModel<typeof schema.collectionItems>;
export type NewComment = InferInsertModel<typeof schema.comments>;
export type NewFavorite = InferInsertModel<typeof schema.favorites>;
export type NewRating = InferInsertModel<typeof schema.ratings>;
export type NewPackageRelease = InferInsertModel<typeof schema.packageReleases>;
export type NewDownloadRecord = InferInsertModel<typeof schema.downloadRecords>;
export type NewReport = InferInsertModel<typeof schema.reports>;
export type NewModerationLog = InferInsertModel<typeof schema.moderationLogs>;
export type NewDraft = InferInsertModel<typeof schema.drafts>;
export type NewGithubConnection = InferInsertModel<typeof schema.githubConnections>;

// ============================================
// Enum Types
// ============================================

export type UserRole =
  | 'user'
  | 'developer'
  | 'admin'
  | 'super_admin'
  | 'moderator'
  | 'support';
export type OAuthProvider = 'github' | 'google';
export type Transport = 'stdio' | 'sse' | 'http';
export type SkillType = 'command' | 'prompt' | 'agent';
export type EntityType = 'mcp' | 'skill';
export type ItemType = 'mcp' | 'skill';
export type SocialEntityType = 'mcp' | 'skill' | 'collection';
export type PackageStatus = 'pending' | 'approved' | 'rejected' | 'featured';
export type ReportReason = 'spam' | 'inappropriate' | 'copyright' | 'security' | 'other';
export type ReportStatus = 'pending' | 'resolved' | 'dismissed';
export type ModerationAction =
  | 'approve'
  | 'reject'
  | 'feature'
  | 'unfeature'
  | 'delete'
  | 'warn'
  | 'ban'
  | 'unban';
export type DraftPackageType = 'mcp' | 'skill';
