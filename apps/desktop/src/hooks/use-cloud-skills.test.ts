/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendCloudSkillPage,
  mapCloudSkillPackage,
  useCloudSkillPackagesInfinite,
} from "./use-cloud-skills";
import { getClient } from "@/lib/viben";
import type {
  CloudSkillListResponse,
  CloudSkillPackage,
  CloudSkillSortOption,
  PaginationInfo,
} from "./use-cloud-skills";

vi.mock("@/lib/viben", () => ({
  getClient: vi.fn(),
}));

const pagination: PaginationInfo = {
  page: 1,
  limit: 2,
  total: 3,
  totalPages: 2,
};

interface InfiniteHookProps {
  sort: CloudSkillSortOption;
}

function createApiPackage(name: string) {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    version: "1.0.0",
    description: null,
    createdAt: "2026-06-01T00:00:00.000Z",
  };
}

function createListResponse(
  name: string,
  pagePagination: PaginationInfo = {
    page: 1,
    limit: 24,
    total: 1,
    totalPages: 1,
  }
): CloudSkillListResponse {
  return {
    data: [mapCloudSkillPackage(createApiPackage(name))],
    pagination: pagePagination,
  };
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

const getClientMock = vi.mocked(getClient);

describe("use-cloud-skills helpers", () => {
  it("maps API package fields with stable fallbacks", () => {
    const mapped = mapCloudSkillPackage({
      id: "pkg-1",
      name: "Package One",
      slug: "package-one",
      version: "1.0.0",
      description: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      skillType: undefined,
      triggerPatterns: undefined,
      tags: undefined,
      repositoryUrl: undefined,
      favoritesCount: undefined,
      downloadsCount: undefined,
      ratingAvg: undefined,
      author: {
        id: "user-1",
        username: "alex",
        displayName: undefined,
        avatarUrl: undefined,
      },
    });

    expect(mapped.skillType).toBe("command");
    expect(mapped.triggerPatterns).toBeNull();
    expect(mapped.tags).toBeNull();
    expect(mapped.repositoryUrl).toBeNull();
    expect(mapped.favoritesCount).toBe(0);
    expect(mapped.downloadsCount).toBe(0);
    expect(mapped.ratingAvg).toBe(0);
    expect(mapped.author?.displayName).toBe("alex");
    expect(mapped.updatedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("replaces packages on refresh and appends on load more", () => {
    const first: CloudSkillPackage = mapCloudSkillPackage({
      id: "pkg-1",
      name: "One",
      slug: "one",
      version: "1.0.0",
      description: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    const second: CloudSkillPackage = mapCloudSkillPackage({
      id: "pkg-2",
      name: "Two",
      slug: "two",
      version: "1.0.0",
      description: null,
      createdAt: "2026-06-02T00:00:00.000Z",
    });

    expect(appendCloudSkillPage([first], [second], pagination, false)).toEqual({
      packages: [first, second],
      pagination,
      hasMore: true,
    });
    expect(
      appendCloudSkillPage([first], [second], { ...pagination, total: 2 }, true)
    ).toEqual({
      packages: [second],
      pagination: { ...pagination, total: 2 },
      hasMore: true,
    });
  });
});

describe("useCloudSkillPackagesInfinite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps latest sort results when an older request resolves after a newer one", async () => {
    const popularFetch = createDeferred<CloudSkillListResponse>();
    const latestFetch = createDeferred<CloudSkillListResponse>();
    const list = vi
      .fn()
      .mockReturnValueOnce(popularFetch.promise)
      .mockReturnValueOnce(latestFetch.promise);

    getClientMock.mockReturnValue({
      skill: { list },
    } as unknown as ReturnType<typeof getClient>);

    const { result, rerender } = renderHook(
      ({ sort }: InfiniteHookProps) =>
        useCloudSkillPackagesInfinite({ limit: 24, sort }),
      {
        initialProps: { sort: "popular" },
      }
    );

    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(1);
    });
    expect(list).toHaveBeenLastCalledWith({
      page: 1,
      limit: 24,
      sort: "popular",
    });

    rerender({ sort: "latest" });

    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(2);
    });
    expect(list).toHaveBeenLastCalledWith({
      page: 1,
      limit: 24,
      sort: "latest",
    });

    await act(async () => {
      latestFetch.resolve(createListResponse("Latest Skill"));
      await latestFetch.promise;
    });

    await waitFor(() => {
      expect(result.current.packages.map((pkg) => pkg.name)).toEqual([
        "Latest Skill",
      ]);
    });

    await act(async () => {
      popularFetch.resolve(createListResponse("Popular Skill"));
      await popularFetch.promise;
    });

    await waitFor(() => {
      expect(result.current.packages.map((pkg) => pkg.name)).toEqual([
        "Latest Skill",
      ]);
      expect(result.current.loading).toBe(false);
    });
  });
});
