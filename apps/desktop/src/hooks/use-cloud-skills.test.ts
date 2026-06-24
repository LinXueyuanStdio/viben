import { describe, expect, it } from "vitest";
import {
  appendCloudSkillPage,
  mapCloudSkillPackage,
} from "./use-cloud-skills";
import type { CloudSkillPackage, PaginationInfo } from "./use-cloud-skills";

const pagination: PaginationInfo = {
  page: 1,
  limit: 2,
  total: 3,
  totalPages: 2,
};

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
