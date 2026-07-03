/**
 * Viben API Client
 *
 * A TypeScript client library for the Viben platform API.
 * Provides HTTP client, Fastify proxy plugin, CLI commands, and shared utilities.
 *
 * @example
 * ```ts
 * import { VibenClient, createClient } from '@viben/api-client';
 *
 * // Auto-configured client
 * const client = createClient();
 *
 * // Or manual configuration
 * const client = new VibenClient({
 *   baseUrl: 'https://viben-web.vercel.app',
 *   apiKey: 'viben_xxx...',
 * });
 *
 * // List MCP packages
 * const { data: packages } = await client.mcp.list({ page: 1 });
 *
 * // Search skills
 * const results = await client.skill.search('git');
 *
 * // Get current user
 * const { user } = await client.user.me();
 * ```
 *
 * @packageDocumentation
 */

// Client
export { VibenClient, ApiError } from './client';
export type { VibenClientConfig, FetchFunction } from './client';

// Client factory
export { createClient, createAuthenticatedClient } from './client-factory';

// Backwards compatibility aliases
export { VibenClient as BrowseMcpClient } from './client';
export type { VibenClientConfig as BrowseMcpClientConfig } from './client';

// Constants
export { VIBEN_WEB_URL } from './constants';

// Errors
export {
  NetworkError,
  AuthError,
  RateLimitError,
  ServerError,
  isApiError,
  getApiErrorCode,
} from './errors';

// Types
export type {
  // Common
  ListParams,
  SkillListParams,
  PaginatedResponse,
  Author,
  IconData,
  Category,
  // MCP
  McpPackage,
  McpPackageResponse,
  // Skills
  SkillPackage,
  SkillPackageResponse,
  // Pages
  PublishPageRequest,
  PublishPageResponse,
  PublishStatusResponse,
  PublishHistoryItem,
  PublishHistoryResponse,
  PublishVersionResponse,
  PublishRollbackResponse,
  PublishedPage,
  // User
  User,
  UserResponse,
  Favorite,
  FavoritesResponse,
  // Collections
  Collection,
  CollectionItem,
  CollectionsResponse,
  // Comments
  Comment,
  CommentsResponse,
  // API Keys
  ApiKey,
  ApiKeysResponse,
  CreateApiKeyResponse,
  // Authentication
  UserSession,
  LoginCredentials,
  AuthResponse,
  TokenValidationResponse,
  OAuthProvider,
  OAuthUrlOptions,
  // Voice
  VoiceTokenRequest,
  VoiceTokenResponse,
} from './types';
