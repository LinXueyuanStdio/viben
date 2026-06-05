import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContextProvider, ContextQuery, ContextOptions, ContextResult, SessionListResult } from "../context-provider.js";

// ContextCache mock — captured at module level so tests can access the instance
let mockCacheGet = vi.fn<() => ContextResult | null>().mockReturnValue(null);
let mockCacheSet = vi.fn();

vi.mock("../context-cache.js", () => {
  const ContextCache = vi.fn().mockImplementation(function () {
    return {
      get: (...args: unknown[]) => mockCacheGet(...args as []),
      set: (...args: unknown[]) => mockCacheSet(...args as []),
    };
  });
  return { ContextCache };
});

import { ContextManager } from "../context-manager.js";

function makeProvider(name: string, available: boolean, result?: ContextResult): ContextProvider {
  const defaultResult: ContextResult = result ?? {
    markdown: `# Context from ${name}`,
    tokenEstimate: 1000,
    sessionCount: 1,
    totalTurns: 5,
    mode: "full",
    truncated: false,
    timeRange: { start: "2024-01-01T10:00:00Z", end: "2024-01-01T11:00:00Z" },
  };

  const defaultListResult: SessionListResult = {
    sessions: [],
    estimatedTokens: 0,
  };

  return {
    name,
    isAvailable: vi.fn().mockResolvedValue(available),
    listSessions: vi.fn().mockResolvedValue(defaultListResult),
    buildContext: vi.fn().mockResolvedValue(defaultResult),
  };
}

const query: ContextQuery = { repoPath: "/test/repo", type: "latest", value: "5" };

describe("ContextManager", () => {
  let manager: ContextManager;

  beforeEach(() => {
    // Reset individual mocks with defaults instead of clearAllMocks (which loses defaults)
    mockCacheGet = vi.fn<() => ContextResult | null>().mockReturnValue(null);
    mockCacheSet = vi.fn();
    manager = new ContextManager();
  });

  describe("getProvider", () => {
    it("returns null when no providers are registered", async () => {
      const result = await manager.getProvider("/some/repo");
      expect(result).toBeNull();
    });

    it("returns null when no provider is available", async () => {
      manager.register(makeProvider("entire", false));
      manager.register(makeProvider("cursor", false));

      const result = await manager.getProvider("/some/repo");
      expect(result).toBeNull();
    });

    it("returns first available provider", async () => {
      const providerA = makeProvider("entire", true);
      const providerB = makeProvider("cursor", true);
      manager.register(providerA);
      manager.register(providerB);

      const result = await manager.getProvider("/some/repo");
      expect(result).toBe(providerA);
    });

    it("skips unavailable providers and returns first available", async () => {
      const providerA = makeProvider("entire", false);
      const providerB = makeProvider("cursor", true);
      const providerC = makeProvider("zed", true);
      manager.register(providerA);
      manager.register(providerB);
      manager.register(providerC);

      const result = await manager.getProvider("/some/repo");
      expect(result).toBe(providerB);
    });
  });

  describe("listSessions", () => {
    it("returns null when no provider available", async () => {
      const result = await manager.listSessions(query);
      expect(result).toBeNull();
    });

    it("delegates to available provider", async () => {
      const expectedResult: SessionListResult = {
        sessions: [{ sessionId: "s1", checkpointId: "", sessionIndex: "", transcriptPath: "", createdAt: "", endedAt: "", branch: "", agent: "claude", turnCount: 1, filesTouched: [] }],
        estimatedTokens: 2000,
      };
      const provider = makeProvider("entire", true);
      vi.mocked(provider.listSessions).mockResolvedValue(expectedResult);
      manager.register(provider);

      const result = await manager.listSessions(query);

      expect(result).toEqual(expectedResult);
      expect(provider.listSessions).toHaveBeenCalledWith(query);
    });

    it("uses first available provider when multiple registered", async () => {
      const providerA = makeProvider("entire", false);
      const providerB = makeProvider("cursor", true);
      vi.mocked(providerB.listSessions).mockResolvedValue({
        sessions: [{ sessionId: "s1", checkpointId: "", sessionIndex: "", transcriptPath: "", createdAt: "", endedAt: "", branch: "", agent: "claude", turnCount: 1, filesTouched: [] }],
        estimatedTokens: 100,
      });
      manager.register(providerA);
      manager.register(providerB);

      const result = await manager.listSessions(query);

      expect(providerA.listSessions).not.toHaveBeenCalled();
      expect(providerB.listSessions).toHaveBeenCalledWith(query);
      expect(result?.sessions).toHaveLength(1);
    });
  });

  describe("buildContext", () => {
    it("returns null when no provider available", async () => {
      const result = await manager.buildContext(query);
      expect(result).toBeNull();
    });

    it("delegates to available provider and returns result", async () => {
      const expectedResult: ContextResult = {
        markdown: "# Context",
        tokenEstimate: 500,
        sessionCount: 1,
        totalTurns: 3,
        mode: "compact",
        truncated: false,
        timeRange: { start: "2024-01-01T00:00:00Z", end: "2024-01-01T01:00:00Z" },
      };
      const provider = makeProvider("entire", true, expectedResult);
      manager.register(provider);

      const result = await manager.buildContext(query);

      expect(result).toEqual(expectedResult);
      expect(provider.buildContext).toHaveBeenCalledWith(query, undefined);
    });

    it("passes options to provider", async () => {
      const provider = makeProvider("entire", true);
      manager.register(provider);
      const options: ContextOptions = { maxTokens: 5000, limit: 3 };

      await manager.buildContext(query, options);

      expect(provider.buildContext).toHaveBeenCalledWith(query, options);
    });

    it("uses first available provider when multiple registered", async () => {
      const providerA = makeProvider("entire", false);
      const providerB = makeProvider("cursor", true);
      manager.register(providerA);
      manager.register(providerB);

      await manager.buildContext(query);

      expect(providerA.buildContext).not.toHaveBeenCalled();
      expect(providerB.buildContext).toHaveBeenCalled();
    });

    it("returns cached result without calling provider", async () => {
      const cachedResult: ContextResult = {
        markdown: "# Cached",
        tokenEstimate: 100,
        sessionCount: 1,
        totalTurns: 2,
        mode: "full",
        truncated: false,
        timeRange: { start: "", end: "" },
      };
      mockCacheGet.mockReturnValue(cachedResult);

      const provider = makeProvider("entire", true);
      manager.register(provider);

      const result = await manager.buildContext(query);

      expect(result).toEqual(cachedResult);
      expect(provider.buildContext).not.toHaveBeenCalled();
    });

    it("stores result in cache after building", async () => {
      mockCacheGet.mockReturnValue(null);

      const provider = makeProvider("entire", true);
      manager.register(provider);

      const result = await manager.buildContext(query);

      expect(mockCacheSet).toHaveBeenCalledWith(
        query.repoPath,
        expect.any(String),
        result
      );
    });
  });

  describe("register", () => {
    it("allows registering multiple providers", async () => {
      const p1 = makeProvider("entire", false);
      const p2 = makeProvider("cursor", false);
      const p3 = makeProvider("zed", true);
      manager.register(p1);
      manager.register(p2);
      manager.register(p3);

      const provider = await manager.getProvider("/repo");
      expect(provider).toBe(p3);
    });
  });
});

describe("ContextManager — provider cascade", () => {
  function makeCascadeProvider(name: string, overrides?: Partial<ContextProvider>): ContextProvider {
    return {
      name,
      isAvailable: vi.fn().mockResolvedValue(true),
      listSessions: vi.fn().mockResolvedValue({ sessions: [], estimatedTokens: 0 }),
      buildContext: vi.fn().mockResolvedValue({ markdown: "", tokenEstimate: 0, sessionCount: 0, totalTurns: 0, mode: "full" as const, truncated: false, timeRange: { start: "", end: "" } }),
      ...overrides,
    };
  }

  const QUERY: ContextQuery = { repoPath: "/repo", type: "session", value: "s1" };

  beforeEach(() => {
    mockCacheGet = vi.fn<() => ContextResult | null>().mockReturnValue(null);
    mockCacheSet = vi.fn();
  });

  it("buildContext skips provider that returns empty markdown and tries next", async () => {
    const first = makeCascadeProvider("first"); // returns empty markdown
    const second = makeCascadeProvider("second", {
      buildContext: vi.fn().mockResolvedValue({
        markdown: "# History",
        tokenEstimate: 100,
        sessionCount: 1,
        totalTurns: 2,
        mode: "full" as const,
        truncated: false,
        timeRange: { start: "2026-01-01", end: "2026-01-02" },
      }),
    });

    const manager = new ContextManager();
    manager.register(first);
    manager.register(second);

    const result = await manager.buildContext(QUERY);
    expect(result?.markdown).toBe("# History");
    expect(second.buildContext).toHaveBeenCalled();
  });

  it("buildContext returns first non-empty result without calling later providers", async () => {
    const first = makeCascadeProvider("first", {
      buildContext: vi.fn().mockResolvedValue({
        markdown: "# First",
        tokenEstimate: 50,
        sessionCount: 1,
        totalTurns: 1,
        mode: "full" as const,
        truncated: false,
        timeRange: { start: "", end: "" },
      }),
    });
    const second = makeCascadeProvider("second");

    const manager = new ContextManager();
    manager.register(first);
    manager.register(second);

    const result = await manager.buildContext(QUERY);
    expect(result?.markdown).toBe("# First");
    expect(second.buildContext).not.toHaveBeenCalled();
  });

  it("listSessions skips provider that returns empty and tries next", async () => {
    const first = makeCascadeProvider("first"); // returns empty sessions
    const second = makeCascadeProvider("second", {
      listSessions: vi.fn().mockResolvedValue({
        sessions: [{ sessionId: "s1", checkpointId: "", sessionIndex: "", transcriptPath: "", createdAt: "", endedAt: "", branch: "", agent: "claude", turnCount: 3, filesTouched: [] }],
        estimatedTokens: 300,
      }),
    });

    const manager = new ContextManager();
    manager.register(first);
    manager.register(second);

    const result = await manager.listSessions(QUERY);
    expect(result?.sessions).toHaveLength(1);
    expect(second.listSessions).toHaveBeenCalled();
  });

  it("returns null when all providers return empty", async () => {
    const manager = new ContextManager();
    manager.register(makeCascadeProvider("only"));

    const result = await manager.buildContext(QUERY);
    expect(result).toBeNull();
  });
});
