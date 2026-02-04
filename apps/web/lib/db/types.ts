import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import * as schema from './schema';

// ============================================
// Select Types (for reading from database)
// ============================================

export type User = InferSelectModel<typeof schema.users>;
export type ApiKey = InferSelectModel<typeof schema.apiKeys>;
export type OAuthConnection = InferSelectModel<typeof schema.oauthConnections>;
export type Organization = InferSelectModel<typeof schema.organizations>;
export type OrgMember = InferSelectModel<typeof schema.orgMembers>;
export type McpPackage = InferSelectModel<typeof schema.mcpPackages>;
export type SkillPackage = InferSelectModel<typeof schema.skillPackages>;
export type Collection = InferSelectModel<typeof schema.collections>;
export type CollectionItem = InferSelectModel<typeof schema.collectionItems>;
export type Comment = InferSelectModel<typeof schema.comments>;
export type Favorite = InferSelectModel<typeof schema.favorites>;
export type Rating = InferSelectModel<typeof schema.ratings>;
export type PackageRelease = InferSelectModel<typeof schema.packageReleases>;
export type DownloadRecord = InferSelectModel<typeof schema.downloadRecords>;
export type Workspace = InferSelectModel<typeof schema.workspaces>;
export type WorkspaceEntity = InferSelectModel<typeof schema.workspaceEntities>;

// ============================================
// Insert Types (for creating new records)
// ============================================

export type NewUser = InferInsertModel<typeof schema.users>;
export type NewApiKey = InferInsertModel<typeof schema.apiKeys>;
export type NewOAuthConnection = InferInsertModel<typeof schema.oauthConnections>;
export type NewOrganization = InferInsertModel<typeof schema.organizations>;
export type NewOrgMember = InferInsertModel<typeof schema.orgMembers>;
export type NewMcpPackage = InferInsertModel<typeof schema.mcpPackages>;
export type NewSkillPackage = InferInsertModel<typeof schema.skillPackages>;
export type NewCollection = InferInsertModel<typeof schema.collections>;
export type NewCollectionItem = InferInsertModel<typeof schema.collectionItems>;
export type NewComment = InferInsertModel<typeof schema.comments>;
export type NewFavorite = InferInsertModel<typeof schema.favorites>;
export type NewRating = InferInsertModel<typeof schema.ratings>;
export type NewPackageRelease = InferInsertModel<typeof schema.packageReleases>;
export type NewDownloadRecord = InferInsertModel<typeof schema.downloadRecords>;
export type NewWorkspace = InferInsertModel<typeof schema.workspaces>;
export type NewWorkspaceEntity = InferInsertModel<typeof schema.workspaceEntities>;

// ============================================
// Enum Types
// ============================================

export type UserRole = 'user' | 'developer' | 'admin';
export type OAuthProvider = 'github' | 'google';
export type OrgMemberRole = 'member' | 'admin' | 'owner';
export type Transport = 'stdio' | 'sse' | 'http';
export type SkillType = 'command' | 'prompt' | 'agent';
export type EntityType = 'mcp' | 'skill';
export type SocialEntityType = 'mcp' | 'skill' | 'collection';
