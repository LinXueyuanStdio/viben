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

export interface IconData {
  type: string;
  value: string;
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
// Page Types
// ============================================

export interface PublishPageRequest {
  uid: string;
  title: string;
  icon?: IconData | null;
  description?: string | null;
  html: string;
}

export interface PublishPageResponse {
  success: boolean;
  page_uid: string;
  url: string;
  updated: boolean;
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

// ============================================
// Authentication Types
// ============================================

/**
 * User session data from authentication
 */
export interface UserSession {
  id: string;
  email: string;
  username: string;
  userSlug: string;
  displayName: string;
  avatarUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
  /** Token expiration timestamp in milliseconds */
  expiresAt: number;
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Authentication response from login/OAuth
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    userSlug: string;
    displayName: string;
    avatarUrl: string | null;
  };
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
}

/**
 * Token validation response
 */
export interface TokenValidationResponse {
  valid: boolean;
  user?: User;
}

/**
 * OAuth provider type
 */
export type OAuthProvider = 'github' | 'google';

/**
 * OAuth URL options
 */
export interface OAuthUrlOptions {
  /** Redirect URI after OAuth completion */
  redirectUri: string;
  /** Client type (desktop, web, cli) */
  client?: 'desktop' | 'web' | 'cli';
  /** OAuth state parameter for CSRF protection */
  state?: string;
}

// ============================================
// Voice Token Types
// ============================================

/**
 * Request for voice token
 */
export interface VoiceTokenRequest {
  /** Vocal Bridge API key */
  api_key: string;
  /** Agent ID */
  agent_id: string;
  /** Participant name (optional) */
  participant_name?: string;
}

/**
 * Response from voice token endpoint
 */
export interface VoiceTokenResponse {
  /** LiveKit server URL */
  livekit_url: string;
  /** JWT token for LiveKit */
  token: string;
  /** Room name */
  room_name: string;
  /** Participant identity */
  participant_identity: string;
  /** Token expiration time in seconds */
  expires_in: number;
  /** Agent mode */
  agent_mode: string;
}
