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
export type PublishedPage = InferSelectModel<typeof schema.publishedPages>;
export type PublishedPageVersion = InferSelectModel<typeof schema.publishedPageVersions>;
export type PublishedPageRecord = InferSelectModel<typeof schema.publishedPageRecords>;
export type PageCategory = InferSelectModel<typeof schema.pageCategories>;
export type MediaAsset = InferSelectModel<typeof schema.mediaAssets>;
export type EntityStatsDaily = InferSelectModel<typeof schema.entityStatsDaily>;
export type CommunityEntity = InferSelectModel<typeof schema.communityEntities>;
export type CommunityReaction = InferSelectModel<typeof schema.communityReactions>;
export type CommunityBookmark = InferSelectModel<typeof schema.communityBookmarks>;
export type CommunityComment = InferSelectModel<typeof schema.communityComments>;
export type ViewEvent = InferSelectModel<typeof schema.viewEvents>;
export type UserBrowseHistory = InferSelectModel<typeof schema.userBrowseHistory>;
export type ShareLink = InferSelectModel<typeof schema.shareLinks>;
export type ShareEvent = InferSelectModel<typeof schema.shareEvents>;
export type Repost = InferSelectModel<typeof schema.reposts>;
export type Moment = InferSelectModel<typeof schema.moments>;
export type MomentAttachment = InferSelectModel<typeof schema.momentAttachments>;
export type MomentTopic = InferSelectModel<typeof schema.momentTopics>;
export type MomentTopicItem = InferSelectModel<typeof schema.momentTopicItems>;
export type ActivityEvent = InferSelectModel<typeof schema.activityEvents>;
export type UserFollow = InferSelectModel<typeof schema.userFollows>;
export type PageSubscription = InferSelectModel<typeof schema.pageSubscriptions>;
export type PageUpdateEvent = InferSelectModel<typeof schema.pageUpdateEvents>;
export type Notification = InferSelectModel<typeof schema.notifications>;
export type RankingSnapshot = InferSelectModel<typeof schema.rankingSnapshots>;
export type RankingItem = InferSelectModel<typeof schema.rankingItems>;
export type OperationSlot = InferSelectModel<typeof schema.operationSlots>;
export type OperationItem = InferSelectModel<typeof schema.operationItems>;
export type OperationRevision = InferSelectModel<typeof schema.operationRevisions>;

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
export type NewPublishedPage = InferInsertModel<typeof schema.publishedPages>;
export type NewPublishedPageVersion = InferInsertModel<typeof schema.publishedPageVersions>;
export type NewPublishedPageRecord = InferInsertModel<typeof schema.publishedPageRecords>;
export type NewPageCategory = InferInsertModel<typeof schema.pageCategories>;
export type NewMediaAsset = InferInsertModel<typeof schema.mediaAssets>;
export type NewEntityStatsDaily = InferInsertModel<typeof schema.entityStatsDaily>;
export type NewCommunityEntity = InferInsertModel<typeof schema.communityEntities>;
export type NewCommunityReaction = InferInsertModel<typeof schema.communityReactions>;
export type NewCommunityBookmark = InferInsertModel<typeof schema.communityBookmarks>;
export type NewCommunityComment = InferInsertModel<typeof schema.communityComments>;
export type NewViewEvent = InferInsertModel<typeof schema.viewEvents>;
export type NewUserBrowseHistory = InferInsertModel<typeof schema.userBrowseHistory>;
export type NewShareLink = InferInsertModel<typeof schema.shareLinks>;
export type NewShareEvent = InferInsertModel<typeof schema.shareEvents>;
export type NewRepost = InferInsertModel<typeof schema.reposts>;
export type NewMoment = InferInsertModel<typeof schema.moments>;
export type NewMomentAttachment = InferInsertModel<typeof schema.momentAttachments>;
export type NewMomentTopic = InferInsertModel<typeof schema.momentTopics>;
export type NewMomentTopicItem = InferInsertModel<typeof schema.momentTopicItems>;
export type NewActivityEvent = InferInsertModel<typeof schema.activityEvents>;
export type NewUserFollow = InferInsertModel<typeof schema.userFollows>;
export type NewPageSubscription = InferInsertModel<typeof schema.pageSubscriptions>;
export type NewPageUpdateEvent = InferInsertModel<typeof schema.pageUpdateEvents>;
export type NewNotification = InferInsertModel<typeof schema.notifications>;
export type NewRankingSnapshot = InferInsertModel<typeof schema.rankingSnapshots>;
export type NewRankingItem = InferInsertModel<typeof schema.rankingItems>;
export type NewOperationSlot = InferInsertModel<typeof schema.operationSlots>;
export type NewOperationItem = InferInsertModel<typeof schema.operationItems>;
export type NewOperationRevision = InferInsertModel<typeof schema.operationRevisions>;

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
export type CommunityEntityType = 'published_page' | 'moment' | 'comment';
export type PublishedPageVisibility = 'public' | 'unlisted' | 'private';
export type PublishedPageModerationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'hidden';
export type NotifyLevel = 'all' | 'major' | 'none';
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
