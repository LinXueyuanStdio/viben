/**
 * Viben API Client Types
 *
 * Type definitions for the Viben platform API responses.
 */

// ============================================
// Common Types
// ============================================

/**
 * Query parameters for list endpoints
 */
export interface ListParams {
  page?: number;
  limit?: number;
  sort?: 'latest' | 'popular' | 'downloads';
  category?: string;
}

/**
 * Skill-specific list parameters
 */
export interface SkillListParams extends ListParams {
  type?: 'command' | 'prompt' | 'agent';
}

/**
 * Standard paginated response structure
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Author information embedded in packages
 */
export interface Author {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

// ============================================
// MCP Package Types
// ============================================

/**
 * MCP package from the marketplace
 */
export interface McpPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  longDescription?: string | null;
  category: string | null;
  transport: 'stdio' | 'sse' | 'http';
  tags: string[] | null;
  repositoryUrl: string | null;
  homepageUrl?: string | null;
  license?: string | null;
  entryPoint?: string;
  configSchema?: Record<string, unknown> | null;
  dependencies?: string[] | null;
  favoritesCount: number;
  downloadsCount: number;
  ratingAvg: number;
  ratingCount?: number;
  author: Author | null;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Response for single MCP package
 */
export interface McpPackageResponse {
  package: McpPackage;
}

// ============================================
// Skill Package Types
// ============================================

/**
 * Skill package from the marketplace
 */
export interface SkillPackage {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  longDescription?: string | null;
  category: string | null;
  skillType: 'command' | 'prompt' | 'agent';
  triggerPatterns: string[] | null;
  content?: string;
  tags: string[] | null;
  repositoryUrl?: string | null;
  compatibility: string[] | null;
  configSchema?: Record<string, unknown> | null;
  dependencies?: string[] | null;
  favoritesCount: number;
  downloadsCount: number;
  ratingAvg: number;
  ratingCount?: number;
  author: Author | null;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Response for single skill package
 */
export interface SkillPackageResponse {
  package: SkillPackage;
}

// ============================================
// User Types
// ============================================

/**
 * User profile information
 */
export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  websiteUrl?: string | null;
  githubUsername?: string | null;
  role: 'user' | 'developer' | 'admin';
  emailVerified?: boolean;
  createdAt?: string;
}

/**
 * Response for user profile
 */
export interface UserResponse {
  user: User;
}

/**
 * Favorite item
 */
export interface Favorite {
  userId: string;
  entityType: 'mcp' | 'skill' | 'collection';
  entityId: string;
  createdAt: string;
}

/**
 * Response for user favorites
 */
export interface FavoritesResponse {
  favorites: Favorite[];
}

// ============================================
// Workspace Types
// ============================================

/**
 * Workspace for organizing packages
 */
export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response for workspace list
 */
export interface WorkspacesResponse {
  workspaces: Workspace[];
}

/**
 * Response for single workspace
 */
export interface WorkspaceResponse {
  workspace: Workspace;
}

/**
 * Workspace entity (package assignment)
 */
export interface WorkspaceEntity {
  workspaceId: string;
  entityType: 'mcp' | 'skill';
  entityId: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  addedAt: string;
}

/**
 * Workspace packages response with package details
 */
export interface WorkspacePackagesResponse {
  packages: {
    mcp: McpPackage[];
    skills: SkillPackage[];
  };
  configs: Array<{
    packageId: string;
    packageType: 'mcp' | 'skill';
    config: Record<string, unknown> | null;
    enabled: boolean;
  }>;
}

// ============================================
// Collection Types
// ============================================

/**
 * Collection of packages
 */
export interface Collection {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  isPublic: boolean;
  entityType: 'mcp' | 'skill';
  favoritesCount: number;
  createdAt: string;
  updatedAt: string;
  owner?: Author;
  itemCount?: number;
}

/**
 * Collection item
 */
export interface CollectionItem {
  collectionId: string;
  entityId: string;
  note: string | null;
  addedAt: string;
}

/**
 * Response for collections list
 */
export interface CollectionsResponse {
  collections: Collection[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Comment Types
// ============================================

/**
 * Comment on a package
 */
export interface Comment {
  id: string;
  entityType: 'mcp' | 'skill' | 'collection';
  entityId: string;
  userId: string;
  content: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user?: Author;
}

/**
 * Response for comments
 */
export interface CommentsResponse {
  comments: Comment[];
}

// ============================================
// API Key Types
// ============================================

/**
 * API key for authentication
 */
export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * Response for API keys list
 */
export interface ApiKeysResponse {
  apiKeys: ApiKey[];
}

/**
 * Response for creating an API key (includes full key)
 */
export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  key: string; // Full key, only shown once
}
