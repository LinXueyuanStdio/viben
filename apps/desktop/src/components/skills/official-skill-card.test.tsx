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
  ownerName: "Clawhub Team",
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
    expect(screen.getByText("Clawhub Team")).toBeTruthy();
  });

  it("installs without opening details and opens details from title", () => {
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

    fireEvent.click(screen.getByRole("heading", { name: "Official Runner" }));

    expect(onViewDetails).toHaveBeenCalledWith({
      source: "official",
      data: skill,
    });
  });
});
