/**
 * Viben API Client
 *
 * A client library for interacting with the Viben platform API.
 * Works in both browser and Node.js environments.
 */

import type {
  ListParams,
  SkillListParams,
  PaginatedResponse,
  McpPackage,
  McpPackageResponse,
  SkillPackage,
  SkillPackageResponse,
  User,
  UserResponse,
  FavoritesResponse,
  Collection,
  CollectionsResponse,
  CommentsResponse,
  ApiKeysResponse,
  CreateApiKeyResponse,
  LoginCredentials,
  AuthResponse,
  UserSession,
  TokenValidationResponse,
  OAuthProvider,
  OAuthUrlOptions,
  VoiceTokenRequest,
  VoiceTokenResponse,
  PublishPageRequest,
  PublishPageResponse,
} from './types';

/**
 * Custom fetch function type
 */
export type FetchFunction = typeof fetch;

/**
 * Configuration options for the API client
 */
export interface VibenClientConfig {
  /** Base URL of the API (e.g., "https://viben-web.vercel.app") */
  baseUrl: string;
  /** API key for authentication (optional for public endpoints) */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom fetch function (e.g., proxy-aware fetch) */
  fetch?: FetchFunction;
}

/**
 * API error with status code
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Build query string from parameters
 */
function buildQuery(params?: ListParams | SkillListParams): string {
  if (!params) return '';

  const query = new URLSearchParams();

  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.sort) query.set('sort', params.sort);
  if (params.category) query.set('category', params.category);

  // Skill-specific parameters
  if ('type' in params && params.type) {
    query.set('type', params.type);
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Viben API Client
 *
 * @example
 * ```ts
 * const client = new VibenClient({
 *   baseUrl: 'https://viben-web.vercel.app',
 *   apiKey: 'viben_xxx...',
 * });
 *
 * // List MCP packages
 * const { packages, pagination } = await client.mcp.list({ page: 1, limit: 10 });
 *
 * // Search skills
 * const results = await client.skill.search('git', { type: 'command' });
 *
 * // Get current user
 * const { user } = await client.user.me();
 * ```
 */
export class VibenClient {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;
  private fetchFn: FetchFunction;

  constructor(config: VibenClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
    // Use bound fetch to preserve window context (required for Tauri/browser environments)
    // Direct `fetch` reference loses `this` binding and causes "Can only call Window.fetch on instances of Window"
    this.fetchFn = config.fetch || ((...args) => fetch(...args));
  }

  /**
   * Set API key for authentication
   */
  setApiKey(apiKey: string | undefined): void {
    this.apiKey = apiKey;
  }

  /**
   * Get the current API key
   */
  getApiKey(): string | undefined {
    return this.apiKey;
  }

  /**
   * Make an authenticated request to the API
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        let details: unknown;

        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error || errorMessage;
          details = errorBody.details;
        } catch {
          // Unable to parse error body
        }

        throw new ApiError(errorMessage, response.status, details);
      }

      return response.json();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Request timeout', 408);
        }
        throw new ApiError(error.message, 0);
      }

      throw new ApiError('Unknown error', 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Download a file from the API
   */
  private async downloadFile(path: string): Promise<Blob> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {};

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await this.fetchFn(url, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ApiError(
          `Download failed: HTTP ${response.status}`,
          response.status
        );
      }

      return response.blob();
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new ApiError('Download timeout', 408);
        }
        throw new ApiError(error.message, 0);
      }

      throw new ApiError('Download failed', 0);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // ============================================
  // MCP Packages API
  // ============================================

  /**
   * MCP package endpoints
   */
  mcp = {
    /**
     * List MCP packages
     */
    list: async (params?: ListParams): Promise<PaginatedResponse<McpPackage>> => {
      const response = await this.request<{ packages: McpPackage[]; pagination: PaginatedResponse<McpPackage>['pagination'] }>(
        `/api/mcp${buildQuery(params)}`
      );
      return { data: response.packages, pagination: response.pagination };
    },

    /**
     * Get a specific MCP package by ID
     */
    get: (id: string): Promise<McpPackageResponse> =>
      this.request<McpPackageResponse>(`/api/mcp/${id}`),

    /**
     * Search MCP packages
     */
    search: async (
      query: string,
      params?: ListParams
    ): Promise<PaginatedResponse<McpPackage>> => {
      const response = await this.request<{ packages: McpPackage[]; pagination: PaginatedResponse<McpPackage>['pagination'] }>(
        `/api/mcp/search?q=${encodeURIComponent(query)}${buildQuery(params).replace('?', '&')}`
      );
      return { data: response.packages, pagination: response.pagination };
    },

    /**
     * Download MCP package
     * @returns Blob containing the package archive
     */
    download: (id: string, version?: string): Promise<Blob> =>
      this.downloadFile(
        `/api/packages/mcp/${id}/download${version ? `?version=${encodeURIComponent(version)}` : ''}`
      ),

    /**
     * Toggle favorite on MCP package
     */
    toggleFavorite: (id: string): Promise<{ favorited: boolean }> =>
      this.request<{ favorited: boolean }>(`/api/mcp/${id}/favorite`, {
        method: 'POST',
      }),

    /**
     * Get comments on MCP package
     */
    comments: (id: string): Promise<CommentsResponse> =>
      this.request<CommentsResponse>(`/api/mcp/${id}/comments`),

    /**
     * Add comment to MCP package
     */
    addComment: (
      id: string,
      content: string,
      parentId?: string
    ): Promise<{ success: boolean; id: string }> =>
      this.request<{ success: boolean; id: string }>(`/api/mcp/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, parentId }),
      }),

    /**
     * Rate MCP package (1-5)
     */
    rate: (id: string, score: number): Promise<{ success: boolean }> =>
      this.request<{ success: boolean }>(`/api/mcp/${id}/rating`, {
        method: 'POST',
        body: JSON.stringify({ score }),
      }),
  };

  // ============================================
  // Skills API
  // ============================================

  /**
   * Skills package endpoints
   */
  skill = {
    /**
     * List skill packages
     */
    list: async (params?: SkillListParams): Promise<PaginatedResponse<SkillPackage>> => {
      const response = await this.request<{ packages: SkillPackage[]; pagination: PaginatedResponse<SkillPackage>['pagination'] }>(
        `/api/skill${buildQuery(params)}`
      );
      return { data: response.packages, pagination: response.pagination };
    },

    /**
     * Get a specific skill package by ID
     */
    get: (id: string): Promise<SkillPackageResponse> =>
      this.request<SkillPackageResponse>(`/api/skill/${id}`),

    /**
     * Search skill packages
     */
    search: async (
      query: string,
      params?: SkillListParams
    ): Promise<PaginatedResponse<SkillPackage>> => {
      const response = await this.request<{ packages: SkillPackage[]; pagination: PaginatedResponse<SkillPackage>['pagination'] }>(
        `/api/skill/search?q=${encodeURIComponent(query)}${buildQuery(params).replace('?', '&')}`
      );
      return { data: response.packages, pagination: response.pagination };
    },

    /**
     * Download skill package
     * @returns Blob containing the package archive
     */
    download: (id: string, version?: string): Promise<Blob> =>
      this.downloadFile(
        `/api/packages/skill/${id}/download${version ? `?version=${encodeURIComponent(version)}` : ''}`
      ),

    /**
     * Toggle favorite on skill package
     */
    toggleFavorite: (id: string): Promise<{ favorited: boolean }> =>
      this.request<{ favorited: boolean }>(`/api/skill/${id}/favorite`, {
        method: 'POST',
      }),

    /**
     * Get comments on skill package
     */
    comments: (id: string): Promise<CommentsResponse> =>
      this.request<CommentsResponse>(`/api/skill/${id}/comments`),

    /**
     * Add comment to skill package
     */
    addComment: (
      id: string,
      content: string,
      parentId?: string
    ): Promise<{ success: boolean; id: string }> =>
      this.request<{ success: boolean; id: string }>(`/api/skill/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content, parentId }),
      }),

    /**
     * Rate skill package (1-5)
     */
    rate: (id: string, score: number): Promise<{ success: boolean }> =>
      this.request<{ success: boolean }>(`/api/skill/${id}/rating`, {
        method: 'POST',
        body: JSON.stringify({ score }),
      }),
  };

  // ============================================
  // User API
  // ============================================

  /**
   * User endpoints
   */
  user = {
    /**
     * Get current authenticated user
     */
    me: (): Promise<UserResponse> =>
      this.request<UserResponse>('/api/users/me'),

    /**
     * Update current user profile
     */
    update: (data: {
      displayName?: string;
      bio?: string;
      websiteUrl?: string;
    }): Promise<UserResponse> =>
      this.request<UserResponse>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    /**
     * Get user's favorites
     */
    favorites: (): Promise<FavoritesResponse> =>
      this.request<FavoritesResponse>('/api/users/me/favorites'),

    /**
     * Get public profile by username
     */
    profile: (username: string): Promise<UserResponse> =>
      this.request<UserResponse>(`/api/users/${username}`),

    /**
     * List API keys
     */
    apiKeys: (): Promise<ApiKeysResponse> =>
      this.request<ApiKeysResponse>('/api/users/me/api-keys'),

    /**
     * Create a new API key
     */
    createApiKey: (data: {
      name: string;
      scopes?: string[];
      expiresIn?: number;
    }): Promise<CreateApiKeyResponse> =>
      this.request<CreateApiKeyResponse>('/api/users/me/api-keys', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    /**
     * Delete an API key
     */
    deleteApiKey: (id: string): Promise<{ success: boolean }> =>
      this.request<{ success: boolean }>(`/api/users/me/api-keys/${id}`, {
        method: 'DELETE',
      }),
  };

  // ============================================
  // Pages API
  // ============================================

  pages = {
    /**
     * Publish a static page HTML document.
     */
    publish: (data: PublishPageRequest): Promise<PublishPageResponse> =>
      this.request<PublishPageResponse>('/api/pages/publish', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // ============================================
  // Collections API
  // ============================================

  /**
   * Collection endpoints
   */
  collections = {
    /**
     * List collections
     */
    list: (params?: {
      page?: number;
      limit?: number;
      entityType?: 'mcp' | 'skill';
      userId?: string;
    }): Promise<CollectionsResponse> => {
      const query = new URLSearchParams();
      if (params?.page) query.set('page', String(params.page));
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.entityType) query.set('entityType', params.entityType);
      if (params?.userId) query.set('userId', params.userId);
      const queryString = query.toString();
      return this.request<CollectionsResponse>(
        `/api/collections${queryString ? `?${queryString}` : ''}`
      );
    },

    /**
     * Get a specific collection
     */
    get: (id: string): Promise<{ collection: Collection; items: unknown[] }> =>
      this.request<{ collection: Collection; items: unknown[] }>(
        `/api/collections/${id}`
      ),

    /**
     * Create a new collection
     */
    create: (data: {
      name: string;
      description?: string;
      entityType: 'mcp' | 'skill';
      isPublic?: boolean;
    }): Promise<{ collection: Collection }> =>
      this.request<{ collection: Collection }>('/api/collections', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    /**
     * Update a collection
     */
    update: (
      id: string,
      data: { name?: string; description?: string; isPublic?: boolean }
    ): Promise<{ collection: Collection }> =>
      this.request<{ collection: Collection }>(`/api/collections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    /**
     * Delete a collection
     */
    delete: (id: string): Promise<{ success: boolean }> =>
      this.request<{ success: boolean }>(`/api/collections/${id}`, {
        method: 'DELETE',
      }),

    /**
     * Add item to collection
     */
    addItem: (
      collectionId: string,
      entityId: string,
      note?: string
    ): Promise<{ success: boolean }> =>
      this.request<{ success: boolean }>(`/api/collections/${collectionId}/items`, {
        method: 'POST',
        body: JSON.stringify({ entityId, note }),
      }),

    /**
     * Remove item from collection
     */
    removeItem: (
      collectionId: string,
      entityId: string
    ): Promise<{ success: boolean }> =>
      this.request<{ success: boolean }>(
        `/api/collections/${collectionId}/items/${entityId}`,
        {
          method: 'DELETE',
        }
      ),

    /**
     * Fork a collection
     */
    fork: (id: string): Promise<{ collection: Collection }> =>
      this.request<{ collection: Collection }>(`/api/collections/${id}/fork`, {
        method: 'POST',
      }),
  };

  // ============================================
  // Authentication API
  // ============================================

  /**
   * Authentication endpoints
   *
   * @example
   * ```ts
   * // Login with email/password
   * const session = await client.auth.login({ email, password });
   *
   * // Get GitHub OAuth URL
   * const url = client.auth.getOAuthUrl('github', { redirectUri: 'viben://oauth' });
   *
   * // Handle OAuth callback
   * const session = await client.auth.handleOAuthCallback('github', code);
   *
   * // Refresh token
   * const newSession = await client.auth.refresh(refreshToken);
   *
   * // Validate current token
   * const { valid, user } = await client.auth.validate();
   * ```
   */
  auth = {
    /**
     * Login with email and password
     */
    login: async (credentials: LoginCredentials): Promise<UserSession> => {
      const response = await this.request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      return this.authResponseToSession(response);
    },

    /**
     * Get OAuth authorization URL for a provider
     * Opens this URL in browser to start OAuth flow
     */
    getOAuthUrl: (provider: OAuthProvider, options: OAuthUrlOptions): string => {
      const params = new URLSearchParams();
      params.set('redirect_uri', options.redirectUri);
      if (options.client) params.set('client', options.client);
      if (options.state) params.set('state', options.state);
      return `${this.baseUrl}/api/auth/${provider}?${params.toString()}`;
    },

    /**
     * Handle OAuth callback with authorization code
     */
    handleOAuthCallback: async (
      provider: OAuthProvider,
      code: string
    ): Promise<UserSession> => {
      const response = await this.request<AuthResponse>(
        `/api/auth/callback/${provider}`,
        {
          method: 'POST',
          body: JSON.stringify({ code }),
        }
      );
      return this.authResponseToSession(response);
    },

    /**
     * Refresh access token using refresh token
     */
    refresh: async (refreshToken: string): Promise<UserSession> => {
      const response = await this.request<AuthResponse>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
      return this.authResponseToSession(response);
    },

    /**
     * Validate current access token
     * Returns user info if valid
     */
    validate: async (): Promise<TokenValidationResponse> => {
      try {
        const { user } = await this.request<UserResponse>('/api/users/me');
        return { valid: true, user };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return { valid: false };
        }
        throw error;
      }
    },

    /**
     * Logout (invalidate session on server)
     */
    logout: async (): Promise<void> => {
      try {
        await this.request<{ success: boolean }>('/api/auth/logout', {
          method: 'POST',
        });
      } catch {
        // Ignore logout errors - session may already be invalid
      }
    },
  };

  /**
   * Set access token for authentication
   * Use this after login/OAuth to authenticate subsequent requests
   */
  setAccessToken(token: string | undefined): void {
    this.apiKey = token;
  }

  /**
   * Get the current access token
   */
  getAccessToken(): string | undefined {
    return this.apiKey;
  }

  /**
   * Convert auth response to user session
   */
  private authResponseToSession(response: AuthResponse): UserSession {
    return {
      id: response.user.id,
      email: response.user.email,
      username: response.user.username,
      displayName: response.user.displayName,
      avatarUrl: response.user.avatarUrl,
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: response.expiresAt,
    };
  }

  // ============================================
  // Voice API
  // ============================================

  /**
   * Voice endpoints for Vocal Bridge integration
   */
  voice = {
    /**
     * Get voice token for LiveKit connection
     * Proxies through viben-web to bypass CORS
     */
    getToken: (request: VoiceTokenRequest): Promise<VoiceTokenResponse> =>
      this.request<VoiceTokenResponse>('/api/voice-token', {
        method: 'POST',
        body: JSON.stringify(request),
      }),
  };
}
