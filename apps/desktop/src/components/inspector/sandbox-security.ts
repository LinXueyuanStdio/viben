/**
 * Sandbox Security Utilities
 *
 * Provides utilities for verifying iframe sandbox security and
 * handling bidirectional communication with sandboxed apps.
 */

/**
 * Results from security self-test performed by sandbox proxy
 */
export interface SandboxSecurityResult {
  /** Whether all security tests passed */
  passed: boolean;
  /** Individual test results */
  tests: {
    /** True if parent window was accessible (bad) */
    parentAccess: boolean;
    /** True if cookies were accessible (bad) */
    cookieAccess: boolean;
    /** True if localStorage was accessible (bad) */
    localStorageAccess: boolean;
  };
}

/**
 * Messages sent from Inspector to Sandbox
 */
export type InspectorToSandboxMessage =
  | { type: "mcp-sandbox-init"; appUrl: string }
  | { type: "mcp-ui-init"; toolInput?: Record<string, unknown>; toolResult?: unknown }
  | { type: "mcp-ui-tool-call"; name: string; arguments?: Record<string, unknown> };

/**
 * Messages sent from Sandbox to Inspector
 */
export type SandboxToInspectorMessage =
  | { type: "mcp-sandbox-ready" }
  | { type: "mcp-sandbox-security-result"; results: SandboxSecurityResult }
  | { type: "mcp-sandbox-app-loaded"; url: string }
  | { type: "mcp-sandbox-app-error"; error: string }
  | { type: "mcp-ui-result"; result: unknown }
  | { type: "mcp-ui-error"; error: string };

/**
 * Validate message origin against allowed origins
 *
 * @param origin - The origin from the message event
 * @param allowedOrigins - List of allowed origins
 * @returns true if origin is allowed
 */
export function isAllowedOrigin(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.some((allowed) => {
    // Exact match
    if (allowed === origin) return true;

    // Wildcard matching for localhost
    if (allowed === "localhost:*" && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
      return true;
    }

    // Wildcard matching for 127.0.0.1
    if (allowed === "127.0.0.1:*" && /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return true;
    }

    return false;
  });
}

/**
 * Default allowed origins for sandbox communication
 */
export const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "localhost:*",
  "127.0.0.1:*",
  "null", // For sandboxed iframes without allow-same-origin
];

/**
 * Get the sandbox proxy URL for the current environment
 */
export function getSandboxProxyUrl(): string {
  // In development, use the Vite dev server URL
  // In production (Tauri), use the tauri asset protocol
  if (typeof window !== "undefined") {
    const base = window.location.origin;
    return `${base}/sandbox-proxy.html`;
  }
  return "/sandbox-proxy.html";
}

/**
 * Type guard for sandbox messages
 */
export function isSandboxMessage(data: unknown): data is SandboxToInspectorMessage {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  return typeof msg.type === "string" && msg.type.startsWith("mcp-sandbox-");
}

/**
 * Type guard for app messages (from the inner app iframe)
 */
export function isAppMessage(data: unknown): data is { type: string; [key: string]: unknown } {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  return typeof msg.type === "string" && msg.type.startsWith("mcp-ui-");
}

/**
 * Format security test results for display
 */
export function formatSecurityResults(results: SandboxSecurityResult): string {
  const { passed, tests } = results;

  if (passed) {
    return "Security check passed: App is properly isolated";
  }

  const failures: string[] = [];

  if (tests.parentAccess) {
    failures.push("Parent window accessible");
  }

  if (tests.cookieAccess) {
    failures.push("Cookies accessible");
  }

  if (tests.localStorageAccess) {
    failures.push("LocalStorage accessible");
  }

  return `Security check failed: ${failures.join(", ")}`;
}

/**
 * Calculate overall security score (0-100)
 */
export function calculateSecurityScore(results: SandboxSecurityResult): number {
  const { tests } = results;
  let score = 100;

  // Each failure reduces score
  if (tests.parentAccess) score -= 50;
  if (tests.cookieAccess) score -= 25;
  if (tests.localStorageAccess) score -= 25;

  return Math.max(0, score);
}
