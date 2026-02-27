import { getClient } from "@/lib/viben";

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

// Default platform URL
const PLATFORM_URL = "https://viben-web.vercel.app";

// Store API base URL in memory (localStorage fallback for persistence)
let apiBaseUrl = PLATFORM_URL;

// Try to restore from localStorage
try {
  const stored = localStorage.getItem("viben-api-base-url");
  if (stored) {
    apiBaseUrl = stored;
  }
} catch {
  // localStorage may not be available
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
  const url = `${apiBaseUrl}${options.endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.authToken) {
    headers["Authorization"] = `Bearer ${options.authToken}`;
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error || errorMessage;
    } catch {
      // Unable to parse error body
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Get the current API base URL
 *
 * @returns Promise resolving to the base URL string
 */
export async function getApiBaseUrl(): Promise<string> {
  return apiBaseUrl;
}

/**
 * Set the API base URL
 *
 * @param url - New base URL (e.g., "https://viben-web.vercel.app")
 * @throws Error if URL format is invalid
 */
export async function setApiBaseUrl(url: string): Promise<void> {
  // Validate URL format
  try {
    new URL(url);
  } catch {
    throw new Error("Invalid URL format");
  }

  apiBaseUrl = url.replace(/\/$/, ""); // Remove trailing slash

  // Persist to localStorage
  try {
    localStorage.setItem("viben-api-base-url", apiBaseUrl);
  } catch {
    // localStorage may not be available
  }
}

/**
 * Reset API base URL to default
 */
export function resetApiBaseUrl(): void {
  apiBaseUrl = PLATFORM_URL;
  try {
    localStorage.removeItem("viben-api-base-url");
  } catch {
    // localStorage may not be available
  }
}

// Re-export getClient for convenience
export { getClient };
