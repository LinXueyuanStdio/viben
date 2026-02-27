/**
 * Type declarations for @viben/api-client
 *
 * This module provides types from the Viben platform SDK.
 * These types should match packages/api-client/src/types.ts
 */

declare module "@viben/api-client" {
  // ============================================
  // Common Types
  // ============================================

  export interface ListParams {
    page?: number;
    limit?: number;
    sort?: "latest" | "popular" | "downloads";
    category?: string;
  }

  export interface SkillListParams extends ListParams {
    type?: "command" | "prompt" | "agent";
  }

  export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  export interface Author {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  }

  // ============================================
  // MCP Package Types
  // ============================================

  export interface McpPackage {
    id: string;
    name: string;
    slug: string;
    version: string;
    description: string;
    longDescription?: string | null;
    category: string | null;
    transport: "stdio" | "sse" | "http";
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

  export interface McpPackageResponse {
    package: McpPackage;
  }

  // ============================================
  // Skill Package Types
  // ============================================

  export interface SkillPackage {
    id: string;
    name: string;
    slug: string;
    version: string;
    description: string;
    longDescription?: string | null;
    category: string | null;
    skillType: "command" | "prompt" | "agent";
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

  export interface SkillPackageResponse {
    package: SkillPackage;
  }

  // ============================================
  // User Types
  // ============================================

  export interface User {
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    bio: string | null;
    websiteUrl?: string | null;
    githubUsername?: string | null;
    role: "user" | "developer" | "admin";
    emailVerified?: boolean;
    createdAt?: string;
  }

  export interface UserResponse {
    user: User;
  }

  export interface Favorite {
    userId: string;
    entityType: "mcp" | "skill" | "collection";
    entityId: string;
    createdAt: string;
  }

  export interface FavoritesResponse {
    favorites: Favorite[];
  }

  // ============================================
  // Workspace Types
  // ============================================

  export interface Workspace {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
  }

  export interface WorkspacesResponse {
    workspaces: Workspace[];
  }

  export interface WorkspaceResponse {
    workspace: Workspace;
  }

  export interface WorkspaceEntity {
    workspaceId: string;
    entityType: "mcp" | "skill";
    entityId: string;
    enabled: boolean;
    config: Record<string, unknown> | null;
    addedAt: string;
  }

  export interface PackageConfig {
    packageId: string;
    packageType: "mcp" | "skill";
    config: Record<string, unknown> | null;
    enabled: boolean;
  }

  export interface WorkspacePackagesResponse {
    packages: {
      mcp: McpPackage[];
      skills: SkillPackage[];
    };
    configs: PackageConfig[];
  }

  // ============================================
  // Collection Types
  // ============================================

  export interface Collection {
    id: string;
    name: string;
    description: string | null;
    ownerId: string;
    isPublic: boolean;
    entityType: "mcp" | "skill";
    favoritesCount: number;
    createdAt: string;
    updatedAt: string;
    owner?: Author;
    itemCount?: number;
  }

  export interface CollectionItem {
    collectionId: string;
    entityId: string;
    note: string | null;
    addedAt: string;
  }

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

  export interface Comment {
    id: string;
    entityType: "mcp" | "skill" | "collection";
    entityId: string;
    userId: string;
    content: string;
    parentId: string | null;
    createdAt: string;
    updatedAt: string;
    user?: Author;
  }

  export interface CommentsResponse {
    comments: Comment[];
  }

  // ============================================
  // API Key Types
  // ============================================

  export interface ApiKey {
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    expiresAt: string | null;
    lastUsedAt: string | null;
    createdAt: string;
  }

  export interface ApiKeysResponse {
    apiKeys: ApiKey[];
  }

  export interface CreateApiKeyResponse {
    apiKey: ApiKey;
    key: string;
  }

  // ============================================
  // Error Types
  // ============================================

  export class ApiError extends Error {
    constructor(message: string, status: number, details?: unknown);
    status: number;
    details?: unknown;
  }

  // ============================================
  // Client
  // ============================================

  export class VibenClient {
    constructor(config: { baseUrl: string; apiKey?: string; timeout?: number });

    setApiKey(apiKey: string | undefined): void;
    getApiKey(): string | undefined;

    mcp: {
      list(params?: ListParams): Promise<PaginatedResponse<McpPackage>>;
      get(id: string): Promise<McpPackageResponse>;
      search(
        query: string,
        params?: ListParams
      ): Promise<PaginatedResponse<McpPackage>>;
      download(id: string, version?: string): Promise<Blob>;
      toggleFavorite(id: string): Promise<{ favorited: boolean }>;
      comments(id: string): Promise<CommentsResponse>;
      addComment(
        id: string,
        content: string,
        parentId?: string
      ): Promise<{ success: boolean; id: string }>;
      rate(id: string, score: number): Promise<{ success: boolean }>;
    };

    skills: {
      list(params?: SkillListParams): Promise<PaginatedResponse<SkillPackage>>;
      get(id: string): Promise<SkillPackageResponse>;
      search(
        query: string,
        params?: SkillListParams
      ): Promise<PaginatedResponse<SkillPackage>>;
      download(id: string, version?: string): Promise<Blob>;
      toggleFavorite(id: string): Promise<{ favorited: boolean }>;
      comments(id: string): Promise<CommentsResponse>;
      addComment(
        id: string,
        content: string,
        parentId?: string
      ): Promise<{ success: boolean; id: string }>;
      rate(id: string, score: number): Promise<{ success: boolean }>;
    };

    workspaces: {
      list(): Promise<WorkspacesResponse>;
      get(id: string): Promise<WorkspaceResponse>;
      create(data: {
        name: string;
        description?: string;
        isDefault?: boolean;
      }): Promise<WorkspaceResponse>;
      update(
        id: string,
        data: { name?: string; description?: string }
      ): Promise<WorkspaceResponse>;
      delete(id: string): Promise<{ success: boolean }>;
      packages(id: string): Promise<WorkspacePackagesResponse>;
      addPackage(
        workspaceId: string,
        data: {
          entityType: "mcp" | "skill";
          entityId: string;
          enabled?: boolean;
          config?: Record<string, unknown>;
        }
      ): Promise<{ success: boolean }>;
      removePackage(
        workspaceId: string,
        entityType: "mcp" | "skill",
        entityId: string
      ): Promise<{ success: boolean }>;
    };

    user: {
      me(): Promise<UserResponse>;
      update(data: {
        displayName?: string;
        bio?: string;
        websiteUrl?: string;
      }): Promise<UserResponse>;
      favorites(): Promise<FavoritesResponse>;
      profile(username: string): Promise<UserResponse>;
      apiKeys(): Promise<ApiKeysResponse>;
      createApiKey(data: {
        name: string;
        scopes?: string[];
        expiresIn?: number;
      }): Promise<CreateApiKeyResponse>;
      deleteApiKey(id: string): Promise<{ success: boolean }>;
    };

    collections: {
      list(params?: {
        page?: number;
        limit?: number;
        entityType?: "mcp" | "skill";
        userId?: string;
      }): Promise<CollectionsResponse>;
      get(id: string): Promise<{ collection: Collection; items: unknown[] }>;
      create(data: {
        name: string;
        description?: string;
        entityType: "mcp" | "skill";
        isPublic?: boolean;
      }): Promise<{ collection: Collection }>;
      update(
        id: string,
        data: { name?: string; description?: string; isPublic?: boolean }
      ): Promise<{ collection: Collection }>;
      delete(id: string): Promise<{ success: boolean }>;
      addItem(
        collectionId: string,
        entityId: string,
        note?: string
      ): Promise<{ success: boolean }>;
      removeItem(
        collectionId: string,
        entityId: string
      ): Promise<{ success: boolean }>;
      fork(id: string): Promise<{ collection: Collection }>;
    };
  }
}
