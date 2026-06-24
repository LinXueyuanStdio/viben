/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";
import { SkillDetail } from "./skill-detail";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const official: ClawhubSkillDisplay = {
  id: "owner/official-skill",
  name: "Official Skill",
  slug: "owner/official-skill",
  version: "1.0.0",
  description: "Official skill description",
  ownerHandle: "owner",
  ownerName: "Owner Team",
  ownerAvatar: "https://example.com/owner.png",
  isOfficial: true,
  executesCode: true,
  channel: "official",
  downloads: 1200,
  stars: 42,
  createdAt: 1717200000000,
  updatedAt: 1717286400000,
};

const community: CloudSkillPackage = {
  id: "community-1",
  name: "Community Skill",
  slug: "community-skill",
  version: "0.3.0",
  description: "Community skill description",
  category: "workflow",
  skillType: "automation",
  triggerPatterns: ["run automation", "/community"],
  tags: ["automation", "cloud"],
  repositoryUrl: "https://example.com/community-skill",
  favoritesCount: 8,
  downloadsCount: 900,
  ratingAvg: 4.7,
  author: {
    id: "sam-1",
    username: "samdev",
    displayName: "Sam Dev",
    avatarUrl: "https://example.com/sam.png",
  },
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-02T00:00:00.000Z",
};

async function clickAndFlush(element: Element): Promise<void> {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

describe("SkillDetail", () => {
  beforeEach(() => {
    vi.useRealTimers();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders official skill details", () => {
    render(
      <SkillDetail
        skill={{ source: "official", data: official }}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText("Official Skill")).toBeTruthy();
    expect(screen.getByText("Official")).toBeTruthy();
    expect(screen.getByText("Owner Team")).toBeTruthy();
    expect(screen.getAllByText("Downloads: 1.2K").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Stars: 42").length).toBeGreaterThan(0);
    expect(screen.getByText("This skill executes code")).toBeTruthy();
  });

  it("renders community skill details", () => {
    render(
      <SkillDetail
        skill={{ source: "community", data: community }}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByText("Community Skill")).toBeTruthy();
    expect(screen.getAllByText("automation").length).toBeGreaterThan(0);
    expect(screen.getByText("run automation")).toBeTruthy();
    expect(screen.getByText("Sam Dev")).toBeTruthy();
    expect(screen.getByText("Rating: 4.7")).toBeTruthy();
    expect(screen.getByText("Downloads: 900")).toBeTruthy();
    expect(screen.getByText("Favorites: 8")).toBeTruthy();
  });

  it("copies official slug and installs wrapped official skill", async () => {
    const onInstall = vi.fn();

    render(
      <SkillDetail
        skill={{ source: "official", data: official }}
        open
        onOpenChange={vi.fn()}
        onInstall={onInstall}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "owner/official-skill"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: /install/i }));

    expect(onInstall).toHaveBeenCalledWith({
      source: "official",
      data: official,
    });
  });

  it("clears stale copy timers when copying repeatedly", async () => {
    vi.useFakeTimers();

    render(
      <SkillDetail
        skill={{ source: "official", data: official }}
        open
        onOpenChange={vi.fn()}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });

    await clickAndFlush(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    await clickAndFlush(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("clears copied state and timer when the selected skill changes", async () => {
    vi.useFakeTimers();

    const { rerender } = render(
      <SkillDetail
        skill={{ source: "official", data: official }}
        open
        onOpenChange={vi.fn()}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    await clickAndFlush(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "owner/official-skill"
    );
    expect(copyButton.querySelector(".text-green-500")).toBeTruthy();
    expect(vi.getTimerCount()).toBe(1);

    rerender(
      <SkillDetail
        skill={{ source: "community", data: community }}
        open
        onOpenChange={vi.fn()}
      />
    );

    expect(
      screen
        .getByRole("button", { name: /copy/i })
        .querySelector(".text-green-500")
    ).toBeNull();
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(2000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores delayed copy completion from a previous skill", async () => {
    let resolveCopy: (() => void) | null = null;
    const clipboardWrite = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCopy = resolve;
        })
    );

    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWrite,
      },
    });
    vi.useFakeTimers();

    const { rerender } = render(
      <SkillDetail
        skill={{ source: "official", data: official }}
        open
        onOpenChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(clipboardWrite).toHaveBeenCalledWith("owner/official-skill");

    rerender(
      <SkillDetail
        skill={{ source: "community", data: community }}
        open
        onOpenChange={vi.fn()}
      />
    );

    await act(async () => {
      resolveCopy?.();
      await Promise.resolve();
    });

    expect(
      screen
        .getByRole("button", { name: /copy/i })
        .querySelector(".text-green-500")
    ).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears pending copy timer on unmount", async () => {
    vi.useFakeTimers();

    const { unmount } = render(
      <SkillDetail
        skill={{ source: "official", data: official }}
        open
        onOpenChange={vi.fn()}
      />
    );

    await clickAndFlush(screen.getByRole("button", { name: /copy/i }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(2000);
    expect(vi.getTimerCount()).toBe(0);
  });
});
