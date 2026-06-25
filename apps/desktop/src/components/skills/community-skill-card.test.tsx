/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import { CommunitySkillCard } from "./community-skill-card";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const skill: CloudSkillPackage = {
  id: "cloud-1",
  name: "Cloud Runner",
  slug: "cloud-runner",
  version: "1.2.0",
  description: "Runs cloud workflows",
  category: "workflow",
  skillType: "automation",
  triggerPatterns: ["run workflow", "/cloud", "deploy cloud"],
  tags: ["workflow", "cloud"],
  repositoryUrl: "https://example.com/cloud-runner",
  favoritesCount: 7,
  downloadsCount: 1234,
  ratingAvg: 4.5,
  author: {
    id: "author-1",
    username: "jane",
    displayName: "Jane Doe",
    avatarUrl: "https://example.com/jane.png",
  },
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-02T00:00:00.000Z",
};

describe("CommunitySkillCard", () => {
  it("renders community skill metadata", () => {
    render(<CommunitySkillCard skill={skill} onViewDetails={vi.fn()} />);

    expect(screen.getByText("Cloud Runner")).toBeTruthy();
    expect(screen.getByText("automation")).toBeTruthy();
    expect(screen.getByText("run workflow")).toBeTruthy();
    expect(screen.getByText("/cloud")).toBeTruthy();
    expect(screen.getByText("Jane Doe")).toBeTruthy();
  });

  it("installs without opening details and opens details from the title region", () => {
    const onInstall = vi.fn();
    const onViewDetails = vi.fn();

    render(
      <CommunitySkillCard
        skill={skill}
        onInstall={onInstall}
        onViewDetails={onViewDetails}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /install/i }));

    expect(onInstall).toHaveBeenCalledWith({
      source: "community",
      data: skill,
    });
    expect(onViewDetails).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Cloud Runner"));

    expect(onViewDetails).toHaveBeenCalledWith({
      source: "community",
      data: skill,
    });
  });

  it("keeps footer actions out of the details activation region", () => {
    render(
      <CommunitySkillCard
        skill={skill}
        onInstall={vi.fn()}
        onViewDetails={vi.fn()}
      />
    );

    const installButton = screen.getByRole("button", { name: /install/i });
    const card = installButton.closest("article");

    expect(card?.getAttribute("role")).toBeNull();
    expect(card?.getAttribute("tabindex")).toBeNull();
  });

  it("opens the repository without opening details", () => {
    const onViewDetails = vi.fn();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<CommunitySkillCard skill={skill} onViewDetails={onViewDetails} />);

    fireEvent.click(screen.getByRole("button", { name: /repository/i }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/cloud-runner",
      "_blank",
      "noopener,noreferrer"
    );
    expect(onViewDetails).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it("opens details from keyboard activation", () => {
    const onViewDetails = vi.fn();

    render(<CommunitySkillCard skill={skill} onViewDetails={onViewDetails} />);

    const card = screen.getByRole("button", { name: /cloud runner/i });

    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onViewDetails).toHaveBeenCalledTimes(2);
    expect(onViewDetails).toHaveBeenLastCalledWith({
      source: "community",
      data: skill,
    });
  });

  it("does not open details when clicking a disabled install area", () => {
    const onInstall = vi.fn();
    const onViewDetails = vi.fn();

    render(
      <CommunitySkillCard
        skill={skill}
        onInstall={onInstall}
        onViewDetails={onViewDetails}
        isInstalled
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /installed/i }).parentElement!);

    expect(onInstall).not.toHaveBeenCalled();
    expect(onViewDetails).not.toHaveBeenCalled();
  });
});
