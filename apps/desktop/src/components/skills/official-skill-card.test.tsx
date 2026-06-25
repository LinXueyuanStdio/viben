/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";
import { OfficialSkillCard } from "./official-skill-card";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const skill: ClawhubSkillDisplay = {
  id: "clawhub/official-runner",
  name: "Official Runner",
  slug: "clawhub/official-runner",
  version: "2.0.0",
  description: "Runs official workflows",
  ownerHandle: "clawhub",
  ownerName: "Owner Team",
  ownerAvatar: "https://example.com/clawhub.png",
  isOfficial: true,
  executesCode: true,
  channel: "stable",
  downloads: 1234,
  stars: 42,
  createdAt: 1717200000000,
  updatedAt: 1717286400000,
};

describe("OfficialSkillCard", () => {
  it("renders official skill metadata", () => {
    render(<OfficialSkillCard skill={skill} onViewDetails={vi.fn()} />);

    expect(screen.getByText("Official Runner")).toBeTruthy();
    expect(screen.getByText("v2.0.0")).toBeTruthy();
    expect(screen.getByText("clawhub/official-runner")).toBeTruthy();
    expect(screen.getByText("1.2K")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Owner Team")).toBeTruthy();
  });

  it("installs without opening details and opens details from the title region", () => {
    const onInstall = vi.fn();
    const onViewDetails = vi.fn();

    render(
      <OfficialSkillCard
        skill={skill}
        onInstall={onInstall}
        onViewDetails={onViewDetails}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /install/i }));

    expect(onInstall).toHaveBeenCalledWith({ source: "official", data: skill });
    expect(onViewDetails).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Official Runner"));

    expect(onViewDetails).toHaveBeenCalledWith({
      source: "official",
      data: skill,
    });
  });

  it("keeps footer actions out of the details activation region", () => {
    render(
      <OfficialSkillCard
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

  it("opens ClawHub without opening details", () => {
    const onViewDetails = vi.fn();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<OfficialSkillCard skill={skill} onViewDetails={onViewDetails} />);

    fireEvent.click(screen.getByRole("button", { name: /clawhub/i }));

    expect(openSpy).toHaveBeenCalledWith(
      "https://clawhub.ai/skills/clawhub%2Fofficial-runner",
      "_blank",
      "noopener,noreferrer"
    );
    expect(onViewDetails).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it("opens details from keyboard activation", () => {
    const onViewDetails = vi.fn();

    render(<OfficialSkillCard skill={skill} onViewDetails={onViewDetails} />);

    const card = screen.getByRole("button", { name: /official runner/i });

    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });

    expect(onViewDetails).toHaveBeenCalledTimes(2);
    expect(onViewDetails).toHaveBeenLastCalledWith({
      source: "official",
      data: skill,
    });
  });

  it("does not open details when clicking a disabled install area", () => {
    const onInstall = vi.fn();
    const onViewDetails = vi.fn();

    render(
      <OfficialSkillCard
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
