import { describe, expect, it } from "vitest";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";
import {
  formatSkillCount,
  getInstallableSkillId,
  getSkillInitials,
  getSkillSlug,
  getSkillTitle,
  toInstallableSkill,
} from "./skill-display-utils";

const communitySkill: CloudSkillPackage = {
  id: "cloud-1",
  name: "Cloud Runner",
  slug: "cloud-runner",
  version: "1.2.0",
  description: "Runs cloud workflows",
  category: "workflow",
  skillType: "automation",
  triggerPatterns: ["run workflow", "/cloud"],
  tags: ["automation"],
  repositoryUrl: "https://example.com/cloud-runner",
  favoritesCount: 7,
  downloadsCount: 1234,
  ratingAvg: 4.5,
  author: {
    id: "author-1",
    username: "jane",
    displayName: "Jane Doe",
    avatarUrl: null,
  },
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-02T00:00:00.000Z",
};

const officialSkill: ClawhubSkillDisplay = {
  id: "owner/official-runner",
  name: "Official Runner",
  slug: "owner/official-runner",
  version: "2.0.0",
  description: "Runs official tasks",
  ownerHandle: "owner",
  ownerName: "Owner Team",
  ownerAvatar: "https://example.com/avatar.png",
  isOfficial: true,
  executesCode: true,
  channel: "official",
  downloads: 98765,
  stars: 321,
  createdAt: 1717200000000,
  updatedAt: 1717286400000,
};

describe("skill display utilities", () => {
  it("formats counts with K and M suffixes", () => {
    expect(formatSkillCount(999)).toBe("999");
    expect(formatSkillCount(1200)).toBe("1.2K");
    expect(formatSkillCount(2500000)).toBe("2.5M");
  });

  it("extracts IDs, titles, and slugs from community items", () => {
    const item = { source: "community" as const, data: communitySkill };

    expect(getInstallableSkillId(item)).toBe("cloud-1");
    expect(getSkillTitle(item)).toBe("Cloud Runner");
    expect(getSkillSlug(item)).toBe("cloud-runner");
    expect(toInstallableSkill(item)).toEqual(item);
  });

  it("extracts IDs, titles, and slugs from official items", () => {
    const item = { source: "official" as const, data: officialSkill };

    expect(getInstallableSkillId(item)).toBe("owner/official-runner");
    expect(getSkillTitle(item)).toBe("Official Runner");
    expect(getSkillSlug(item)).toBe("owner/official-runner");
    expect(toInstallableSkill(item)).toEqual(item);
  });

  it("returns stable initials for names and handles empty values", () => {
    expect(getSkillInitials("Owner Team")).toBe("OT");
    expect(getSkillInitials("jane")).toBe("J");
    expect(getSkillInitials("")).toBe("?");
  });
});
