/**
 * HTTP proxy utilities
 * Provides proxy-aware fetch for Node.js environments
 *
 * Copy of packages/core/src/http/proxy.ts — kept in sync manually.
 * api-client uses this for self-contained HTTP communication;
 * core retains its own copy for internal use.
 *
 * NOTE: undici is imported dynamically to avoid breaking browser
 * environments (e.g. Vite dev server). In Node.js, ProxyAgent is
 * lazily loaded only when a proxy URL is configured.
 */

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

// Lazy-loaded undici module — only loaded in Node.js when a proxy is configured
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _undiciModule: any = null;

async function _loadUndici() {
  if (_undiciModule) return _undiciModule;
  _undiciModule = await import("undici");
  return _undiciModule;
}

/**
 * Create a proxy-aware fetch function
 * Respects http_proxy/https_proxy/HTTPS_PROXY/HTTP_PROXY environment variables
 *
 * @returns A fetch function that routes through the proxy if configured
 *
 * @example
 * ```ts
 * const proxyFetch = await createProxyFetch();
 * const response = await proxyFetch('https://api.example.com/data');
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createProxyFetch(): Promise<(input: any, init?: any) => Promise<Response>> {
  const proxyUrl = getProxyUrl();

  if (proxyUrl) {
    const { ProxyAgent, fetch: undiciFetch } = await _loadUndici();
    const dispatcher = new ProxyAgent(proxyUrl) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((url: any, init?: any) =>
      undiciFetch(url, { ...init, dispatcher })) as unknown as typeof fetch;
  }

  return fetch;
}

// Lazy proxy-fetch singleton — initialized on first use
let _proxyFetchPromise: Promise<typeof fetch> | null = null;

function _getOrInitProxyFetch(): Promise<typeof fetch> {
  if (!_proxyFetchPromise) {
    _proxyFetchPromise = createProxyFetch();
  }
  return _proxyFetchPromise;
}

/**
 * Proxy-aware fetch instance
 * Use this directly for simple cases. Lazy-initialized: no undici
 * import occurs until the first call.
 *
 * @example
 * ```ts
 * import { proxyFetch } from '@viben/api-client/proxy-fetch';
 * const response = await proxyFetch('https://api.example.com/data');
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const proxyFetch = (input: any, init?: any): Promise<Response> => {
  return _getOrInitProxyFetch().then((fetcher) => fetcher(input, init));
};
