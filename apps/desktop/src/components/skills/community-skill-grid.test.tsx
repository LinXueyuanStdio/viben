/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement } from "react";
import type { ReactNode } from "react";
import type {
  CloudSkillPackage,
  CloudSkillSortOption,
} from "@/hooks/use-cloud-skills";
import { CommunitySkillGrid } from "./community-skill-grid";

const cloudState = vi.hoisted(() => ({
  infiniteHook: vi.fn(),
  searchHook: vi.fn(),
}));

const cardState = vi.hoisted(() => ({
  card: vi.fn(),
  skeleton: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, opts?: Record<string, unknown>) => opts ? (fallback ?? key).replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts[k] ?? `{{${k}}}`)) : (fallback ?? key),
  }),

  initReactI18next: {
    type: "3rdParty" as const,
    init: () => {},
  },
}));

vi.mock("@/hooks/use-cloud-skills", () => ({
  useCloudSkillPackagesInfinite: cloudState.infiniteHook,
  useCloudSkillSearch: cloudState.searchHook,
}));

vi.mock("./community-skill-card", () => ({
  CommunitySkillCard: cardState.card,
  CommunitySkillCardSkeleton: cardState.skeleton,
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
      aria-label={
        Children.toArray(children).map(getAriaLabel).find(Boolean) ?? "sort"
      }
      value={value}
      onChange={(event) => onValueChange(event.currentTarget.value)}
    >
      {Children.toArray(children).filter(
        (child) => !getAriaLabel(child)
      )}
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
  SelectTrigger: ({
    children,
    "aria-label": ariaLabel,
  }: {
    children: ReactNode;
    "aria-label"?: string;
  }) => <span aria-label={ariaLabel}>{children}</span>,
  SelectValue: () => null,
}));

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function getAriaLabel(child: ReactNode): string | undefined {
  if (!isValidElement<{ "aria-label"?: string }>(child)) {
    return undefined;
  }

  return child.props["aria-label"];
}

function createCommunitySkill(id: string): CloudSkillPackage {
  return {
    id,
    name: `Community ${id}`,
    slug: id,
    version: "1.0.0",
    description: "Community skill",
    category: "workflow",
    skillType: "automation",
    triggerPatterns: null,
    tags: null,
    repositoryUrl: null,
    favoritesCount: 2,
    downloadsCount: 20,
    ratingAvg: 4.2,
    author: {
      id: "author",
      username: "author",
      displayName: "Author",
      avatarUrl: null,
    },
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-02T00:00:00.000Z",
  };
}

function createInfiniteState() {
  return {
    packages: [createCommunitySkill("alpha")],
    pagination: {
      page: 1,
      limit: 24,
      total: 1,
      totalPages: 1,
    },
    loading: false,
    error: null as string | null,
    hasMore: false,
    loadMore: vi.fn(),
    refresh: vi.fn(),
  };
}

function createSearchState() {
  return {
    results: [] as CloudSkillPackage[],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    },
    loading: false,
    error: null as string | null,
    search: vi.fn(),
    clearResults: vi.fn(),
  };
}

function mockCloudState({
  infinite,
  search,
}: {
  infinite?: Partial<ReturnType<typeof createInfiniteState>>;
  search?: Partial<ReturnType<typeof createSearchState>>;
} = {}) {
  const infiniteState = {
    ...createInfiniteState(),
    ...infinite,
  };
  const searchState = {
    ...createSearchState(),
    ...search,
  };

  cloudState.infiniteHook.mockReturnValue(infiniteState);
  cloudState.searchHook.mockReturnValue(searchState);

  return { infiniteState, searchState };
}

function renderGrid(searchQuery = "") {
  return render(
    <CommunitySkillGrid
      searchQuery={searchQuery}
      onViewDetails={vi.fn()}
      onInstall={vi.fn()}
      isInstalled={(id) => id === "alpha"}
      isInstalling={(id) => id === "beta"}
      getProgress={(id) => (id === "beta" ? 65 : 0)}
    />
  );
}

describe("CommunitySkillGrid", () => {
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
        skill: CloudSkillPackage;
        isInstalled?: boolean;
        isInstalling?: boolean;
        installProgress?: number;
      }) => (
        <article data-testid="community-card">
          {skill.name}:{String(isInstalled)}:{String(isInstalling)}:
          {installProgress}
        </article>
      )
    );
    cardState.skeleton.mockImplementation(() => (
      <div data-testid="community-skeleton" />
    ));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders package results and loads more from the explicit button", () => {
    const { infiniteState } = mockCloudState({
      infinite: {
        hasMore: true,
      },
    });

    renderGrid();

    expect(cloudState.infiniteHook).toHaveBeenCalledWith({
      limit: 24,
      sort: "popular",
    });
    expect(cloudState.searchHook).toHaveBeenCalledWith("", 300);
    expect(screen.getByText(/Community alpha:true:false:0/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    expect(infiniteState.loadMore).toHaveBeenCalledTimes(1);
  });

  it("renders search results and hides browse controls while searching", () => {
    mockCloudState({
      search: {
        results: [createCommunitySkill("beta")],
      },
    });

    renderGrid("beta");

    expect(screen.getByText(/Community beta:false:true:65/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /load more/i })).toBeNull();
    expect(screen.queryByLabelText("Sort by")).toBeNull();
  });

  it("changes sort while browsing", () => {
    mockCloudState();

    renderGrid();

    fireEvent.change(screen.getByLabelText("Sort by"), {
      target: { value: "downloads" },
    });

    expect(cloudState.infiniteHook).toHaveBeenLastCalledWith({
      limit: 24,
      sort: "downloads" satisfies CloudSkillSortOption,
    });
  });

  it("renders empty state and retries by refreshing browse packages", () => {
    const { infiniteState, searchState } = mockCloudState({
      infinite: {
        packages: [],
      },
    });

    renderGrid();

    expect(screen.getByText("skillsMarket.noSkillsFound")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(infiniteState.refresh).toHaveBeenCalledTimes(1);
    expect(searchState.search).not.toHaveBeenCalled();
  });

  it("renders search error and retries by searching the current query", () => {
    const { infiniteState, searchState } = mockCloudState({
      infinite: {
        packages: [],
      },
      search: {
        results: [],
        error: "Search failed",
      },
    });

    renderGrid("broken");

    expect(screen.getByText("Search failed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(searchState.search).toHaveBeenCalledWith("broken");
    expect(infiniteState.refresh).not.toHaveBeenCalled();
  });

  it("keeps populated cards visible when a browse error is present and retries inline", () => {
    const { infiniteState, searchState } = mockCloudState({
      infinite: {
        packages: [createCommunitySkill("alpha")],
        error: "Browse failed",
      },
    });

    renderGrid();

    expect(screen.getByText(/Community alpha:true:false:0/)).toBeTruthy();
    expect(screen.getByText("Browse failed")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(infiniteState.refresh).toHaveBeenCalledTimes(1);
    expect(searchState.search).not.toHaveBeenCalled();
  });

  it("retries browse refresh instead of stale search when not in search mode", () => {
    const { infiniteState, searchState } = mockCloudState({
      infinite: {
        packages: [],
      },
      search: {
        error: "Stale search failed",
      },
    });

    renderGrid();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(infiniteState.refresh).toHaveBeenCalledTimes(1);
    expect(searchState.search).not.toHaveBeenCalled();
  });
});
