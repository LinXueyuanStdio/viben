/**
 * Browse MCP API Client
 *
 * A TypeScript client library for the Browse MCP platform API.
 *
 * @example
 * ```ts
 * import { BrowseMcpClient } from '@browse-mcp/api-client';
 *
 * const client = new BrowseMcpClient({
 *   baseUrl: 'https://browse-mcp.vercel.app',
 *   apiKey: 'bmcp_xxx...',
 * });
 *
 * // List MCP packages
 * const { packages } = await client.mcp.list({ page: 1 });
 *
 * // Search skills
 * const { packages: skills } = await client.skills.search('git');
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
export { BrowseMcpClient, ApiError } from './client';
export type { BrowseMcpClientConfig } from './client';

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
  // Workspaces
  Workspace,
  WorkspacesResponse,
  WorkspaceResponse,
  WorkspaceEntity,
  WorkspacePackagesResponse,
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
} from './types';
