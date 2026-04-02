/**
 * Viben API Client
 *
 * A TypeScript client library for the Viben platform API.
 *
 * @example
 * ```ts
 * import { VibenClient } from '@viben/api-client';
 *
 * const client = new VibenClient({
 *   baseUrl: 'https://viben-web.vercel.app',
 *   apiKey: 'viben_xxx...',
 * });
 *
 * // List MCP packages
 * const { packages } = await client.mcp.list({ page: 1 });
 *
 * // Search skills
 * const { packages: skills } = await client.skill.search('git');
 *
 * // Get current user
 * const { user } = await client.user.me();
 *
 * // Download a package
 * const blob = await client.mcp.download(packageId);
 * ```
 *
 * @packageDocumentation
 */

// Client
export { VibenClient, ApiError } from './client';
export type { VibenClientConfig, FetchFunction } from './client';

// Backwards compatibility aliases
export { VibenClient as BrowseMcpClient } from './client';
export type { VibenClientConfig as BrowseMcpClientConfig } from './client';

// Types
export type {
  // Common
  ListParams,
  SkillListParams,
  PaginatedResponse,
  Author,
  // MCP
  McpPackage,
  McpPackageResponse,
  // Skills
  SkillPackage,
  SkillPackageResponse,
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
} from './types';
