/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useClawhubRegistry,
  useClawhubRegistrySearch,
  useClawhubRegistrySkills,
} from "./use-clawhub-registry";
import { getGatewayClient } from "@/lib/gateway";
import type {
  ClawhubPackageItem,
  ClawhubSkillSortOption,
} from "@/types/clawhub-registry";

vi.mock("@/lib/gateway", () => ({
  getGatewayClient: vi.fn(),
}));

interface SortHookProps {
  sort: ClawhubSkillSortOption;
}

function createPackageItem(displayName: string): ClawhubPackageItem {
  return {
    name: displayName.toLowerCase().replace(/\s+/g, "-"),
    displayName,
    summary: "A sorted skill",
    family: "skill",
    channel: "community",
    isOfficial: false,
    executesCode: false,
    ownerHandle: "tester",
    latestVersion: "1.0.0",
    createdAt: 1,
    updatedAt: 2,
    stats: {
      downloads: 12,
      stars: 3,
    },
  };
}

function createPackageResponse(displayName: string) {
  return {
    items: [createPackageItem(displayName)],
    nextCursor: null,
  };
}

function createSearchResponse(displayName: string) {
  return {
    results: [
      {
        slug: displayName.toLowerCase().replace(/\s+/g, "-"),
        displayName,
        summary: "A search skill",
        version: "1.0.0",
        updatedAt: 2,
        ownerHandle: "tester",
        owner: {
          handle: "tester",
          displayName: "Tester",
          image: null,
        },
      },
    ],
  };
}

function mockGatewayPackageList() {
  const get = vi.fn(async () => createPackageResponse("Sorted Skill"));

  vi.mocked(getGatewayClient).mockReturnValue({
    get,
  } as unknown as ReturnType<typeof getGatewayClient>);

  return get;
}

function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

function getLastGatewayPath(getMock: ReturnType<typeof vi.fn>): URL {
  const lastCall = getMock.mock.calls.at(-1);
  expect(lastCall).toBeDefined();

  return new URL(String(lastCall?.[0]), "http://127.0.0.1");
}

describe("useClawhubRegistrySkills", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends requested sort to Gateway ClaWHub package listing and maps skills", async () => {
    const getMock = mockGatewayPackageList();

    const { result } = renderHook(() =>
      useClawhubRegistrySkills({ limit: 24, enabled: true, sort: "downloads" })
    );

    await waitFor(() => {
      expect(result.current.skills[0]?.name).toBe("Sorted Skill");
    });

    const url = getLastGatewayPath(getMock);
    expect(url.pathname).toBe("/api/skill/clawhub/packages");
    expect(url.searchParams.get("limit")).toBe("24");
    expect(url.searchParams.get("sort")).toBe("downloads");
  });

  it("does not refetch from the sort effect when only enabled changes", async () => {
    const getMock = mockGatewayPackageList();

    const { rerender } = renderHook(
      ({ enabled }) =>
        useClawhubRegistrySkills({ limit: 24, enabled, sort: "updated" }),
      {
        initialProps: { enabled: false },
      }
    );

    expect(getMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(1);
    });

    const url = getLastGatewayPath(getMock);
    expect(url.searchParams.get("sort")).toBe("updated");
  });

  it("updates current sort and refetches when the external sort option changes", async () => {
    const getMock = mockGatewayPackageList();

    const { result, rerender } = renderHook(
      ({ sort }: SortHookProps) =>
        useClawhubRegistrySkills({ limit: 24, enabled: true, sort }),
      {
        initialProps: { sort: "downloads" },
      }
    );

    await waitFor(() => {
      expect(result.current.currentSort).toBe("downloads");
      expect(getMock).toHaveBeenCalledTimes(1);
    });

    expect(getLastGatewayPath(getMock).searchParams.get("sort")).toBe(
      "downloads"
    );

    rerender({ sort: "stars" });

    await waitFor(() => {
      expect(result.current.currentSort).toBe("stars");
      expect(getMock).toHaveBeenCalledTimes(2);
    });

    expect(getLastGatewayPath(getMock).searchParams.get("sort")).toBe("stars");
  });

  it("keeps latest sort results when an older request resolves after a newer one", async () => {
    const updatedRequest = createDeferred<ReturnType<typeof createPackageResponse>>();
    const starsRequest = createDeferred<ReturnType<typeof createPackageResponse>>();
    const getMock = vi
      .fn()
      .mockReturnValueOnce(updatedRequest.promise)
      .mockReturnValueOnce(starsRequest.promise);

    vi.mocked(getGatewayClient).mockReturnValue({
      get: getMock,
    } as unknown as ReturnType<typeof getGatewayClient>);

    const { result, rerender } = renderHook(
      ({ sort }: SortHookProps) =>
        useClawhubRegistrySkills({ limit: 24, enabled: true, sort }),
      {
        initialProps: { sort: "updated" },
      }
    );

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(1);
    });
    expect(getLastGatewayPath(getMock).searchParams.get("sort")).toBe(
      "updated"
    );

    rerender({ sort: "stars" });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(2);
    });
    expect(getLastGatewayPath(getMock).searchParams.get("sort")).toBe("stars");

    await act(async () => {
      starsRequest.resolve(createPackageResponse("New Skill"));
      await starsRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.skills.map((skill) => skill.name)).toEqual([
        "New Skill",
      ]);
      expect(result.current.currentSort).toBe("stars");
    });

    await act(async () => {
      updatedRequest.resolve(createPackageResponse("Old Skill"));
      await updatedRequest.promise;
    });

    await waitFor(() => {
      expect(result.current.skills.map((skill) => skill.name)).toEqual([
        "New Skill",
      ]);
      expect(result.current.currentSort).toBe("stars");
      expect(result.current.loading).toBe(false);
    });
  });
});

describe("useClawhubRegistry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exposes sort controls and keeps existing agent dialog fields", async () => {
    const getMock = mockGatewayPackageList();

    const { result } = renderHook(() =>
      useClawhubRegistry({ limit: 24, fetchOnMount: true })
    );

    await waitFor(() => {
      expect(result.current.displaySkills[0]?.name).toBe("Sorted Skill");
    });

    expect(result.current.currentSort).toBe("updated");
    expect(result.current.setSort).toEqual(expect.any(Function));
    expect(result.current.displaySkills).toEqual(expect.any(Array));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.loadMore).toEqual(expect.any(Function));
    expect(result.current.search).toEqual(expect.any(Function));
    expect(result.current.searchQuery).toBe("");
    expect(result.current.clearSearch).toEqual(expect.any(Function));
    expect(result.current.refreshSkills).toEqual(expect.any(Function));
    expect(result.current.skillsError).toBeNull();

    const initialUrl = getLastGatewayPath(getMock);
    expect(initialUrl.searchParams.get("sort")).toBe("updated");

    act(() => {
      result.current.setSort("stars");
    });

    await waitFor(() => {
      expect(getLastGatewayPath(getMock).searchParams.get("sort")).toBe("stars");
    });
  });
});

describe("useClawhubRegistrySearch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps latest search results when an older request resolves after a newer one", async () => {
    const oldSearch = createDeferred<ReturnType<typeof createSearchResponse>>();
    const newSearch = createDeferred<ReturnType<typeof createSearchResponse>>();
    const getMock = vi
      .fn()
      .mockReturnValueOnce(oldSearch.promise)
      .mockReturnValueOnce(newSearch.promise);

    vi.mocked(getGatewayClient).mockReturnValue({
      get: getMock,
    } as unknown as ReturnType<typeof getGatewayClient>);

    const { result } = renderHook(() =>
      useClawhubRegistrySearch({ debounceMs: 0, limit: 24 })
    );

    act(() => {
      result.current.search("old");
    });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.search("new");
    });

    await waitFor(() => {
      expect(getMock).toHaveBeenCalledTimes(2);
    });
    const latestSearchUrl = getLastGatewayPath(getMock);
    expect(latestSearchUrl.pathname).toBe("/api/skill/clawhub/search");
    expect(latestSearchUrl.searchParams.get("query")).toBe("new");

    await act(async () => {
      newSearch.resolve(createSearchResponse("New Search Skill"));
      await newSearch.promise;
    });

    await waitFor(() => {
      expect(result.current.results.map((skill) => skill.name)).toEqual([
        "New Search Skill",
      ]);
      expect(result.current.searchQuery).toBe("new");
    });

    await act(async () => {
      oldSearch.resolve(createSearchResponse("Old Search Skill"));
      await oldSearch.promise;
    });

    await waitFor(() => {
      expect(result.current.results.map((skill) => skill.name)).toEqual([
        "New Search Skill",
      ]);
      expect(result.current.loading).toBe(false);
    });
  });
});
