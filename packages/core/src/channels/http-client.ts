/**
 * HTTP Client with Proxy Support
 *
 * Provides fetch-like API with automatic system proxy detection.
 * Uses undici's ProxyAgent to support HTTP_PROXY/HTTPS_PROXY environment variables.
 */

import { ProxyAgent, fetch as undiciFetch, type RequestInit } from "undici";

/**
 * Get proxy URL from environment variables
 */
function getProxyUrl(): string | undefined {
  // Check common proxy environment variables (case-insensitive)
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy
  );
}

/**
 * Check if a URL should bypass the proxy
 */
function shouldBypassProxy(url: string): boolean {
  const noProxy = process.env.NO_PROXY || process.env.no_proxy;
  if (!noProxy) return false;

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // Check each entry in NO_PROXY
    const entries = noProxy.split(",").map((e) => e.trim().toLowerCase());
    for (const entry of entries) {
      if (!entry) continue;

      // Handle wildcard
      if (entry === "*") return true;

      // Handle domain suffix (e.g., .example.com)
      if (entry.startsWith(".") && hostname.endsWith(entry)) return true;

      // Handle exact match
      if (hostname === entry) return true;

      // Handle suffix match without dot
      if (hostname.endsWith(`.${entry}`)) return true;
    }
  } catch {
    // Invalid URL, don't bypass
  }

  return false;
}

// Cached proxy agent
let cachedProxyAgent: ProxyAgent | null = null;
let cachedProxyUrl: string | undefined;

/**
 * Get or create proxy agent
 */
function getProxyAgent(): ProxyAgent | undefined {
  const proxyUrl = getProxyUrl();

  if (!proxyUrl) {
    cachedProxyAgent = null;
    cachedProxyUrl = undefined;
    return undefined;
  }

  // Reuse cached agent if proxy URL hasn't changed
  if (cachedProxyAgent && cachedProxyUrl === proxyUrl) {
    return cachedProxyAgent;
  }

  // Create new proxy agent
  cachedProxyAgent = new ProxyAgent(proxyUrl);
  cachedProxyUrl = proxyUrl;

  return cachedProxyAgent;
}

/**
 * Fetch with automatic proxy support
 *
 * This function automatically uses the system proxy (HTTP_PROXY/HTTPS_PROXY)
 * if configured. It respects NO_PROXY for bypassing specific hosts.
 *
 * @param url - The URL to fetch
 * @param init - Request options (same as fetch)
 * @returns Response object
 */
export async function fetchWithProxy(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  const urlString = url.toString();

  // Check if we should use proxy
  const proxyAgent = shouldBypassProxy(urlString) ? undefined : getProxyAgent();

  // Use undici fetch with dispatcher
  const response = await undiciFetch(url, {
    ...init,
    dispatcher: proxyAgent,
  } as RequestInit);

  // Convert undici Response to standard Response for compatibility
  return response as unknown as Response;
}

/**
 * Check if proxy is configured
 */
export function isProxyConfigured(): boolean {
  return !!getProxyUrl();
}

/**
 * Get current proxy URL (for debugging/display)
 */
export function getCurrentProxyUrl(): string | undefined {
  return getProxyUrl();
}
