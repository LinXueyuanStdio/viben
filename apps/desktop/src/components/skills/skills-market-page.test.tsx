/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { SkillSource } from "./types";
import { SkillsMarketPage } from "@/pages/skills-market";

const installState = vi.hoisted(() => ({
  install: vi.fn(),
  isInstalled: vi.fn(),
  isInstalling: vi.fn(),
  getProgress: vi.fn(),
}));

const skillsComponents = vi.hoisted(() => ({
  officialGrid: vi.fn(),
  communityGrid: vi.fn(),
  skillDetail: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  initReactI18next: {
    type: "3rdParty",
    init: () => undefined,
  },
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@/hooks/use-skill-install", () => ({
  useSkillInstall: () => installState,
}));

vi.mock("@/components/skills", () => ({
  SearchBar: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <input
      aria-label="skill search"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  ),
  SkillSourceTabs: ({
    source,
    onSourceChange,
  }: {
    source: SkillSource;
    onSourceChange: (source: SkillSource) => void;
  }) => (
    <div>
      <span data-testid="active-source">{source}</span>
      <button type="button" onClick={() => onSourceChange("official")}>
        official
      </button>
      <button type="button" onClick={() => onSourceChange("community")}>
        community
      </button>
    </div>
  ),
  OfficialSkillGrid: skillsComponents.officialGrid,
  CommunitySkillGrid: skillsComponents.communityGrid,
  SkillDetail: skillsComponents.skillDetail,
}));

function renderPage() {
  return render(<SkillsMarketPage />);
}

describe("SkillsMarketPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installState.install.mockResolvedValue(null);
    installState.isInstalled.mockReturnValue(false);
    installState.isInstalling.mockReturnValue(false);
    installState.getProgress.mockReturnValue(undefined);
    skillsComponents.officialGrid.mockImplementation(
      ({ searchQuery }: { searchQuery: string }) => (
        <div data-testid="official-grid">{searchQuery}</div>
      )
    );
    skillsComponents.communityGrid.mockImplementation(
      ({ searchQuery }: { searchQuery: string }) => (
        <div data-testid="community-grid">{searchQuery}</div>
      )
    );
    skillsComponents.skillDetail.mockImplementation(
      ({ children }: { children?: ReactNode }) => (
        <div data-testid="skill-detail">{children}</div>
      )
    );
  });

  it("starts on official and passes the search query to the official grid", () => {
    renderPage();

    expect(screen.getByTestId("active-source").textContent).toBe("official");
    expect(screen.getByTestId("official-grid")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("skill search"), {
      target: { value: "agent tools" },
    });

    expect(skillsComponents.officialGrid).toHaveBeenLastCalledWith(
      expect.objectContaining({
        searchQuery: "agent tools",
        onViewDetails: expect.any(Function),
        onInstall: installState.install,
        isInstalled: installState.isInstalled,
        isInstalling: installState.isInstalling,
        getProgress: expect.any(Function),
      }),
      undefined
    );
    expect(screen.queryByTestId("community-grid")).toBeNull();
  });

  it("resets search and scroll position when switching to community", () => {
    renderPage();

    const scrollContainer = screen.getByTestId("skills-market-scroll");
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      writable: true,
      value: 48,
    });

    fireEvent.change(screen.getByLabelText("skill search"), {
      target: { value: "workflow" },
    });
    expect(screen.getByLabelText("skill search")).toHaveProperty(
      "value",
      "workflow"
    );

    fireEvent.click(screen.getByRole("button", { name: "community" }));

    expect(screen.getByTestId("active-source").textContent).toBe("community");
    expect(screen.getByLabelText("skill search")).toHaveProperty("value", "");
    expect(scrollContainer.scrollTop).toBe(0);
    expect(skillsComponents.communityGrid).toHaveBeenLastCalledWith(
      expect.objectContaining({
        searchQuery: "",
      }),
      undefined
    );
  });
});
