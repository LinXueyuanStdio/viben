/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useClawhubRegistry,
  useClawhubRegistrySkills,
} from "./use-clawhub-registry";
import type { ClawhubPackageItem } from "@/types/clawhub-registry";

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

function mockFetchPackageList() {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      items: [createPackageItem("Sorted Skill")],
      nextCursor: null,
    }),
  }));

  vi.stubGlobal("fetch", fetchMock);

  return fetchMock;
}

function getLastFetchUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  const lastCall = fetchMock.mock.calls.at(-1);
  expect(lastCall).toBeDefined();

  return new URL(String(lastCall?.[0]));
}

describe("useClawhubRegistrySkills", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends requested sort to ClaWHub package listing and maps skills", async () => {
    const fetchMock = mockFetchPackageList();

    const { result } = renderHook(() =>
      useClawhubRegistrySkills({ limit: 24, enabled: true, sort: "downloads" })
    );

    await waitFor(() => {
      expect(result.current.skills[0]?.name).toBe("Sorted Skill");
    });

    const url = getLastFetchUrl(fetchMock);
    expect(url.pathname).toBe("/api/v1/packages");
    expect(url.searchParams.get("family")).toBe("skill");
    expect(url.searchParams.get("limit")).toBe("24");
    expect(url.searchParams.get("sort")).toBe("downloads");
  });

  it("does not refetch from the sort effect when only enabled changes", async () => {
    const fetchMock = mockFetchPackageList();

    const { rerender } = renderHook(
      ({ enabled }) =>
        useClawhubRegistrySkills({ limit: 24, enabled, sort: "updated" }),
      {
        initialProps: { enabled: false },
      }
    );

    expect(fetchMock).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const url = getLastFetchUrl(fetchMock);
    expect(url.searchParams.get("sort")).toBe("updated");
  });
});

describe("useClawhubRegistry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes sort controls and keeps existing agent dialog fields", async () => {
    const fetchMock = mockFetchPackageList();

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

    const initialUrl = getLastFetchUrl(fetchMock);
    expect(initialUrl.searchParams.get("sort")).toBe("updated");

    act(() => {
      result.current.setSort("stars");
    });

    await waitFor(() => {
      expect(getLastFetchUrl(fetchMock).searchParams.get("sort")).toBe("stars");
    });
  });
});
