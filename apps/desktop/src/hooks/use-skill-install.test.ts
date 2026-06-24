/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";
import {
  getInstallErrorTranslationKey,
  getSkillInstallId,
} from "./use-skill-install";

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
  id: "owner/official-skill",
  name: "Official Skill",
  slug: "owner/official-skill",
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

describe("use-skill-install helpers", () => {
  it("extracts the install ID from community and official skills", () => {
    expect(
      getSkillInstallId({ source: "community", data: communitySkill })
    ).toBe("cloud-1");
    expect(getSkillInstallId({ source: "official", data: officialSkill })).toBe(
      "owner/official-skill"
    );
  });

  it("maps structured install error codes to translation keys", () => {
    expect(getInstallErrorTranslationKey({ errorCode: "ALREADY_EXISTS" })).toBe(
      "skillsMarket.installErrorDuplicate"
    );
    expect(getInstallErrorTranslationKey({ errorCode: "NETWORK_ERROR" })).toBe(
      "skillsMarket.installErrorNetwork"
    );
    expect(getInstallErrorTranslationKey({ errorCode: "VALIDATION_ERROR" })).toBe(
      "skillsMarket.installErrorCorrupt"
    );
  });

  it("maps install error message text to translation keys", () => {
    expect(
      getInstallErrorTranslationKey({ error: "zip file is invalid" })
    ).toBe("skillsMarket.installErrorCorrupt");
    expect(getInstallErrorTranslationKey({ error: "permission denied" })).toBe(
      "skillsMarket.installErrorPermission"
    );
    expect(getInstallErrorTranslationKey({ error: "fetch failed" })).toBe(
      "skillsMarket.installErrorNetwork"
    );
    expect(getInstallErrorTranslationKey({ error: "unexpected" })).toBe(
      "skillsMarket.installErrorUnknown"
    );
  });
});
