/**
 * Fetch mock utilities for tests
 */
import { vi } from "vitest";

export type FetchMock = ReturnType<typeof vi.fn<typeof fetch>>;

/**
 * Create a typed fetch mock
 */
export function createFetchMock(): FetchMock {
  return vi.fn<typeof fetch>();
}

/**
 * Install fetch mock globally
 * Returns cleanup function
 */
export function installFetchMock(mock?: FetchMock): {
  mock: FetchMock;
  cleanup: () => void;
} {
  const originalFetch = globalThis.fetch;
  const fetchMock = mock ?? createFetchMock();

  vi.stubGlobal("fetch", fetchMock);

  return {
    mock: fetchMock,
    cleanup: () => {
      vi.stubGlobal("fetch", originalFetch);
    },
  };
}

/**
 * Create a mock Response
 */
export function mockResponse(
  body: unknown,
  init?: ResponseInit
): Response {
  const jsonBody = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(jsonBody, {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/**
 * Create a mock JSON response helper for fetch mock
 */
export function jsonResponse(data: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

/**
 * Create mock fetch that returns JSON
 */
export function mockFetchJson(data: unknown, status = 200): FetchMock {
  const mock = createFetchMock();
  mock.mockResolvedValue(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
  return mock;
}
