/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type {
  ClawhubSkillDisplay,
  ClawhubSkillSortOption,
} from "@/types/clawhub-registry";
import { OfficialSkillGrid } from "./official-skill-grid";

const registryState = vi.hoisted(() => ({
  hook: vi.fn(),
}));

const cardState = vi.hoisted(() => ({
  card: vi.fn(),
  skeleton: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@/hooks/use-clawhub-registry", () => ({
  useClawhubRegistry: registryState.hook,
}));

vi.mock("./official-skill-card", () => ({
  OfficialSkillCard: cardState.card,
  OfficialSkillCardSkeleton: cardState.skeleton,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: ReactNode;
  }) => (
    <select
      aria-label="sort"
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: ReactNode;
  }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function createOfficialSkill(
  id: string,
  version = "1.0.0"
): ClawhubSkillDisplay {
  return {
    id,
    name: `Official ${id}`,
    slug: id,
    version,
    description: "Official skill",
    ownerHandle: "clawhub",
    ownerName: "ClaWHub",
    ownerAvatar: null,
    isOfficial: true,
    executesCode: false,
    channel: "stable",
    downloads: 10,
    stars: 3,
    createdAt: 1,
    updatedAt: 2,
  };
}

function mockRegistryState(
  overrides: Partial<ReturnType<typeof createRegistryState>> = {}
) {
  const state = {
    ...createRegistryState(),
    ...overrides,
  };

  registryState.hook.mockReturnValue(state);
  return state;
}

function createRegistryState() {
  return {
    skills: [createOfficialSkill("alpha")],
    skillsLoading: false,
    skillsError: null as string | null,
    skillsHasMore: false,
    refreshSkills: vi.fn(),
    setSort: vi.fn(),
    currentSort: "updated" as ClawhubSkillSortOption,
    searchResults: [] as ClawhubSkillDisplay[],
    searchLoading: false,
    searchError: null as string | null,
    search: vi.fn(),
    searchQuery: "",
    clearSearch: vi.fn(),
    displaySkills: [createOfficialSkill("alpha")],
    isLoading: false,
    isSearching: false,
    hasMore: false,
    loadMore: vi.fn(),
  };
}

function renderGrid(searchQuery = "") {
  return render(
    <OfficialSkillGrid
      searchQuery={searchQuery}
      onViewDetails={vi.fn()}
      onInstall={vi.fn()}
      isInstalled={(id) => id === "alpha"}
      isInstalling={(id) => id === "beta"}
      getProgress={(id) => (id === "beta" ? 42 : 0)}
    />
  );
}

describe("OfficialSkillGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    cardState.card.mockImplementation(
      ({
        skill,
        isInstalled,
        isInstalling,
        installProgress,
      }: {
        skill: ClawhubSkillDisplay;
        isInstalled?: boolean;
        isInstalling?: boolean;
        installProgress?: number;
      }) => (
        <article data-testid="official-card">
          {skill.name}:{String(isInstalled)}:{String(isInstalling)}:
          {installProgress}
        </article>
      )
    );
    cardState.skeleton.mockImplementation(() => (
      <div data-testid="official-skeleton" />
    ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("syncs the search prop to the registry hook and renders search results", async () => {
    const skill = createOfficialSkill("beta", "2.0.0");
    const state = mockRegistryState({
      skills: [],
      displaySkills: [skill],
      searchResults: [skill],
      searchQuery: "",
      isSearching: true,
    });

    renderGrid("beta");

    expect(registryState.hook).toHaveBeenCalledWith({
      limit: 24,
      fetchOnMount: true,
    });
    await waitFor(() => {
      expect(state.search).toHaveBeenCalledWith("beta");
    });
    expect(screen.getByText(/Official beta:false:true:42/)).toBeTruthy();
  });

  it("loads more results from the explicit load more button", () => {
    const state = mockRegistryState({
      skillsHasMore: true,
      hasMore: true,
    });

    renderGrid();

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    expect(state.loadMore).toHaveBeenCalledTimes(1);
  });

  it("changes sort while browsing", () => {
    const state = mockRegistryState();

    renderGrid();

    fireEvent.change(screen.getByLabelText("sort"), {
      target: { value: "downloads" },
    });

    expect(state.setSort).toHaveBeenCalledWith("downloads");
  });

  it("renders empty state and retries by refreshing browse results", () => {
    const state = mockRegistryState({
      skills: [],
      displaySkills: [],
    });

    renderGrid();

    expect(screen.getByText("skillsMarket.noSkillsFound")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(state.refreshSkills).toHaveBeenCalledTimes(1);
    expect(state.search).not.toHaveBeenCalled();
  });

  it("renders search error and retries by searching the current query", () => {
    const state = mockRegistryState({
      skills: [],
      displaySkills: [],
      isSearching: true,
      searchQuery: "broken",
      searchError: "Search failed",
    });

    renderGrid("broken");

    expect(screen.getByText("Search failed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(state.search).toHaveBeenCalledWith("broken");
    expect(state.refreshSkills).not.toHaveBeenCalled();
  });
});
