import { invoke } from "@tauri-apps/api/core";

/**
 * Options for making an API request
 */
export interface ApiRequestOptions {
  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** API endpoint path (e.g., "/api/mcp") */
  endpoint: string;
  /** Optional request body (will be JSON serialized) */
  body?: unknown;
  /** Optional Bearer token for authentication */
  authToken?: string;
}

/**
 * Standard paginated response from the platform API
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
 * Make an API request to the platform
 *
 * @param options - Request configuration
 * @returns Promise resolving to the response data
 * @throws Error if the request fails
 *
 * @example
 * ```ts
 * // GET request
 * const data = await apiRequest<McpPackage[]>({
 *   method: "GET",
 *   endpoint: "/api/mcp",
 * });
 *
 * // POST request with auth
 * const result = await apiRequest<CreateResult>({
 *   method: "POST",
 *   endpoint: "/api/mcp",
 *   body: { name: "my-package" },
 *   authToken: "xxx",
 * });
 * ```
 */
export async function apiRequest<T>(options: ApiRequestOptions): Promise<T> {
  return invoke<T>("api_request", {
    method: options.method,
    endpoint: options.endpoint,
    body: options.body ?? null,
    authToken: options.authToken ?? null,
  });
}

/**
 * Get the current API base URL
 *
 * @returns Promise resolving to the base URL string
 */
export async function getApiBaseUrl(): Promise<string> {
  return invoke<string>("get_api_base_url");
}

/**
 * Set the API base URL
 *
 * @param url - New base URL (e.g., "https://viben-web.vercel.app")
 * @throws Error if URL format is invalid
 */
export async function setApiBaseUrl(url: string): Promise<void> {
  return invoke<void>("set_api_base_url", { url });
}
