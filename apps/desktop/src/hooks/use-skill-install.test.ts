/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import type { InstallProgress, InstallSkillResult } from "@/lib/skill-installer";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";
import {
  getInstallErrorTranslationKey,
  getSkillInstallId,
  useSkillInstall,
} from "./use-skill-install";
import {
  downloadAndInstallClawhubSkill,
  downloadAndInstallSkill,
} from "@/lib/skill-installer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),

  initReactI18next: {
    type: "3rdParty" as const,
    init: () => {},
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/skill-installer", () => ({
  downloadAndInstallClawhubSkill: vi.fn(),
  downloadAndInstallSkill: vi.fn(),
}));

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

const installResult: InstallSkillResult = {
  success: true,
  name: "Official Skill",
  version: "2.0.0",
  path: "/skills/official-skill",
  message: "Installed",
};

const communityInstallableSkill = {
  source: "community" as const,
  data: communitySkill,
};

const officialInstallableSkill = {
  source: "official" as const,
  data: officialSkill,
};

const downloadAndInstallSkillMock = vi.mocked(downloadAndInstallSkill);
const downloadAndInstallClawhubSkillMock = vi.mocked(
  downloadAndInstallClawhubSkill
);

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

describe("useSkillInstall", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ignores duplicate same-id install calls before React commits installing state", async () => {
    const installDeferred = createDeferred<InstallSkillResult>();
    downloadAndInstallSkillMock.mockReturnValue(installDeferred.promise);

    const { result } = renderHook(() => useSkillInstall());
    let firstInstall: Promise<InstallSkillResult | null>;
    let secondInstall: Promise<InstallSkillResult | null>;

    act(() => {
      firstInstall = result.current.install(communityInstallableSkill);
      secondInstall = result.current.install(communityInstallableSkill);
    });

    expect(downloadAndInstallSkillMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      installDeferred.resolve(installResult);
      await expect(firstInstall).resolves.toEqual(installResult);
      await expect(secondInstall).resolves.toBeNull();
    });
  });

  it("keeps retry progress when the previous cleanup timer fires", async () => {
    vi.useFakeTimers();
    downloadAndInstallSkillMock
      .mockImplementationOnce(async ({ onProgress }) => {
        onProgress?.({
          stage: "downloading",
          progress: 40,
          message: "first attempt",
        });
        return installResult;
      })
      .mockImplementationOnce(async ({ onProgress }) => {
        onProgress?.({
          stage: "downloading",
          progress: 70,
          message: "retry attempt",
        } satisfies InstallProgress);
        return installResult;
      });

    const { result } = renderHook(() => useSkillInstall());

    await act(async () => {
      await result.current.install(communityInstallableSkill);
    });

    expect(result.current.getProgress("cloud-1")?.progress).toBe(40);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
      await result.current.install(communityInstallableSkill);
    });

    expect(result.current.getProgress("cloud-1")?.progress).toBe(70);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.getProgress("cloud-1")?.progress).toBe(70);
  });

  it("installs official skills through the ClaWHub installer", async () => {
    downloadAndInstallClawhubSkillMock.mockResolvedValue(installResult);

    const { result } = renderHook(() => useSkillInstall());

    await act(async () => {
      await result.current.install(officialInstallableSkill);
    });

    expect(downloadAndInstallClawhubSkillMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "owner/official-skill",
        name: "Official Skill",
        version: "2.0.0",
      })
    );
  });
});
