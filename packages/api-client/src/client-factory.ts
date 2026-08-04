/**
 * Client factory — "batteries included" VibenClient creation
 *
 * Reads token from env/file, resolves web URL, configures proxyFetch.
 * This is the recommended entry point for desktop apps and CLI commands.
 */
import { VibenClient } from "./client";
import type { VibenClientConfig } from "./client";
import { getWebUrl } from "./utils/config";
import { proxyFetch } from "./proxy-fetch";

/**
 * Create a pre-configured VibenClient
 *
 * - Reads API key from VIBEN_TOKEN env or ~/.viben/token
 * - Resolves base URL from VIBEN_WEB_URL env or default
 * - Uses proxy-aware fetch (respects http_proxy/https_proxy env vars)
 * - Override any setting via options
 *
 * @example
 * ```ts
 * // Production — auto-configured
 * const client = createClient();
 *
 * // With overrides
 * const client = createClient({ timeout: 60000 });
 * ```
 */
export function createClient(options?: Partial<VibenClientConfig>): VibenClient {
  return new VibenClient({
    baseUrl: options?.baseUrl ?? getWebUrl(),
    apiKey: options?.apiKey,
    timeout: options?.timeout,
    fetch: options?.fetch ?? proxyFetch,
  });
}

/**
 * Create an authenticated VibenClient by reading the stored token.
 * Returns null if no token is available (user not logged in).
 *
 * Uses dynamic import for readToken to avoid bundling Node.js built-ins
 * (fs, os, path) in browser environments.
 *
 * @example
 * ```ts
 * const client = await createAuthenticatedClient();
 * if (!client) {
 *   console.error("Not logged in. Run: viben auth login");
 *   process.exit(1);
 * }
 * ```
 */
export async function createAuthenticatedClient(
  options?: Partial<VibenClientConfig>
): Promise<VibenClient | null> {
  // Priority: explicit apiKey from options → stored token → null
  let token: string | null | undefined = options?.apiKey;

  if (!token) {
    // Dynamic import — token.ts uses Node.js fs/path/os, which
    // are unavailable in browser/Tauri webview environments.
    const { readToken } = await import("./utils/token");
    token = await readToken();
  }

  if (!token) return null;

  return new VibenClient({
    baseUrl: options?.baseUrl ?? getWebUrl(),
    apiKey: token,
    timeout: options?.timeout,
    fetch: options?.fetch ?? proxyFetch,
  });
}
