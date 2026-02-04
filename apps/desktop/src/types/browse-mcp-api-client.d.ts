/**
 * Temporary type declarations for @browse-mcp/api-client
 *
 * This module will be provided by the Browse MCP platform SDK when it's ready.
 * For now, we declare the types needed by the desktop app.
 */

declare module "@browse-mcp/api-client" {
  export interface McpPackage {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    version: string;
    author: {
      id: string;
      username: string;
      displayName: string;
    };
    repositoryUrl: string | null;
    category: string;
    tags: string[];
    downloadsCount: number;
    ratingAvg: number;
    ratingCount: number;
    createdAt: string;
    updatedAt: string;
  }

  export interface SkillPackage {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    version: string;
    author: {
      id: string;
      username: string;
      displayName: string;
    };
    repositoryUrl: string | null;
    skillType: string;
    triggerPatterns: string[];
    tags: string[];
    downloadsCount: number;
    ratingAvg: number;
    ratingCount: number;
    createdAt: string;
    updatedAt: string;
  }

  export interface Workspace {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    mcpCount: number;
    skillCount: number;
    createdAt: string;
    updatedAt: string;
  }

  export interface PaginatedResponse<T> {
    packages: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  export interface User {
    id: string;
    username: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
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

  export class BrowseMcpClient {
    constructor(config: { baseUrl: string; apiKey?: string; timeout?: number });

    setApiKey(apiKey: string | undefined): void;
    getApiKey(): string | undefined;

    mcp: {
      list(params?: {
        page?: number;
        limit?: number;
        category?: string;
        sort?: string;
      }): Promise<PaginatedResponse<McpPackage>>;
      get(id: string): Promise<{ mcp: McpPackage }>;
      search(query: string): Promise<PaginatedResponse<McpPackage>>;
      toggleFavorite(id: string): Promise<{ favorited: boolean }>;
      download(id: string): Promise<Blob>;
    };

    skills: {
      list(params?: {
        page?: number;
        limit?: number;
        skillType?: string;
        sort?: string;
      }): Promise<PaginatedResponse<SkillPackage>>;
      get(id: string): Promise<{ skill: SkillPackage }>;
      search(query: string): Promise<PaginatedResponse<SkillPackage>>;
      toggleFavorite(id: string): Promise<{ favorited: boolean }>;
      download(id: string): Promise<Blob>;
    };

    workspaces: {
      list(): Promise<{ workspaces: Workspace[] }>;
      get(id: string): Promise<{ workspace: Workspace }>;
      sync(id: string): Promise<{
        mcps: McpPackage[];
        skills: SkillPackage[];
      }>;
      packages(id: string): Promise<WorkspacePackagesResponse>;
    };

    user: {
      me(): Promise<{ user: User }>;
    };
  }
}
