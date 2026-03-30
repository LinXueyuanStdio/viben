/**
 * HTTP proxy utilities
 * Provides proxy-aware fetch for Node.js environments
 */
import { ProxyAgent, fetch as undiciFetch } from "undici";

/**
 * Get the proxy URL from environment variables
 * Checks: https_proxy, HTTPS_PROXY, http_proxy, HTTP_PROXY
 */
export function getProxyUrl(): string | undefined {
  return (
    process.env.https_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.http_proxy ||
    process.env.HTTP_PROXY
  );
}

/**
 * Check if a proxy is configured
 */
export function hasProxy(): boolean {
  return !!getProxyUrl();
}

/**
 * Create a proxy-aware fetch function
 * Respects http_proxy/https_proxy/HTTPS_PROXY/HTTP_PROXY environment variables
 *
 * @returns A fetch function that routes through the proxy if configured
 *
 * @example
 * ```ts
 * const proxyFetch = createProxyFetch();
 * const response = await proxyFetch('https://api.example.com/data');
 * ```
 */
export function createProxyFetch(): typeof fetch {
  const proxyUrl = getProxyUrl();

  if (proxyUrl) {
    const dispatcher = new ProxyAgent(proxyUrl);
    return ((url: string | URL | Request, init?: RequestInit) =>
      undiciFetch(url, { ...init, dispatcher } as Parameters<
        typeof undiciFetch
      >[1])) as typeof fetch;
  }

  return fetch;
}

/**
 * Proxy-aware fetch instance
 * Use this directly for simple cases
 *
 * @example
 * ```ts
 * import { proxyFetch } from '@viben/core/http';
 * const response = await proxyFetch('https://api.example.com/data');
 * ```
 */
export const proxyFetch = createProxyFetch();
