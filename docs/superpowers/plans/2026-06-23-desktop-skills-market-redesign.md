# Desktop Skills Market Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 Desktop 技能市场，使其支持 Official ClaWHub 与 Community Cloud Skills 双源浏览、无限滚动、排序、统一详情弹窗和桌面端安装进度。

**Architecture:** 将 `/root/viben/apps/desktop/src/pages/skills-market.tsx` 压缩为只管理源切换、搜索和详情弹窗的容器，数据源列表、卡片、安装状态分别下沉到 focused hooks/components。Official 走 ClaWHub registry hook，Community 走 Viben Cloud hook，两者通过 `SkillDetailItem` / `InstallableSkill` 判别联合类型共享详情弹窗和安装 hook。

**Tech Stack:** React 19, Vite/Tauri Desktop, TypeScript, Vitest, @testing-library/react, Tailwind v4, lucide-react, Radix UI primitives, Viben Gateway API, ClaWHub API.

---

## File Structure

- Create `/root/viben/apps/desktop/src/components/skills/types.ts`
  - Defines `SkillSource`, `SkillDetailItem`, `InstallableSkill`, `CommunitySkillSortOption`, and shared progress props.
- Create `/root/viben/apps/desktop/src/components/skills/skill-display-utils.ts`
  - Pure formatting helpers and ID/name extraction for union types.
- Create `/root/viben/apps/desktop/src/components/skills/skill-display-utils.test.ts`
  - Unit tests for union IDs, labels, count formatting, initials, and detail field selection.
- Modify `/root/viben/apps/desktop/src/types/clawhub-registry.ts`
  - Adds `ClawhubSkillSortOption`.
- Modify `/root/viben/apps/desktop/src/hooks/use-clawhub-registry.ts`
  - Adds list sort support and exposes `setSort` / `currentSort` from the combined hook without changing existing return fields used by `/root/viben/apps/desktop/src/components/agent/skill-market-grid.tsx`.
- Create `/root/viben/apps/desktop/src/hooks/use-clawhub-registry.test.tsx`
  - Verifies list requests include `sort`, sort changes refresh cursor pagination, and existing combined hook fields remain available.
- Modify `/root/viben/apps/desktop/src/hooks/use-cloud-skills.ts`
  - Extracts cloud package mapping into a pure helper and adds `useCloudSkillPackagesInfinite`.
- Create `/root/viben/apps/desktop/src/hooks/use-cloud-skills.test.ts`
  - Unit tests for package mapping and append/reset pagination behavior via exported reducer helpers.
- Modify `/root/viben/apps/desktop/src/lib/skill-installer.ts`
  - Adds `downloadAndInstallClawhubSkill` using ClaWHub package ZIP download plus the existing gateway install path.
- Create `/root/viben/apps/desktop/src/lib/skill-installer.test.ts`
  - Unit tests for ClaWHub package ZIP URL construction and install request body using mocked Tauri fs/path and Gateway client.
- Create `/root/viben/apps/desktop/src/hooks/use-skill-install.ts`
  - Centralizes installing IDs, installed IDs, progress map, toast handling, and source-specific install dispatch.
- Create `/root/viben/apps/desktop/src/hooks/use-skill-install.test.ts`
  - Unit tests for install ID selection and error description mapping.
- Create `/root/viben/apps/desktop/src/components/skills/skill-source-tabs.tsx`
  - Desktop state-driven Official/Community tabs and source badge.
- Create `/root/viben/apps/desktop/src/components/skills/skill-source-tabs.test.tsx`
  - Component tests for tab labels and change callback.
- Create `/root/viben/apps/desktop/src/components/skills/official-skill-card.tsx`
  - ClaWHub card with owner avatar, stats, ClaWHub link, install button, and progress bar.
- Create `/root/viben/apps/desktop/src/components/skills/official-skill-card.test.tsx`
  - Component tests for stats, install click isolation, and detail click.
- Move `/root/viben/apps/desktop/src/components/skills/skill-card.tsx` to `/root/viben/apps/desktop/src/components/skills/community-skill-card.tsx`
  - Redesigns the existing Community card while preserving trigger patterns, skill type badge, repository link, install progress.
- Create `/root/viben/apps/desktop/src/components/skills/community-skill-card.test.tsx`
  - Component tests for author fallback, trigger preview, install click isolation, and detail click.
- Rewrite `/root/viben/apps/desktop/src/components/skills/skill-detail.tsx`
  - Accepts `SkillDetailItem | null` and renders source-specific metadata.
- Create `/root/viben/apps/desktop/src/components/skills/skill-detail.test.tsx`
  - Component tests for official warning, community trigger patterns, copy slug, and install action.
- Create `/root/viben/apps/desktop/src/components/skills/official-skill-grid.tsx`
  - ClaWHub infinite grid with sort select, refresh, loading/empty/error states, and observer trigger.
- Create `/root/viben/apps/desktop/src/components/skills/community-skill-grid.tsx`
  - Cloud Skills infinite grid with sort select, refresh, loading/empty/error states, and observer trigger.
- Create `/root/viben/apps/desktop/src/components/skills/skill-grid-states.tsx`
  - Shared loading skeleton grid, empty state, and error banner for both grids.
- Create `/root/viben/apps/desktop/src/components/skills/skills-market-page.test.tsx`
  - Container-level component tests for source switching, search reset, and detail wiring.
- Rewrite `/root/viben/apps/desktop/src/pages/skills-market.tsx`
  - Lightweight container around header, tabs, search, current grid, and detail dialog.
- Modify `/root/viben/apps/desktop/src/components/skills/index.ts`
  - Exports new components/types and removes `CategoryFilter`.
- Delete `/root/viben/apps/desktop/src/components/skills/category-filter.tsx`
  - The categories API is hardcoded today and the redesigned market uses inline sort controls.
- Modify `/root/viben/apps/desktop/src/i18n/locales/en.json`
  - Adds Desktop skills market keys for source tabs, sort labels, Official badge, counts, warnings, and ClaWHub link.
- Modify `/root/viben/apps/desktop/src/i18n/locales/zh-CN.json`
  - Adds matching Chinese translations; use `技能` / `智能体` terminology consistently.

## Task 1: Shared Skill Union Types And Display Utilities

**Files:**
- Create: `/root/viben/apps/desktop/src/components/skills/types.ts`
- Create: `/root/viben/apps/desktop/src/components/skills/skill-display-utils.ts`
- Test: `/root/viben/apps/desktop/src/components/skills/skill-display-utils.test.ts`

- [ ] **Step 1: Write failing tests for shared display utilities**

Create `/root/viben/apps/desktop/src/components/skills/skill-display-utils.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/skill-display-utils.test.ts
```

Expected: FAIL because `/root/viben/apps/desktop/src/components/skills/skill-display-utils.ts` and `/root/viben/apps/desktop/src/components/skills/types.ts` do not exist.

- [ ] **Step 3: Create shared union types**

Create `/root/viben/apps/desktop/src/components/skills/types.ts`:

```typescript
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";

export type SkillSource = "official" | "community";

export type CommunitySkillSortOption = "latest" | "popular" | "downloads";

export type SkillDetailItem =
  | { source: "community"; data: CloudSkillPackage }
  | { source: "official"; data: ClawhubSkillDisplay };

export type InstallableSkill = SkillDetailItem;

export interface SkillInstallVisualState {
  isInstalled?: boolean;
  isInstalling?: boolean;
  installProgress?: number;
}
```

- [ ] **Step 4: Create shared display utilities**

Create `/root/viben/apps/desktop/src/components/skills/skill-display-utils.ts`:

```typescript
import type { InstallableSkill, SkillDetailItem } from "./types";

export function formatSkillCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

export function getInstallableSkillId(skill: InstallableSkill): string {
  return skill.data.id;
}

export function getSkillTitle(skill: SkillDetailItem): string {
  return skill.data.name;
}

export function getSkillSlug(skill: SkillDetailItem): string {
  return skill.data.slug;
}

export function toInstallableSkill(skill: SkillDetailItem): InstallableSkill {
  return skill;
}

export function getSkillInitials(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "?";

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}
```

- [ ] **Step 5: Run utility tests and verify they pass**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/skill-display-utils.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add /root/viben/apps/desktop/src/components/skills/types.ts /root/viben/apps/desktop/src/components/skills/skill-display-utils.ts /root/viben/apps/desktop/src/components/skills/skill-display-utils.test.ts
git commit -m "feat(desktop): add shared skill display types"
```

## Task 2: Add ClaWHub Sort Support Without Breaking Agent Dialog

**Files:**
- Modify: `/root/viben/apps/desktop/src/types/clawhub-registry.ts`
- Modify: `/root/viben/apps/desktop/src/hooks/use-clawhub-registry.ts`
- Test: `/root/viben/apps/desktop/src/hooks/use-clawhub-registry.test.tsx`
- Verify: `/root/viben/apps/desktop/src/components/agent/skill-market-grid.tsx`

- [ ] **Step 1: Write failing tests for ClaWHub sort query behavior**

Create `/root/viben/apps/desktop/src/hooks/use-clawhub-registry.test.tsx`:

```typescript
import { act } from "react";
import { waitFor } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClawhubRegistry, useClawhubRegistrySkills } from "./use-clawhub-registry";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fetchMock = vi.fn();

function HookProbe({ onValue }: { onValue: (value: ReturnType<typeof useClawhubRegistry>) => void }) {
  const value = useClawhubRegistry({ limit: 24, fetchOnMount: true });
  onValue(value);
  return null;
}

function SkillsHookProbe({
  onValue,
}: {
  onValue: (value: ReturnType<typeof useClawhubRegistrySkills>) => void;
}) {
  const value = useClawhubRegistrySkills({ limit: 24, enabled: true, sort: "downloads" });
  onValue(value);
  return null;
}

describe("use-clawhub-registry", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            name: "owner/sorted-skill",
            displayName: "Sorted Skill",
            family: "skill",
            channel: "official",
            isOfficial: true,
            executesCode: false,
            latestVersion: "1.0.0",
            createdAt: 1717200000000,
            updatedAt: 1717286400000,
            ownerHandle: "owner",
            stats: { downloads: 10, stars: 5 },
          },
        ],
        nextCursor: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends the configured sort option to ClaWHub package listing", async () => {
    let latest: ReturnType<typeof useClawhubRegistrySkills> | null = null;

    await act(async () => {
      root.render(<SkillsHookProbe onValue={(value) => { latest = value; }} />);
    });

    await waitFor(() => {
      expect(latest?.skills[0]?.name).toBe("Sorted Skill");
    });

    const requestedUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get("family")).toBe("skill");
    expect(requestedUrl.searchParams.get("limit")).toBe("24");
    expect(requestedUrl.searchParams.get("sort")).toBe("downloads");
  });

  it("exposes setSort and currentSort while preserving existing combined hook fields", async () => {
    let latest: ReturnType<typeof useClawhubRegistry> | null = null;

    await act(async () => {
      root.render(<HookProbe onValue={(value) => { latest = value; }} />);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    expect(latest?.currentSort).toBe("updated");
    expect(typeof latest?.setSort).toBe("function");
    expect(Array.isArray(latest?.displaySkills)).toBe(true);
    expect(typeof latest?.refreshSkills).toBe("function");
    expect(typeof latest?.loadMore).toBe("function");

    await act(async () => {
      latest?.setSort("stars");
    });

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls.at(-1);
      expect(lastCall).toBeTruthy();
      const lastUrl = new URL(lastCall![0] as string);
      expect(lastUrl.searchParams.get("sort")).toBe("stars");
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm --filter @viben/desktop test -- --environment jsdom src/hooks/use-clawhub-registry.test.tsx
```

Expected: FAIL because `ClawhubSkillSortOption`, `setSort`, `currentSort`, and package-list `sort` query support are missing.

- [ ] **Step 3: Add the ClaWHub sort type**

Modify `/root/viben/apps/desktop/src/types/clawhub-registry.ts` by adding this type before `ClawhubSkillDisplay`:

```typescript
export type ClawhubSkillSortOption = "updated" | "downloads" | "stars" | "trending";
```

- [ ] **Step 4: Add sort to ClaWHub list options and return type**

Modify the imports and interfaces in `/root/viben/apps/desktop/src/hooks/use-clawhub-registry.ts`:

```typescript
import type {
  ClawhubPackageItem,
  ClawhubPackageListResponse,
  ClawhubSearchResponse,
  ClawhubSkillDisplay,
  ClawhubSkillSortOption,
} from "@/types/clawhub-registry";

export interface UseClawhubRegistrySkillsOptions {
  limit?: number;
  enabled?: boolean;
  sort?: ClawhubSkillSortOption;
}

export interface UseClawhubRegistrySkillsReturn {
  skills: ClawhubSkillDisplay[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  setSort: (sort: ClawhubSkillSortOption) => void;
  currentSort: ClawhubSkillSortOption;
}

export interface UseClawhubRegistryOptions {
  limit?: number;
  searchDebounceMs?: number;
  fetchOnMount?: boolean;
  sort?: ClawhubSkillSortOption;
}
```

- [ ] **Step 5: Implement sort state and package-list query parameter**

Inside `useClawhubRegistrySkills`, replace the options destructuring and add sort state:

```typescript
const { limit = 50, enabled = true, sort: initialSort = "updated" } = options;
const [currentSort, setCurrentSort] = useState<ClawhubSkillSortOption>(initialSort);
const didSortEffectMountRef = useRef(false);
```

Inside `fetchSkills`, after setting `limit`, add:

```typescript
url.searchParams.set("sort", currentSort);
```

Update the `fetchSkills` dependency list:

```typescript
[enabled, limit, currentSort]
```

After the existing `refresh` callback is declared, add a refetch effect and a sort setter before the return. The effect must be below `refresh` so the dependency array does not reference a const before initialization. The setter must not call `fetchSkills` directly because it would use the previous `currentSort` closure value:

```typescript
useEffect(() => {
  if (!didSortEffectMountRef.current) {
    didSortEffectMountRef.current = true;
    return;
  }

  if (enabled) {
    void refresh();
  }
}, [currentSort, enabled, refresh]);

const setSort = useCallback((sort: ClawhubSkillSortOption) => {
  setCurrentSort(sort);
}, []);
```

Return the new fields:

```typescript
return {
  skills,
  loading,
  error,
  hasMore,
  loadMore,
  refresh,
  setSort,
  currentSort,
};
```

- [ ] **Step 6: Expose sort from the combined hook while keeping existing fields**

Modify `useClawhubRegistry` in `/root/viben/apps/desktop/src/hooks/use-clawhub-registry.ts`:

```typescript
export function useClawhubRegistry(options: UseClawhubRegistryOptions = {}) {
  const {
    limit = 50,
    searchDebounceMs = 300,
    fetchOnMount = true,
    sort = "updated",
  } = options;

  const skillsHook = useClawhubRegistrySkills({
    limit,
    enabled: fetchOnMount,
    sort,
  });
```

Add these two fields to the returned object under the skills list section:

```typescript
setSort: skillsHook.setSort,
currentSort: skillsHook.currentSort,
```

Update the re-export at the bottom:

```typescript
export type {
  ClawhubSkillDisplay,
  ClawhubPackageItem,
  ClawhubSkillSortOption,
} from "@/types/clawhub-registry";
```

- [ ] **Step 7: Run ClaWHub tests and verify they pass**

Run:

```bash
pnpm --filter @viben/desktop test -- --environment jsdom src/hooks/use-clawhub-registry.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Typecheck the existing agent skill market dialog**

Run:

```bash
pnpm --filter @viben/desktop typecheck
```

Expected: PASS. If this fails because of pre-existing unrelated errors, stop and record the baseline before continuing; do not mark this task complete with a failing typecheck.

- [ ] **Step 9: Commit**

```bash
git add /root/viben/apps/desktop/src/types/clawhub-registry.ts /root/viben/apps/desktop/src/hooks/use-clawhub-registry.ts /root/viben/apps/desktop/src/hooks/use-clawhub-registry.test.tsx
git commit -m "feat(desktop): support sorted clawhub skills"
```

## Task 3: Add Infinite Community Cloud Skills Hook

**Files:**
- Modify: `/root/viben/apps/desktop/src/hooks/use-cloud-skills.ts`
- Test: `/root/viben/apps/desktop/src/hooks/use-cloud-skills.test.ts`

- [ ] **Step 1: Write failing tests for cloud mapping and infinite pagination helpers**

Create `/root/viben/apps/desktop/src/hooks/use-cloud-skills.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  appendCloudSkillPage,
  mapCloudSkillPackage,
} from "./use-cloud-skills";
import type { CloudSkillPackage, PaginationInfo } from "./use-cloud-skills";

const pagination: PaginationInfo = {
  page: 1,
  limit: 2,
  total: 3,
  totalPages: 2,
};

describe("use-cloud-skills helpers", () => {
  it("maps API package fields with stable fallbacks", () => {
    const mapped = mapCloudSkillPackage({
      id: "pkg-1",
      name: "Package One",
      slug: "package-one",
      version: "1.0.0",
      description: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      skillType: undefined,
      triggerPatterns: undefined,
      tags: undefined,
      repositoryUrl: undefined,
      favoritesCount: undefined,
      downloadsCount: undefined,
      ratingAvg: undefined,
      author: {
        id: "user-1",
        username: "alex",
        displayName: undefined,
        avatarUrl: undefined,
      },
    });

    expect(mapped.skillType).toBe("command");
    expect(mapped.triggerPatterns).toBeNull();
    expect(mapped.tags).toBeNull();
    expect(mapped.repositoryUrl).toBeNull();
    expect(mapped.favoritesCount).toBe(0);
    expect(mapped.downloadsCount).toBe(0);
    expect(mapped.ratingAvg).toBe(0);
    expect(mapped.author?.displayName).toBe("alex");
    expect(mapped.updatedAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("replaces packages on refresh and appends on load more", () => {
    const first: CloudSkillPackage = mapCloudSkillPackage({
      id: "pkg-1",
      name: "One",
      slug: "one",
      version: "1.0.0",
      description: null,
      createdAt: "2026-06-01T00:00:00.000Z",
    });
    const second: CloudSkillPackage = mapCloudSkillPackage({
      id: "pkg-2",
      name: "Two",
      slug: "two",
      version: "1.0.0",
      description: null,
      createdAt: "2026-06-02T00:00:00.000Z",
    });

    expect(appendCloudSkillPage([first], [second], pagination, false)).toEqual({
      packages: [first, second],
      pagination,
      hasMore: true,
    });
    expect(appendCloudSkillPage([first], [second], { ...pagination, total: 2 }, true)).toEqual({
      packages: [second],
      pagination: { ...pagination, total: 2 },
      hasMore: true,
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
pnpm --filter @viben/desktop test -- src/hooks/use-cloud-skills.test.ts
```

Expected: FAIL because `mapCloudSkillPackage` and `appendCloudSkillPage` are not exported.

- [ ] **Step 3: Add cloud sort type and mapper helper**

Modify `/root/viben/apps/desktop/src/hooks/use-cloud-skills.ts` near the type section:

```typescript
export type CloudSkillSortOption = "latest" | "popular" | "downloads";

type CloudSkillApiPackage = {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string | null;
  category?: string | null;
  skillType?: string | null;
  triggerPatterns?: string[] | null;
  tags?: string[] | null;
  repositoryUrl?: string | null;
  favoritesCount?: number | null;
  downloadsCount?: number | null;
  ratingAvg?: number | null;
  author?: {
    id: string;
    username: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
  createdAt: string;
  updatedAt?: string | null;
};

export function mapCloudSkillPackage(pkg: CloudSkillApiPackage): CloudSkillPackage {
  return {
    id: pkg.id,
    name: pkg.name,
    slug: pkg.slug,
    version: pkg.version,
    description: pkg.description,
    category: pkg.category ?? null,
    skillType: pkg.skillType ?? "command",
    triggerPatterns: pkg.triggerPatterns ?? null,
    tags: pkg.tags ?? null,
    repositoryUrl: pkg.repositoryUrl ?? null,
    favoritesCount: pkg.favoritesCount ?? 0,
    downloadsCount: pkg.downloadsCount ?? 0,
    ratingAvg: pkg.ratingAvg ?? 0,
    author: pkg.author
      ? {
          id: pkg.author.id,
          username: pkg.author.username,
          displayName: pkg.author.displayName ?? pkg.author.username,
          avatarUrl: pkg.author.avatarUrl ?? null,
        }
      : null,
    createdAt: pkg.createdAt,
    updatedAt: pkg.updatedAt ?? pkg.createdAt,
  };
}

export function appendCloudSkillPage(
  previous: CloudSkillPackage[],
  next: CloudSkillPackage[],
  pagination: PaginationInfo,
  replace: boolean,
): {
  packages: CloudSkillPackage[];
  pagination: PaginationInfo;
  hasMore: boolean;
} {
  const packages = replace ? next : [...previous, ...next];
  return {
    packages,
    pagination,
    hasMore: packages.length < pagination.total,
  };
}
```

Update `UseCloudSkillPackagesOptions`:

```typescript
export interface UseCloudSkillPackagesOptions {
  page?: number;
  limit?: number;
  category?: string;
  sort?: CloudSkillSortOption;
}
```

- [ ] **Step 4: Replace duplicate mapping in existing list/search/detail hooks**

In `/root/viben/apps/desktop/src/hooks/use-cloud-skills.ts`, replace each inline `response.data.map((pkg) => ({ ... }))` and detail `result` object with `mapCloudSkillPackage(pkg)`.

The list hook mapping becomes:

```typescript
const mappedPackages: CloudSkillPackage[] = response.data.map(mapCloudSkillPackage);
```

The search hook mapping becomes:

```typescript
const mappedResults: CloudSkillPackage[] = response.data.map(mapCloudSkillPackage);
```

The single package detail mapping becomes:

```typescript
const result: CloudSkillPackage = mapCloudSkillPackage(pkg);
```

- [ ] **Step 5: Add the infinite hook**

Add this export after `useCloudSkillPackages` in `/root/viben/apps/desktop/src/hooks/use-cloud-skills.ts`:

```typescript
export function useCloudSkillPackagesInfinite(options: {
  limit?: number;
  sort?: CloudSkillSortOption;
} = {}) {
  const { limit = 24, sort = "popular" } = options;
  const [packages, setPackages] = useState<CloudSkillPackage[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const pageRef = useRef(1);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(
    async (page: number, replace: boolean) => {
      if (loadingRef.current) return;

      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const client = getClient();
        const response = await client.skill.list({
          page,
          limit,
          sort,
        });
        const mappedPackages = response.data.map(mapCloudSkillPackage);

        setPackages((previous) => {
          const nextState = appendCloudSkillPage(
            previous,
            mappedPackages,
            response.pagination,
            replace,
          );
          setPagination(nextState.pagination);
          setHasMore(nextState.hasMore);
          return nextState.packages;
        });
        pageRef.current = page;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [limit, sort],
  );

  useEffect(() => {
    pageRef.current = 1;
    setPackages([]);
    setHasMore(true);
    void fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    await fetchPage(pageRef.current + 1, false);
  }, [fetchPage, hasMore]);

  const refresh = useCallback(async () => {
    pageRef.current = 1;
    setHasMore(true);
    await fetchPage(1, true);
  }, [fetchPage]);

  return {
    packages,
    pagination,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  };
}
```

- [ ] **Step 6: Run cloud hook tests and typecheck**

Run:

```bash
pnpm --filter @viben/desktop test -- src/hooks/use-cloud-skills.test.ts
pnpm --filter @viben/desktop typecheck
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add /root/viben/apps/desktop/src/hooks/use-cloud-skills.ts /root/viben/apps/desktop/src/hooks/use-cloud-skills.test.ts
git commit -m "feat(desktop): add infinite cloud skills hook"
```

## Task 4: Add Unified Skill Installation Hook And ClaWHub Download Path

**Files:**
- Modify: `/root/viben/apps/desktop/src/lib/skill-installer.ts`
- Create: `/root/viben/apps/desktop/src/lib/skill-installer.test.ts`
- Create: `/root/viben/apps/desktop/src/hooks/use-skill-install.ts`
- Create: `/root/viben/apps/desktop/src/hooks/use-skill-install.test.ts`

- [ ] **Step 1: Write failing tests for installer helper and error mapping**

Create `/root/viben/apps/desktop/src/hooks/use-skill-install.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";
import {
  getInstallErrorTranslationKey,
  getSkillInstallId,
} from "./use-skill-install";
import type { InstallFailureInput } from "./use-skill-install";

const communitySkill = {
  id: "cloud-1",
  name: "Cloud Skill",
} as CloudSkillPackage;

const officialSkill = {
  id: "owner/official-skill",
  name: "Official Skill",
} as ClawhubSkillDisplay;

describe("use-skill-install helpers", () => {
  it("uses source-specific skill IDs", () => {
    expect(getSkillInstallId({ source: "community", data: communitySkill })).toBe("cloud-1");
    expect(getSkillInstallId({ source: "official", data: officialSkill })).toBe("owner/official-skill");
  });

  it("maps structured install errors to translation keys", () => {
    const duplicate: InstallFailureInput = { errorCode: "ALREADY_EXISTS", message: "exists" };
    const network: InstallFailureInput = { errorCode: "NETWORK_ERROR", message: "network" };
    const corrupt: InstallFailureInput = { errorCode: "VALIDATION_ERROR", message: "invalid" };

    expect(getInstallErrorTranslationKey(duplicate)).toBe("skillsMarket.installErrorDuplicate");
    expect(getInstallErrorTranslationKey(network)).toBe("skillsMarket.installErrorNetwork");
    expect(getInstallErrorTranslationKey(corrupt)).toBe("skillsMarket.installErrorCorrupt");
  });

  it("maps unstructured install error text to translation keys", () => {
    expect(getInstallErrorTranslationKey({ message: "zip file is invalid" })).toBe("skillsMarket.installErrorCorrupt");
    expect(getInstallErrorTranslationKey({ message: "permission denied" })).toBe("skillsMarket.installErrorPermission");
    expect(getInstallErrorTranslationKey({ message: "fetch failed" })).toBe("skillsMarket.installErrorNetwork");
    expect(getInstallErrorTranslationKey({ message: "unexpected" })).toBe("skillsMarket.installErrorUnknown");
  });
});
```

Create `/root/viben/apps/desktop/src/lib/skill-installer.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadAndInstallClawhubSkill } from "./skill-installer";
import { getGatewayClient } from "./gateway";

const postMock = vi.fn();
const fetchMock = vi.fn();
const mkdirMock = vi.fn();
const writeFileMock = vi.fn();
const removeMock = vi.fn();
const existsMock = vi.fn();

vi.mock("./gateway", () => ({
  getGatewayClient: vi.fn(),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appDataDir: vi.fn().mockResolvedValue("/tmp/viben-data"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  mkdir: (...args: unknown[]) => mkdirMock(...args),
  writeFile: (...args: unknown[]) => writeFileMock(...args),
  exists: (...args: unknown[]) => existsMock(...args),
  remove: (...args: unknown[]) => removeMock(...args),
}));

vi.mock("@/i18n", () => ({
  default: {
    t: (key: string, values?: Record<string, string>) => values?.name ? `${key}:${values.name}` : key,
  },
}));

describe("downloadAndInstallClawhubSkill", () => {
  beforeEach(() => {
    vi.mocked(getGatewayClient).mockReturnValue({ post: postMock } as never);
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);
    existsMock.mockResolvedValue(false);
    postMock.mockResolvedValue({
      success: true,
      name: "owner/official-skill",
      version: "2.0.0",
      path: "/skills/official-skill",
      message: "Installed",
    });
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
  });

  it("downloads the ClaWHub package ZIP and installs through gateway with snake_case body", async () => {
    const result = await downloadAndInstallClawhubSkill({
      slug: "owner/official-skill",
      name: "Official Skill",
      version: "2.0.0",
      force: false,
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clawhub.ai/api/v1/packages/owner%2Fofficial-skill/download?version=2.0.0",
      { headers: { Accept: "application/zip" } },
    );
    expect(writeFileMock).toHaveBeenCalledWith(
      "/tmp/viben-data/temp/owner-official-skill-2.0.0.zip",
      new Uint8Array([1, 2, 3]),
    );
    expect(postMock).toHaveBeenCalledWith("/api/skill/install", {
      name: "owner/official-skill",
      zip_path: "/tmp/viben-data/temp/owner-official-skill-2.0.0.zip",
      force: false,
      version: "2.0.0",
    });
    expect(removeMock).toHaveBeenCalledWith("/tmp/viben-data/temp/owner-official-skill-2.0.0.zip");
  });
});
```

- [ ] **Step 2: Run installer tests and verify they fail**

Run:

```bash
pnpm --filter @viben/desktop test -- src/hooks/use-skill-install.test.ts src/lib/skill-installer.test.ts
```

Expected: FAIL because `use-skill-install.ts` and `downloadAndInstallClawhubSkill` do not exist.

- [ ] **Step 3: Add ClaWHub install options and path sanitizer**

Modify `/root/viben/apps/desktop/src/lib/skill-installer.ts` so `InstallSkillOptions` no longer requires the full `SkillPackage` shape:

```typescript
export type InstallableSkillPackage = Pick<SkillPackage, "id" | "name" | "slug" | "version">;

export interface InstallSkillOptions {
  package: InstallableSkillPackage;
  onProgress?: ProgressCallback;
  force?: boolean;
}
```

Then add the ClaWHub options after `InstallSkillOptions`:

```typescript
export interface InstallClawhubSkillOptions {
  slug: string;
  name: string;
  version: string;
  onProgress?: ProgressCallback;
  force?: boolean;
}

function sanitizeTempFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "skill";
}
```

- [ ] **Step 4: Add `downloadAndInstallClawhubSkill`**

Add this function before `isSkillInstalled`. ClaWHub OpenAPI exposes `/api/v1/packages/{name}/download` as the ZIP archive endpoint; do not use `/api/v1/skills/{slug}/file`, which fetches individual text files by path. Add this in `/root/viben/apps/desktop/src/lib/skill-installer.ts`:

```typescript
export async function downloadAndInstallClawhubSkill(
  options: InstallClawhubSkillOptions,
): Promise<InstallSkillResult> {
  const { slug, name, version, onProgress, force = false } = options;
  let tempZipPath: string | undefined;

  try {
    onProgress?.({
      stage: "downloading",
      progress: 0,
      message: i18n.t("installation.downloading", { name }),
    });

    const response = await fetch(
      `https://clawhub.ai/api/v1/packages/${encodeURIComponent(slug)}/download?version=${encodeURIComponent(version)}`,
      { headers: { Accept: "application/zip" } },
    );

    if (!response.ok) {
      throw new Error(`ClaWHub download failed: ${response.status} ${response.statusText}`);
    }

    onProgress?.({
      stage: "downloading",
      progress: 100,
      message: i18n.t("installation.downloadComplete"),
    });

    const dataDir = await appDataDir();
    const tempDir = await join(dataDir, "temp");

    if (!(await exists(tempDir))) {
      await mkdir(tempDir, { recursive: true });
    }

    tempZipPath = await join(tempDir, `${sanitizeTempFilePart(slug)}-${sanitizeTempFilePart(version)}.zip`);
    const arrayBuffer = await response.arrayBuffer();
    await writeFile(tempZipPath, new Uint8Array(arrayBuffer));

    onProgress?.({
      stage: "extracting",
      progress: 0,
      message: i18n.t("installation.extractingPackage"),
    });

    const result = await getGatewayClient().post<GatewayInstallResponse>(
      "/api/skill/install",
      {
        name: slug,
        zip_path: tempZipPath,
        force,
        version,
      },
    );

    if (!result.success) {
      throw new Error(result.error || "Installation failed");
    }

    onProgress?.({
      stage: "complete",
      progress: 100,
      message: i18n.t("installation.complete"),
    });

    return {
      success: true,
      name: result.name,
      version: result.version,
      path: result.path,
      message: result.message,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : i18n.t("common.unknownError");

    let errorCode: InstallErrorCode = "UNKNOWN_ERROR";
    if (errorMessage.includes("ALREADY_EXISTS")) {
      errorCode = "ALREADY_EXISTS";
    } else if (errorMessage.includes("FILE_CONFLICT")) {
      errorCode = "FILE_CONFLICT";
    } else if (errorMessage.includes("VALIDATION_ERROR")) {
      errorCode = "VALIDATION_ERROR";
    } else if (errorMessage.includes("network") || errorMessage.includes("fetch") || errorMessage.includes("download") || errorMessage.includes("ClaWHub")) {
      errorCode = "NETWORK_ERROR";
    } else if (errorMessage.includes("permission") || errorMessage.includes("access") || errorMessage.includes("EACCES")) {
      errorCode = "PERMISSION_ERROR";
    }

    onProgress?.({
      stage: "error",
      progress: 0,
      message: i18n.t("installation.failed"),
      error: errorMessage,
    });

    return {
      success: false,
      name,
      version,
      path: "",
      message: i18n.t("installation.failed"),
      error: errorMessage,
      errorCode,
    };
  } finally {
    if (tempZipPath) {
      try {
        await remove(tempZipPath);
      } catch {
        // Ignore cleanup failures for temporary installer files.
      }
    }
  }
}
```

- [ ] **Step 5: Create unified install hook**

Create `/root/viben/apps/desktop/src/hooks/use-skill-install.ts`:

```typescript
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import {
  downloadAndInstallClawhubSkill,
  downloadAndInstallSkill,
} from "@/lib/skill-installer";
import type { InstallErrorCode, InstallProgress, InstallSkillResult } from "@/lib/skill-installer";
import type { InstallableSkill } from "@/components/skills/types";

export interface InstallFailureInput {
  errorCode?: InstallErrorCode;
  message: string;
}

export function getSkillInstallId(skill: InstallableSkill): string {
  return skill.data.id;
}

export function getInstallErrorTranslationKey(error: InstallFailureInput): string {
  switch (error.errorCode) {
    case "ALREADY_EXISTS":
    case "FILE_CONFLICT":
      return "skillsMarket.installErrorDuplicate";
    case "VALIDATION_ERROR":
      return "skillsMarket.installErrorCorrupt";
    case "NETWORK_ERROR":
      return "skillsMarket.installErrorNetwork";
    case "PERMISSION_ERROR":
      return "skillsMarket.installErrorPermission";
    default:
      break;
  }

  const message = error.message.toLowerCase();
  if (message.includes("already exists") || message.includes("duplicate")) {
    return "skillsMarket.installErrorDuplicate";
  }
  if (message.includes("corrupt") || message.includes("invalid") || message.includes("zip")) {
    return "skillsMarket.installErrorCorrupt";
  }
  if (message.includes("network") || message.includes("fetch") || message.includes("download")) {
    return "skillsMarket.installErrorNetwork";
  }
  if (message.includes("permission") || message.includes("access")) {
    return "skillsMarket.installErrorPermission";
  }
  return "skillsMarket.installErrorUnknown";
}

export function useSkillInstall() {
  const { t } = useTranslation();
  const [installingIds, setInstallingIds] = useState<Set<string>>(new Set());
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [installProgress, setInstallProgress] = useState<
    Map<string, { stage: string; progress: number; message?: string }>
  >(new Map());

  const setProgress = useCallback((id: string, progress: InstallProgress) => {
    setInstallProgress((previous) => {
      const next = new Map(previous);
      next.set(id, {
        stage: progress.stage,
        progress: progress.progress,
        message: progress.message,
      });
      return next;
    });
  }, []);

  const install = useCallback(
    async (skill: InstallableSkill) => {
      const id = getSkillInstallId(skill);
      setInstallingIds((previous) => new Set(previous).add(id));

      try {
        let result: InstallSkillResult;
        if (skill.source === "community") {
          result = await downloadAndInstallSkill({
            package: {
              id: skill.data.id,
              name: skill.data.name,
              slug: skill.data.slug,
              version: skill.data.version,
            },
            onProgress: (progress) => setProgress(id, progress),
            force: false,
          });
        } else {
          result = await downloadAndInstallClawhubSkill({
            slug: skill.data.slug,
            name: skill.data.name,
            version: skill.data.version,
            onProgress: (progress) => setProgress(id, progress),
            force: false,
          });
        }

        if (result.success) {
          setInstalledIds((previous) => new Set(previous).add(id));
          toast.success(t("skillsMarket.installSuccess"), {
            description: t("skillsMarket.installSuccessDescription", {
              name: skill.data.name,
              version: skill.data.version,
            }),
          });
          return;
        }

        const key = getInstallErrorTranslationKey({
          errorCode: result.errorCode,
          message: result.error ?? result.message,
        });
        toast.error(t("skillsMarket.installError"), {
          description: t(key, { name: skill.data.name }),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const key = getInstallErrorTranslationKey({ message });
        toast.error(t("skillsMarket.installError"), {
          description: t(key, { name: skill.data.name }),
        });
      } finally {
        setInstallingIds((previous) => {
          const next = new Set(previous);
          next.delete(id);
          return next;
        });
        window.setTimeout(() => {
          setInstallProgress((previous) => {
            const next = new Map(previous);
            next.delete(id);
            return next;
          });
        }, 2000);
      }
    },
    [setProgress, t],
  );

  const isInstalling = useCallback((id: string) => installingIds.has(id), [installingIds]);
  const isInstalled = useCallback((id: string) => installedIds.has(id), [installedIds]);
  const getProgress = useCallback(
    (id: string) => installProgress.get(id)?.progress ?? 0,
    [installProgress],
  );

  return {
    installingIds,
    installedIds,
    installProgress,
    install,
    isInstalling,
    isInstalled,
    getProgress,
  };
}
```

- [ ] **Step 6: Run installer tests and typecheck**

Run:

```bash
pnpm --filter @viben/desktop test -- src/hooks/use-skill-install.test.ts src/lib/skill-installer.test.ts
pnpm --filter @viben/desktop typecheck
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add /root/viben/apps/desktop/src/lib/skill-installer.ts /root/viben/apps/desktop/src/lib/skill-installer.test.ts /root/viben/apps/desktop/src/hooks/use-skill-install.ts /root/viben/apps/desktop/src/hooks/use-skill-install.test.ts
git commit -m "feat(desktop): add unified skill installer"
```

## Task 5: Add Source Tabs And Source Badge

**Files:**
- Create: `/root/viben/apps/desktop/src/components/skills/skill-source-tabs.tsx`
- Test: `/root/viben/apps/desktop/src/components/skills/skill-source-tabs.test.tsx`

- [ ] **Step 1: Write failing component tests**

Create `/root/viben/apps/desktop/src/components/skills/skill-source-tabs.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillSourceBadge, SkillSourceTabs } from "./skill-source-tabs";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

describe("SkillSourceTabs", () => {
  it("renders official and community tabs and emits source changes", () => {
    const onSourceChange = vi.fn();

    render(
      <SkillSourceTabs source="official" onSourceChange={onSourceChange} />,
    );

    expect(screen.getByRole("tab", { name: /Official/i }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: /Community/i }));

    expect(onSourceChange).toHaveBeenCalledWith("community");
  });

  it("renders source badges", () => {
    render(
      <div>
        <SkillSourceBadge source="official" />
        <SkillSourceBadge source="community" />
      </div>,
    );

    expect(screen.getByText("Official")).toBeTruthy();
    expect(screen.getByText("Community")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run source tab tests and verify they fail**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/skill-source-tabs.test.tsx
```

Expected: FAIL because `/root/viben/apps/desktop/src/components/skills/skill-source-tabs.tsx` does not exist.

- [ ] **Step 3: Create desktop source tabs**

Create `/root/viben/apps/desktop/src/components/skills/skill-source-tabs.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { Globe, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { SkillSource } from "./types";

interface SkillSourceTabsProps {
  source: SkillSource;
  onSourceChange: (source: SkillSource) => void;
  className?: string;
}

export function SkillSourceTabs({
  source,
  onSourceChange,
  className,
}: SkillSourceTabsProps) {
  const { t } = useTranslation();

  return (
    <Tabs
      value={source}
      onValueChange={(value) => onSourceChange(value as SkillSource)}
      className={cn("w-full", className)}
    >
      <TabsList className="grid w-full max-w-[400px] grid-cols-2">
        <TabsTrigger
          value="official"
          className={cn(
            "flex items-center gap-2",
            source === "official" && "border-primary text-primary",
          )}
        >
          <Globe className="h-4 w-4" />
          <span>{t("skillsMarket.officialTab", "Official")}</span>
        </TabsTrigger>
        <TabsTrigger
          value="community"
          className={cn(
            "flex items-center gap-2",
            source === "community" && "border-primary text-primary",
          )}
        >
          <Users className="h-4 w-4" />
          <span>{t("skillsMarket.communityTab", "Community")}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

interface SkillSourceBadgeProps {
  source: SkillSource;
  className?: string;
}

export function SkillSourceBadge({ source, className }: SkillSourceBadgeProps) {
  const { t } = useTranslation();

  return (
    <Badge
      variant={source === "official" ? "default" : "secondary"}
      className={cn(
        "text-[10px] shrink-0",
        source === "official" && "bg-primary/10 text-primary border-primary/20",
        source === "community" && "bg-secondary text-secondary-foreground border-secondary",
        className,
      )}
    >
      {source === "official"
        ? t("skillsMarket.officialBadge", "Official")
        : t("skillsMarket.communityTab", "Community")}
    </Badge>
  );
}
```

- [ ] **Step 4: Run source tab tests**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/skill-source-tabs.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add /root/viben/apps/desktop/src/components/skills/skill-source-tabs.tsx /root/viben/apps/desktop/src/components/skills/skill-source-tabs.test.tsx
git commit -m "feat(desktop): add skill source tabs"
```

## Task 6: Add Official And Community Skill Cards

**Files:**
- Create: `/root/viben/apps/desktop/src/components/skills/official-skill-card.tsx`
- Test: `/root/viben/apps/desktop/src/components/skills/official-skill-card.test.tsx`
- Create: `/root/viben/apps/desktop/src/components/skills/community-skill-card.tsx`
- Keep: `/root/viben/apps/desktop/src/components/skills/skill-card.tsx` unchanged until Task 9 removes old imports
- Test: `/root/viben/apps/desktop/src/components/skills/community-skill-card.test.tsx`

- [ ] **Step 1: Write failing tests for Official card**

Create `/root/viben/apps/desktop/src/components/skills/official-skill-card.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfficialSkillCard } from "./official-skill-card";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const skill: ClawhubSkillDisplay = {
  id: "owner/official-skill",
  name: "Official Skill",
  slug: "owner/official-skill",
  version: "2.0.0",
  description: "Official description",
  ownerHandle: "owner",
  ownerName: "Owner Team",
  ownerAvatar: null,
  isOfficial: true,
  executesCode: true,
  channel: "official",
  downloads: 1200,
  stars: 42,
  createdAt: 1717200000000,
  updatedAt: 1717286400000,
};

describe("OfficialSkillCard", () => {
  it("renders official metadata and stats", () => {
    render(
      <OfficialSkillCard
        skill={skill}
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText("Official Skill")).toBeTruthy();
    expect(screen.getByText("v2.0.0")).toBeTruthy();
    expect(screen.getByText("owner/official-skill")).toBeTruthy();
    expect(screen.getByText("1.2K")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Owner Team")).toBeTruthy();
  });

  it("separates detail click from install click", () => {
    const onViewDetails = vi.fn();
    const onInstall = vi.fn();

    render(
      <OfficialSkillCard
        skill={skill}
        onViewDetails={onViewDetails}
        onInstall={onInstall}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Install/i }));
    expect(onInstall).toHaveBeenCalledWith({ source: "official", data: skill });
    expect(onViewDetails).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Official Skill"));
    expect(onViewDetails).toHaveBeenCalledWith({ source: "official", data: skill });
  });
});
```

- [ ] **Step 2: Write failing tests for Community card**

Create `/root/viben/apps/desktop/src/components/skills/community-skill-card.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommunitySkillCard } from "./community-skill-card";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const skill: CloudSkillPackage = {
  id: "cloud-1",
  name: "Community Skill",
  slug: "community-skill",
  version: "1.0.0",
  description: "Community description",
  category: "workflow",
  skillType: "automation",
  triggerPatterns: ["run community", "/community", "third pattern"],
  tags: ["workflow", "desktop"],
  repositoryUrl: "https://example.com/repo",
  favoritesCount: 8,
  downloadsCount: 900,
  ratingAvg: 4.7,
  author: {
    id: "author-1",
    username: "sam",
    displayName: "Sam Dev",
    avatarUrl: null,
  },
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-02T00:00:00.000Z",
};

describe("CommunitySkillCard", () => {
  it("renders community metadata, triggers, and author fallback", () => {
    render(
      <CommunitySkillCard
        skill={skill}
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText("Community Skill")).toBeTruthy();
    expect(screen.getByText("automation")).toBeTruthy();
    expect(screen.getByText("run community")).toBeTruthy();
    expect(screen.getByText("/community")).toBeTruthy();
    expect(screen.getByText("Sam Dev")).toBeTruthy();
  });

  it("separates detail click from install click", () => {
    const onViewDetails = vi.fn();
    const onInstall = vi.fn();

    render(
      <CommunitySkillCard
        skill={skill}
        onViewDetails={onViewDetails}
        onInstall={onInstall}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Install/i }));
    expect(onInstall).toHaveBeenCalledWith({ source: "community", data: skill });
    expect(onViewDetails).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("Community Skill"));
    expect(onViewDetails).toHaveBeenCalledWith({ source: "community", data: skill });
  });
});
```

- [ ] **Step 3: Run card tests and verify they fail**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/official-skill-card.test.tsx src/components/skills/community-skill-card.test.tsx
```

Expected: FAIL because the new card files do not exist.

- [ ] **Step 4: Create Official card**

Create `/root/viben/apps/desktop/src/components/skills/official-skill-card.tsx` with these exports:

```tsx
import React, { memo, useCallback } from "react";
import { Check, Download, ExternalLink, Loader2, Sparkles, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";
import { formatSkillCount, getSkillInitials } from "./skill-display-utils";
import { SkillSourceBadge } from "./skill-source-tabs";
import type { InstallableSkill, SkillDetailItem, SkillInstallVisualState } from "./types";

interface OfficialSkillCardProps extends SkillInstallVisualState {
  skill: ClawhubSkillDisplay;
  onViewDetails: (skill: SkillDetailItem) => void;
  onInstall?: (skill: InstallableSkill) => void;
}

export const OfficialSkillCard = memo(function OfficialSkillCard({
  skill,
  onViewDetails,
  isInstalled = false,
  isInstalling = false,
  installProgress = 0,
  onInstall,
}: OfficialSkillCardProps) {
  const { t } = useTranslation();
  const detailItem: SkillDetailItem = { source: "official", data: skill };

  const handleViewDetails = useCallback(() => {
    onViewDetails(detailItem);
  }, [detailItem, onViewDetails]);

  const handleInstall = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!isInstalled && !isInstalling) {
        onInstall?.(detailItem);
      }
    },
    [detailItem, isInstalled, isInstalling, onInstall],
  );

  const handleOpenClawhub = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      window.open(`https://clawhub.ai/skills/${encodeURIComponent(skill.slug)}`, "_blank", "noopener,noreferrer");
    },
    [skill.slug],
  );

  const handleCardKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleViewDetails();
    }
  }, [handleViewDetails]);

  return (
    <div
      className={cn(
        "group flex h-full min-h-[248px] cursor-pointer flex-col rounded-lg border bg-card p-4",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
      )}
      onClick={handleViewDetails}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold group-hover:text-primary">{skill.name}</h3>
              <SkillSourceBadge source="official" />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">v{skill.version}</p>
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[40px] text-sm text-muted-foreground">
        {skill.description || t("skillsMarket.noDescription")}
      </p>

      <code className="mt-2 block truncate rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
        {skill.slug}
      </code>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {formatSkillCount(skill.downloads)}
        </span>
        <span className="flex items-center gap-1">
          <Star className="h-3 w-3" />
          {formatSkillCount(skill.stars)}
        </span>
      </div>

      {skill.ownerHandle && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar size="sm" className="h-5 w-5">
            <AvatarImage src={skill.ownerAvatar ?? undefined} alt={skill.ownerName ?? skill.ownerHandle} />
            <AvatarFallback>{getSkillInitials(skill.ownerName ?? skill.ownerHandle)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{skill.ownerName ?? skill.ownerHandle}</span>
        </div>
      )}

      <div className="mt-auto pt-3">
        {isInstalling && (
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("skillsMarket.installing")}</span>
              <span className="font-mono">{installProgress}%</span>
            </div>
            <Progress value={installProgress} className="h-1.5" />
          </div>
        )}

        <div className="flex items-center gap-2 border-t pt-3">
          <Button variant="ghost" size="sm" onClick={handleOpenClawhub} className="h-8 px-2 text-xs">
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            ClaWHub
          </Button>
          <div className="flex-1" />
          {onInstall && (
            <Button
              variant={isInstalled ? "outline" : "default"}
              size="sm"
              onClick={handleInstall}
              disabled={isInstalling}
              className="h-8 text-xs"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  {t("common.loading")}
                </>
              ) : isInstalled ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {t("common.installed")}
                </>
              ) : (
                <>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  {t("skillsMarket.install")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

export function OfficialSkillCardSkeleton() {
  return (
    <div className="min-h-[248px] animate-pulse rounded-lg border bg-card p-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-16 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
      <div className="mt-3 h-6 w-40 rounded bg-muted" />
      <div className="mt-4 flex gap-3">
        <div className="h-3 w-12 rounded bg-muted" />
        <div className="h-3 w-12 rounded bg-muted" />
      </div>
      <div className="mt-12 h-8 w-full rounded bg-muted" />
    </div>
  );
}
```

- [ ] **Step 5: Create Community card without breaking existing imports**

Create `/root/viben/apps/desktop/src/components/skills/community-skill-card.tsx`. Do not move or delete `/root/viben/apps/desktop/src/components/skills/skill-card.tsx` in this task because the existing page and barrel still import it until Task 9.


```tsx
import React, { memo, useCallback } from "react";
import {
  Check,
  Download,
  ExternalLink,
  Loader2,
  Star,
  Tag,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import { formatSkillCount, getSkillInitials } from "./skill-display-utils";
import type { InstallableSkill, SkillDetailItem, SkillInstallVisualState } from "./types";

function getSkillTypeBadgeVariant(skillType: string) {
  switch (skillType) {
    case "automation":
      return "default";
    case "analysis":
      return "secondary";
    case "generation":
      return "success";
    default:
      return "outline";
  }
}

interface CommunitySkillCardProps extends SkillInstallVisualState {
  skill: CloudSkillPackage;
  onViewDetails: (skill: SkillDetailItem) => void;
  onInstall?: (skill: InstallableSkill) => void;
}

export const CommunitySkillCard = memo(function CommunitySkillCard({
  skill,
  onViewDetails,
  isInstalled = false,
  isInstalling = false,
  installProgress = 0,
  onInstall,
}: CommunitySkillCardProps) {
  const { t } = useTranslation();
  const detailItem: SkillDetailItem = { source: "community", data: skill };

  const handleViewDetails = useCallback(() => {
    onViewDetails(detailItem);
  }, [detailItem, onViewDetails]);

  const handleInstall = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!isInstalled && !isInstalling) {
        onInstall?.(detailItem);
      }
    },
    [detailItem, isInstalled, isInstalling, onInstall],
  );

  const handleOpenRepo = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (skill.repositoryUrl) {
        window.open(skill.repositoryUrl, "_blank", "noopener,noreferrer");
      }
    },
    [skill.repositoryUrl],
  );

  const authorName = skill.author?.displayName || skill.author?.username || null;

  const handleCardKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleViewDetails();
    }
  }, [handleViewDetails]);

  return (
    <div
      className={cn(
        "group flex h-full min-h-[248px] cursor-pointer flex-col rounded-lg border bg-card p-4",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg",
      )}
      onClick={handleViewDetails}
      onKeyDown={handleCardKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              isInstalled
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-primary/10 text-primary",
            )}
          >
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold group-hover:text-primary">{skill.name}</h3>
              <Badge variant={getSkillTypeBadgeVariant(skill.skillType)}>{skill.skillType}</Badge>
            </div>
            <p className="mt-1 line-clamp-2 min-h-[36px] text-xs text-muted-foreground">
              {skill.description || t("skillsMarket.noDescription")}
            </p>
          </div>
        </div>
      </div>

      {skill.triggerPatterns && skill.triggerPatterns.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {skill.triggerPatterns.slice(0, 2).map((pattern) => (
            <code
              key={pattern}
              className="max-w-[160px] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
            >
              {pattern}
            </code>
          ))}
          {skill.triggerPatterns.length > 2 && (
            <span className="text-xs text-muted-foreground">
              +{skill.triggerPatterns.length - 2} {t("common.more")}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {skill.ratingAvg > 0 && (
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {skill.ratingAvg.toFixed(1)}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Download className="h-3 w-3" />
          {formatSkillCount(skill.downloadsCount)}
        </span>
        <span className="font-mono">v{skill.version}</span>
      </div>

      {authorName && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar size="sm" className="h-5 w-5">
            <AvatarImage src={skill.author?.avatarUrl ?? undefined} alt={authorName} />
            <AvatarFallback>{getSkillInitials(authorName)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{authorName}</span>
        </div>
      )}

      {skill.tags && skill.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <Tag className="h-3 w-3 text-muted-foreground" />
          {skill.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded bg-muted/50 px-1.5 py-0.5 text-xs">
              {tag}
            </span>
          ))}
          {skill.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{skill.tags.length - 3}</span>
          )}
        </div>
      )}

      <div className="mt-auto pt-3">
        {isInstalling && (
          <div className="mb-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t("skillsMarket.installing")}</span>
              <span className="font-mono">{installProgress}%</span>
            </div>
            <Progress value={installProgress} className="h-1.5" />
          </div>
        )}

        <div className="flex items-center gap-2 border-t pt-3">
          {skill.repositoryUrl && (
            <Button variant="ghost" size="sm" onClick={handleOpenRepo} className="h-8 px-2 text-xs">
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              {t("skillsMarket.repository")}
            </Button>
          )}
          <div className="flex-1" />
          {onInstall && (
            <Button
              variant={isInstalled ? "outline" : "default"}
              size="sm"
              onClick={handleInstall}
              disabled={isInstalling}
              className="h-8 text-xs"
            >
              {isInstalling ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  {t("common.loading")}
                </>
              ) : isInstalled ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {t("common.installed")}
                </>
              ) : (
                <>
                  <Download className="mr-1 h-3.5 w-3.5" />
                  {t("skillsMarket.install")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
});

export function CommunitySkillCardSkeleton() {
  return (
    <div className="min-h-[248px] animate-pulse rounded-lg border bg-card p-4">
      <div className="flex gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-3 w-2/3 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="h-5 w-20 rounded bg-muted" />
      </div>
      <div className="mt-4 flex gap-3">
        <div className="h-3 w-12 rounded bg-muted" />
        <div className="h-3 w-12 rounded bg-muted" />
        <div className="h-3 w-12 rounded bg-muted" />
      </div>
      <div className="mt-12 h-8 w-full rounded bg-muted" />
    </div>
  );
}
```

- [ ] **Step 6: Run card tests and typecheck**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/official-skill-card.test.tsx src/components/skills/community-skill-card.test.tsx
pnpm --filter @viben/desktop typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add /root/viben/apps/desktop/src/components/skills/official-skill-card.tsx /root/viben/apps/desktop/src/components/skills/official-skill-card.test.tsx /root/viben/apps/desktop/src/components/skills/community-skill-card.tsx /root/viben/apps/desktop/src/components/skills/community-skill-card.test.tsx
git commit -m "feat(desktop): add redesigned skill cards"
```

## Task 7: Rewrite Skill Detail For Official And Community Items

**Files:**
- Modify: `/root/viben/apps/desktop/src/components/skills/skill-detail.tsx`
- Test: `/root/viben/apps/desktop/src/components/skills/skill-detail.test.tsx`

- [ ] **Step 1: Write failing detail dialog tests**

Create `/root/viben/apps/desktop/src/components/skills/skill-detail.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillDetail } from "./skill-detail";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

const official: ClawhubSkillDisplay = {
  id: "owner/official-skill",
  name: "Official Skill",
  slug: "owner/official-skill",
  version: "2.0.0",
  description: "Official description",
  ownerHandle: "owner",
  ownerName: "Owner Team",
  ownerAvatar: null,
  isOfficial: true,
  executesCode: true,
  channel: "official",
  downloads: 1200,
  stars: 42,
  createdAt: 1717200000000,
  updatedAt: 1717286400000,
};

const community: CloudSkillPackage = {
  id: "cloud-1",
  name: "Community Skill",
  slug: "community-skill",
  version: "1.0.0",
  description: "Community description",
  category: "workflow",
  skillType: "automation",
  triggerPatterns: ["run community"],
  tags: ["workflow"],
  repositoryUrl: null,
  favoritesCount: 8,
  downloadsCount: 900,
  ratingAvg: 4.7,
  author: { id: "a1", username: "sam", displayName: "Sam Dev", avatarUrl: null },
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-02T00:00:00.000Z",
};

describe("SkillDetail", () => {
  it("renders official metadata and code execution warning", () => {
    render(
      <SkillDetail
        skill={{ source: "official", data: official }}
        open
        onOpenChange={vi.fn()}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText("Official Skill")).toBeTruthy();
    expect(screen.getByText("Official")).toBeTruthy();
    expect(screen.getByText("Owner Team")).toBeTruthy();
    expect(screen.getByText("Downloads: 1.2K")).toBeTruthy();
    expect(screen.getByText("Stars: 42")).toBeTruthy();
    expect(screen.getByText("This skill executes code")).toBeTruthy();
  });

  it("renders community metadata and trigger patterns", () => {
    render(
      <SkillDetail
        skill={{ source: "community", data: community }}
        open
        onOpenChange={vi.fn()}
        onInstall={vi.fn()}
      />,
    );

    expect(screen.getByText("Community Skill")).toBeTruthy();
    expect(screen.getByText("automation")).toBeTruthy();
    expect(screen.getByText("run community")).toBeTruthy();
    expect(screen.getByText("Sam Dev")).toBeTruthy();
    expect(screen.getByText("Rating: 4.7")).toBeTruthy();
    expect(screen.getByText("Downloads: 900")).toBeTruthy();
    expect(screen.getByText("Favorites: 8")).toBeTruthy();
  });

  it("copies slug and installs the selected item", () => {
    const onInstall = vi.fn();
    render(
      <SkillDetail
        skill={{ source: "official", data: official }}
        open
        onOpenChange={vi.fn()}
        onInstall={onInstall}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("owner/official-skill");

    fireEvent.click(screen.getByRole("button", { name: /Install/i }));
    expect(onInstall).toHaveBeenCalledWith({ source: "official", data: official });
  });
});
```

- [ ] **Step 2: Run detail tests and verify they fail**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/skill-detail.test.tsx
```

Expected: FAIL because `SkillDetail` only accepts `CloudSkillPackage`.

- [ ] **Step 3: Rewrite `SkillDetail` props**

Modify `/root/viben/apps/desktop/src/components/skills/skill-detail.tsx` so the public props become:

```typescript
interface SkillDetailProps {
  skill: SkillDetailItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isInstalled?: boolean;
  isInstalling?: boolean;
  installProgress?: number;
  onInstall?: (skill: InstallableSkill) => void;
}
```

Use imports:

```typescript
import { useState } from "react";
import { Calendar, Check, Copy, ExternalLink, Tag, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InstallableSkill, SkillDetailItem } from "./types";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { formatSkillCount, getSkillInitials, getSkillSlug } from "./skill-display-utils";
import { SkillSourceBadge } from "./skill-source-tabs";
```

- [ ] **Step 4: Add source-specific rendering branches**

Inside `SkillDetail`, derive source-specific fields:

```typescript
const [copied, setCopied] = useState(false);
const { t } = useTranslation();

if (!skill) return null;

const source = skill.source;
const slug = getSkillSlug(skill);
const data = skill.data;
const description = data.description || t("skillsMarket.noDescription");
const downloads = skill.source === "official" ? skill.data.downloads : skill.data.downloadsCount;
const version = data.version;

const formatDate = (value: string | number) => {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const handleCopySlug = async () => {
  try {
    await navigator.clipboard.writeText(slug);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  } catch {
    // Ignore clipboard failures; install and detail viewing still work.
  }
};
```

Render these shared sections:

```tsx
<DialogTitle className="text-xl">{data.name}</DialogTitle>
<SkillSourceBadge source={source} />
<DialogDescription className="mt-1">{description}</DialogDescription>
<div className="mt-2 flex items-center gap-2">
  <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{slug}</code>
  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7"
    aria-label={t("common.copy", "Copy")}
    onClick={handleCopySlug}
  >
    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
  </Button>
</div>
```

Render the shared stats row under the header:

```tsx
<div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
  <div>{t("skillsMarket.downloads", "Downloads")}: {formatSkillCount(downloads)}</div>
  {skill.source === "official" && (
    <div>{t("skillsMarket.stars", "Stars")}: {formatSkillCount(skill.data.stars)}</div>
  )}
  {skill.source === "community" && skill.data.ratingAvg > 0 && (
    <div>{t("skillsMarket.rating", "Rating")}: {skill.data.ratingAvg.toFixed(1)}</div>
  )}
  {skill.source === "community" && (
    <div>{t("skillsMarket.favorites", "Favorites")}: {formatSkillCount(skill.data.favoritesCount)}</div>
  )}
  <div>v{version}</div>
</div>
```

Render official-only sections:

```tsx
{skill.source === "official" && (() => {
  const data = skill.data;
  return (
  <>
    {data.executesCode && (
      <section className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
        {t("skillsMarket.executesCodeWarning", "This skill executes code")}
      </section>
    )}
    <section>
      <h4 className="mb-2 text-sm font-medium">{t("skillsMarket.author")}</h4>
      <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {getSkillInitials(data.ownerName ?? data.ownerHandle)}
        </div>
        <div>
          <p className="text-sm font-medium">{data.ownerName ?? data.ownerHandle ?? "ClaWHub"}</p>
          {data.ownerHandle && <p className="text-xs text-muted-foreground">@{data.ownerHandle}</p>}
        </div>
      </div>
    </section>
    <section>
      <h4 className="mb-2 text-sm font-medium">{t("skillsMarket.metadata")}</h4>
      <div className="space-y-2 text-sm text-muted-foreground">
        <div>{t("skillsMarket.channel", "Channel")}: {data.channel}</div>
        <div>{t("skillsMarket.downloads", "Downloads")}: {formatSkillCount(data.downloads)}</div>
        <div>{t("skillsMarket.stars", "Stars")}: {formatSkillCount(data.stars)}</div>
      </div>
    </section>
  </>
  );
})()}
```

Render community-only sections with this branch:

```tsx
{skill.source === "community" && (() => {
  const data = skill.data;
  return (
  <>
    {data.author && (
      <section>
        <h4 className="mb-2 text-sm font-medium">{t("skillsMarket.author")}</h4>
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">{data.author.displayName || data.author.username}</p>
            <p className="text-xs text-muted-foreground">@{data.author.username}</p>
          </div>
        </div>
      </section>
    )}
    {data.triggerPatterns && data.triggerPatterns.length > 0 && (
      <section>
        <h4 className="mb-2 text-sm font-medium">{t("skillsMarket.triggerPatterns")}</h4>
        <div className="space-y-2">
          {data.triggerPatterns.map((pattern) => (
            <code key={pattern} className="block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">
              {pattern}
            </code>
          ))}
        </div>
      </section>
    )}
    {data.tags && data.tags.length > 0 && (
      <section>
        <h4 className="mb-2 text-sm font-medium">{t("skillsMarket.tags")}</h4>
        <div className="flex flex-wrap gap-2">
          {data.tags.map((tag) => (
            <span key={tag} className="flex items-center gap-1 rounded bg-muted px-2.5 py-1 text-xs">
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
        </div>
      </section>
    )}
    {data.category && (
      <section>
        <h4 className="mb-2 text-sm font-medium">{t("skillsMarket.category")}</h4>
        <Badge variant="outline">{data.category}</Badge>
      </section>
    )}
    {data.repositoryUrl && (
      <section>
        <h4 className="mb-2 text-sm font-medium">{t("skillsMarket.links")}</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(data.repositoryUrl!, "_blank", "noopener,noreferrer")}
          className="h-8"
        >
          <ExternalLink className="mr-2 h-3.5 w-3.5" />
          {t("skillsMarket.repository")}
        </Button>
      </section>
    )}
    <section>
      <h4 className="mb-2 text-sm font-medium">{t("skillsMarket.metadata")}</h4>
      <div className="space-y-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>{t("skillsMarket.createdAt")}: {formatDate(data.createdAt)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>{t("skillsMarket.updatedAt")}: {formatDate(data.updatedAt)}</span>
        </div>
      </div>
    </section>
  </>
  );
})()}
```

- [ ] **Step 5: Wire install progress into the footer**

Add progress above footer actions:

```tsx
{isInstalling && (
  <div className="px-6 pb-3">
    <Progress value={installProgress} className="h-1.5" />
  </div>
)}
```

Install button callback:

```typescript
onClick={() => {
  if (!isInstalled && !isInstalling && skill) {
    onInstall?.(skill);
  }
}}
```

- [ ] **Step 6: Run detail tests**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/skill-detail.test.tsx
```

Expected: PASS. Do not run full desktop typecheck in this task: the existing `skills-market.tsx` page still consumes the old `SkillDetail` API until Task 9 rewrites the page. Full typecheck is restored in Task 9.

- [ ] **Step 7: Commit**

Do not commit this task yet. The old `/root/viben/apps/desktop/src/pages/skills-market.tsx` still consumes the old `SkillDetail` API until Task 9. Leave these edits in the worktree and commit them with Task 9 after the page is rewritten and full desktop typecheck passes.

## Task 8: Add Infinite Grid Components

**Files:**
- Create: `/root/viben/apps/desktop/src/components/skills/skill-grid-states.tsx`
- Create: `/root/viben/apps/desktop/src/components/skills/official-skill-grid.tsx`
- Create: `/root/viben/apps/desktop/src/components/skills/community-skill-grid.tsx`
- Test: `/root/viben/apps/desktop/src/components/skills/official-skill-grid.test.tsx`
- Test: `/root/viben/apps/desktop/src/components/skills/community-skill-grid.test.tsx`

- [ ] **Step 1: Create shared grid states**

Create `/root/viben/apps/desktop/src/components/skills/skill-grid-states.tsx`:

```tsx
import type { ReactNode } from "react";
import { AlertCircle, Package, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SkillGridErrorProps {
  error: string;
  onRetry: () => void;
  className?: string;
}

export function SkillGridError({ error, onRetry, className }: SkillGridErrorProps) {
  const { t } = useTranslation();

  return (
    <div className={cn("rounded-lg border border-destructive/30 bg-destructive/10 p-4", className)}>
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="flex-1">{error}</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {t("common.retry")}
        </Button>
      </div>
    </div>
  );
}

interface SkillGridEmptyProps {
  title: string;
  description: string;
  className?: string;
}

export function SkillGridEmpty({ title, description, className }: SkillGridEmptyProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 text-center text-muted-foreground", className)}>
      <Package className="mb-4 h-12 w-12 opacity-50" />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="mt-1 text-sm">{description}</p>
    </div>
  );
}

export function SkillGridShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4", className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create Official infinite grid**

Create `/root/viben/apps/desktop/src/components/skills/official-skill-grid.tsx`:

```tsx
import { useCallback, useEffect, useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClawhubRegistry } from "@/hooks/use-clawhub-registry";
import { cn } from "@/lib/utils";
import type { ClawhubSkillSortOption } from "@/types/clawhub-registry";
import { OfficialSkillCard, OfficialSkillCardSkeleton } from "./official-skill-card";
import { SkillGridEmpty, SkillGridError, SkillGridShell } from "./skill-grid-states";
import type { InstallableSkill, SkillDetailItem } from "./types";

const SORT_OPTIONS: Array<{ value: ClawhubSkillSortOption; labelKey: string; label: string }> = [
  { value: "updated", labelKey: "skillsMarket.sort.updated", label: "Recently Updated" },
  { value: "downloads", labelKey: "skillsMarket.sort.downloads", label: "Most Downloads" },
  { value: "stars", labelKey: "skillsMarket.sort.stars", label: "Most Stars" },
  { value: "trending", labelKey: "skillsMarket.sort.trending", label: "Trending" },
];

interface OfficialSkillGridProps {
  searchQuery: string;
  onViewDetails: (skill: SkillDetailItem) => void;
  onInstall: (skill: InstallableSkill) => void;
  isInstalled: (id: string) => boolean;
  isInstalling: (id: string) => boolean;
  getProgress: (id: string) => number;
  className?: string;
}

export function OfficialSkillGrid({
  searchQuery,
  onViewDetails,
  onInstall,
  isInstalled,
  isInstalling,
  getProgress,
  className,
}: OfficialSkillGridProps) {
  const { t } = useTranslation();
  const {
    displaySkills,
    isLoading,
    skillsError,
    searchError,
    hasMore,
    loadMore,
    refreshSkills,
    isSearching,
    search,
    searchQuery: currentSearchQuery,
    setSort,
    currentSort,
  } = useClawhubRegistry({ limit: 24, fetchOnMount: true });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;
      observerRef.current?.disconnect();
      if (typeof IntersectionObserver === "undefined") return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading) {
          void loadMore();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [hasMore, isLoading, loadMore],
  );

  useEffect(() => {
    if (searchQuery !== currentSearchQuery) {
      search(searchQuery);
    }
  }, [currentSearchQuery, search, searchQuery]);

  const error = skillsError || searchError;
  const retry = isSearching ? () => search(searchQuery) : refreshSkills;

  if (error && displaySkills.length === 0) {
    return <SkillGridError error={error} onRetry={retry} className={className} />;
  }

  if (isLoading && displaySkills.length === 0) {
    return (
      <SkillGridShell className={className}>
        {Array.from({ length: 8 }).map((_, index) => (
          <OfficialSkillCardSkeleton key={index} />
        ))}
      </SkillGridShell>
    );
  }

  if (!isLoading && displaySkills.length === 0) {
    return (
      <SkillGridEmpty
        className={className}
        title={isSearching ? t("skillsMarket.noSearchResults") : t("skillsMarket.noPackages")}
        description={isSearching ? t("skillsMarket.tryDifferentSearch") : t("skillsMarket.checkBackLater")}
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {isSearching
            ? t("skillsMarket.searchResults", { count: displaySkills.length, query: searchQuery })
            : t("skillsMarket.showingSkills", { count: displaySkills.length })}
        </span>
        <div className="flex items-center gap-2">
          {!isSearching && (
            <Select value={currentSort} onValueChange={(value) => setSort(value as ClawhubSkillSortOption)}>
              <SelectTrigger className="h-8 w-[170px] text-xs" aria-label={t("skillsMarket.sortBy")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {t(option.labelKey, option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={refreshSkills} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      <SkillGridShell>
        {displaySkills.map((skill) => (
          <OfficialSkillCard
            key={`${skill.id}-${skill.version}`}
            skill={skill}
            onViewDetails={onViewDetails}
            onInstall={onInstall}
            isInstalled={isInstalled(skill.id)}
            isInstalling={isInstalling(skill.id)}
            installProgress={getProgress(skill.id)}
          />
        ))}
      </SkillGridShell>

      {hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-6">
          <Button variant="outline" onClick={loadMore} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("common.loadMore")}
          </Button>
        </div>
      )}

      {error && displaySkills.length > 0 && <SkillGridError error={error} onRetry={retry} />}
    </div>
  );
}
```

- [ ] **Step 3: Create Community infinite grid**

Create `/root/viben/apps/desktop/src/components/skills/community-skill-grid.tsx`:

```tsx
import { useCallback, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCloudSkillPackagesInfinite,
  useCloudSkillSearch,
} from "@/hooks/use-cloud-skills";
import type { CloudSkillSortOption } from "@/hooks/use-cloud-skills";
import { cn } from "@/lib/utils";
import { CommunitySkillCard, CommunitySkillCardSkeleton } from "./community-skill-card";
import { SkillGridEmpty, SkillGridError, SkillGridShell } from "./skill-grid-states";
import type { InstallableSkill, SkillDetailItem } from "./types";

const SORT_OPTIONS: Array<{ value: CloudSkillSortOption; labelKey: string; label: string }> = [
  { value: "latest", labelKey: "skillsMarket.sort.latest", label: "Latest" },
  { value: "popular", labelKey: "skillsMarket.sort.popular", label: "Popular" },
  { value: "downloads", labelKey: "skillsMarket.sort.downloads", label: "Most Downloads" },
];

interface CommunitySkillGridProps {
  searchQuery: string;
  onViewDetails: (skill: SkillDetailItem) => void;
  onInstall: (skill: InstallableSkill) => void;
  isInstalled: (id: string) => boolean;
  isInstalling: (id: string) => boolean;
  getProgress: (id: string) => number;
  className?: string;
}

export function CommunitySkillGrid({
  searchQuery,
  onViewDetails,
  onInstall,
  isInstalled,
  isInstalling,
  getProgress,
  className,
}: CommunitySkillGridProps) {
  const { t } = useTranslation();
  const [currentSort, setCurrentSort] = useState<CloudSkillSortOption>("popular");
  const {
    packages,
    loading: packagesLoading,
    error: packagesError,
    hasMore,
    loadMore,
    refresh,
  } = useCloudSkillPackagesInfinite({ limit: 24, sort: currentSort });
  const {
    results: searchResults,
    loading: searchLoading,
    error: searchError,
    search,
  } = useCloudSkillSearch(searchQuery, 300);

  const isSearching = searchQuery.trim().length > 0;
  const displaySkills = isSearching ? searchResults : packages;
  const isLoading = isSearching ? searchLoading : packagesLoading;
  const error = packagesError || searchError;
  const retry = isSearching ? () => search(searchQuery) : refresh;

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isSearching) return;
      observerRef.current?.disconnect();
      if (typeof IntersectionObserver === "undefined") return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading && !isSearching) {
          void loadMore();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [hasMore, isLoading, isSearching, loadMore],
  );

  if (error && displaySkills.length === 0) {
    return <SkillGridError error={error} onRetry={retry} className={className} />;
  }

  if (isLoading && displaySkills.length === 0) {
    return (
      <SkillGridShell className={className}>
        {Array.from({ length: 8 }).map((_, index) => (
          <CommunitySkillCardSkeleton key={index} />
        ))}
      </SkillGridShell>
    );
  }

  if (!isLoading && displaySkills.length === 0) {
    return (
      <SkillGridEmpty
        className={className}
        title={isSearching ? t("skillsMarket.noSearchResults") : t("skillsMarket.noPackages")}
        description={isSearching ? t("skillsMarket.tryDifferentSearch") : t("skillsMarket.checkBackLater")}
      />
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          {isSearching
            ? t("skillsMarket.searchResults", { count: displaySkills.length, query: searchQuery })
            : t("skillsMarket.showingSkills", { count: displaySkills.length })}
        </span>
        <div className="flex items-center gap-2">
          {!isSearching && (
            <Select value={currentSort} onValueChange={(value) => setCurrentSort(value as CloudSkillSortOption)}>
              <SelectTrigger className="h-8 w-[170px] text-xs" aria-label={t("skillsMarket.sortBy")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-xs">
                    {t(option.labelKey, option.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            {t("common.refresh")}
          </Button>
        </div>
      </div>

      <SkillGridShell>
        {displaySkills.map((skill) => (
          <CommunitySkillCard
            key={skill.id}
            skill={skill}
            onViewDetails={onViewDetails}
            onInstall={onInstall}
            isInstalled={isInstalled(skill.id)}
            isInstalling={isInstalling(skill.id)}
            installProgress={getProgress(skill.id)}
          />
        ))}
      </SkillGridShell>

      {!isSearching && hasMore && (
        <div ref={loadMoreRef} className="flex justify-center py-6">
          <Button variant="outline" onClick={loadMore} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("common.loadMore")}
          </Button>
        </div>
      )}

      {error && displaySkills.length > 0 && <SkillGridError error={error} onRetry={retry} />}
    </div>
  );
}
```

- [ ] **Step 4: Add grid behavior tests**

Create `/root/viben/apps/desktop/src/components/skills/official-skill-grid.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfficialSkillGrid } from "./official-skill-grid";
import type { ReactNode } from "react";
import type { ClawhubSkillDisplay } from "@/types/clawhub-registry";

const loadMore = vi.fn();
const refreshSkills = vi.fn();
const search = vi.fn();
const setSort = vi.fn();

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const skill: ClawhubSkillDisplay = {
  id: "owner/official-skill",
  name: "Official Skill",
  slug: "owner/official-skill",
  version: "2.0.0",
  description: "Official description",
  ownerHandle: "owner",
  ownerName: "Owner Team",
  ownerAvatar: null,
  isOfficial: true,
  executesCode: false,
  channel: "official",
  downloads: 1200,
  stars: 42,
  createdAt: 1717200000000,
  updatedAt: 1717286400000,
};

const hookState = {
  displaySkills: [skill],
  isLoading: false,
  skillsError: null as string | null,
  searchError: null as string | null,
  hasMore: true,
  loadMore,
  refreshSkills,
  isSearching: false,
  search,
  searchQuery: "",
  setSort,
  currentSort: "updated",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === "skillsMarket.showingSkills") return `showing ${values?.count}`;
      if (key === "skillsMarket.searchResults") return `results ${values?.count}`;
      return key;
    },
  }),
}));

vi.mock("@/hooks/use-clawhub-registry", () => ({
  useClawhubRegistry: () => hookState,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
    value: string;
  }) => (
    <div>
      <button type="button" aria-label="skillsMarket.sortBy" onClick={() => onValueChange("downloads")}>
        sort:{value}
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock("./official-skill-card", () => ({
  OfficialSkillCard: ({ skill }: { skill: ClawhubSkillDisplay }) => <div>{skill.name}</div>,
  OfficialSkillCardSkeleton: () => <div>official skeleton</div>,
}));

describe("OfficialSkillGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(hookState, {
      displaySkills: [skill],
      isLoading: false,
      skillsError: null,
      searchError: null,
      hasMore: true,
      isSearching: false,
      searchQuery: "",
      currentSort: "updated",
    });
  });

  it("syncs search prop and renders results", () => {
    render(
      <OfficialSkillGrid
        searchQuery="runner"
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
        isInstalled={() => false}
        isInstalling={() => false}
        getProgress={() => 0}
      />,
    );

    expect(search).toHaveBeenCalledWith("runner");
    expect(screen.getByText("Official Skill")).toBeTruthy();
  });

  it("loads more from the explicit load more button", () => {
    render(
      <OfficialSkillGrid
        searchQuery=""
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
        isInstalled={() => false}
        isInstalling={() => false}
        getProgress={() => 0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /common.loadMore/i }));
    expect(loadMore).toHaveBeenCalledOnce();
  });

  it("changes the official sort option", () => {
    render(
      <OfficialSkillGrid
        searchQuery=""
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
        isInstalled={() => false}
        isInstalling={() => false}
        getProgress={() => 0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /skillsMarket.sortBy/i }));

    expect(setSort).toHaveBeenCalledWith("downloads");
  });

  it("renders error state and retries refresh", () => {
    Object.assign(hookState, { displaySkills: [], skillsError: "failed" });

    render(
      <OfficialSkillGrid
        searchQuery=""
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
        isInstalled={() => false}
        isInstalling={() => false}
        getProgress={() => 0}
      />,
    );

    expect(screen.getByText("failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /common.retry/i }));
    expect(refreshSkills).toHaveBeenCalledOnce();
  });

  it("retries search when the empty error belongs to search results", () => {
    Object.assign(hookState, {
      displaySkills: [],
      searchError: "search failed",
      isSearching: true,
      searchQuery: "runner",
    });

    render(
      <OfficialSkillGrid
        searchQuery="runner"
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
        isInstalled={() => false}
        isInstalling={() => false}
        getProgress={() => 0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /common.retry/i }));

    expect(search).toHaveBeenCalledWith("runner");
    expect(refreshSkills).not.toHaveBeenCalled();
  });
});
```

Create `/root/viben/apps/desktop/src/components/skills/community-skill-grid.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunitySkillGrid } from "./community-skill-grid";
import type { ReactNode } from "react";
import type { CloudSkillPackage } from "@/hooks/use-cloud-skills";

const loadMore = vi.fn();
const refresh = vi.fn();
const search = vi.fn();

class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);
}

vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

const skill: CloudSkillPackage = {
  id: "cloud-1",
  name: "Community Skill",
  slug: "community-skill",
  version: "1.0.0",
  description: "Community description",
  category: "workflow",
  skillType: "automation",
  triggerPatterns: ["run community"],
  tags: ["workflow"],
  repositoryUrl: null,
  favoritesCount: 1,
  downloadsCount: 2,
  ratingAvg: 4.5,
  author: null,
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-02T00:00:00.000Z",
};

const infiniteState = {
  packages: [skill],
  loading: false,
  error: null as string | null,
  hasMore: true,
  loadMore,
  refresh,
};

const searchState = {
  results: [] as CloudSkillPackage[],
  loading: false,
  error: null as string | null,
  search,
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === "skillsMarket.showingSkills") return `showing ${values?.count}`;
      if (key === "skillsMarket.searchResults") return `results ${values?.count}`;
      return key;
    },
  }),
}));

vi.mock("@/hooks/use-cloud-skills", () => ({
  useCloudSkillPackagesInfinite: () => infiniteState,
  useCloudSkillSearch: () => searchState,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode;
    onValueChange: (value: string) => void;
    value: string;
  }) => (
    <div>
      <button type="button" aria-label="skillsMarket.sortBy" onClick={() => onValueChange("downloads")}>
        sort:{value}
      </button>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: ReactNode; value: string }) => (
    <div data-value={value}>{children}</div>
  ),
  SelectTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectValue: () => null,
}));

vi.mock("./community-skill-card", () => ({
  CommunitySkillCard: ({ skill }: { skill: CloudSkillPackage }) => <div>{skill.name}</div>,
  CommunitySkillCardSkeleton: () => <div>community skeleton</div>,
}));

describe("CommunitySkillGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(infiniteState, { packages: [skill], loading: false, error: null, hasMore: true });
    Object.assign(searchState, { results: [], loading: false, error: null, search });
  });

  it("renders package results and explicit load more", () => {
    render(
      <CommunitySkillGrid
        searchQuery=""
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
        isInstalled={() => false}
        isInstalling={() => false}
        getProgress={() => 0}
      />,
    );

    expect(screen.getByText("Community Skill")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /common.loadMore/i }));
    expect(loadMore).toHaveBeenCalledOnce();
  });

  it("uses search results and hides load more while searching", () => {
    Object.assign(searchState, { results: [{ ...skill, id: "cloud-2", name: "Search Skill" }] });

    render(
      <CommunitySkillGrid
        searchQuery="search"
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
        isInstalled={() => false}
        isInstalling={() => false}
        getProgress={() => 0}
      />,
    );

    expect(screen.getByText("Search Skill")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /common.loadMore/i })).toBeNull();
  });

  it("changes the community sort option", () => {
    render(
      <CommunitySkillGrid
        searchQuery=""
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
        isInstalled={() => false}
        isInstalling={() => false}
        getProgress={() => 0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /skillsMarket.sortBy/i }));

    expect(screen.getByText("Community Skill")).toBeTruthy();
    expect(screen.getByRole("button", { name: /skillsMarket.sortBy/i }).textContent).toBe("sort:downloads");
  });

  it("renders error state and retries refresh", () => {
    Object.assign(infiniteState, { packages: [], error: "failed" });

    render(
      <CommunitySkillGrid
        searchQuery=""
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
        isInstalled={() => false}
        isInstalling={() => false}
        getProgress={() => 0}
      />,
    );

    expect(screen.getByText("failed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /common.retry/i }));
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("retries search when the empty error belongs to search results", () => {
    Object.assign(searchState, { results: [], error: "search failed" });

    render(
      <CommunitySkillGrid
        searchQuery="search"
        onViewDetails={vi.fn()}
        onInstall={vi.fn()}
        isInstalled={() => false}
        isInstalling={() => false}
        getProgress={() => 0}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /common.retry/i }));

    expect(search).toHaveBeenCalledWith("search");
    expect(refresh).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run grid tests**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/official-skill-grid.test.tsx src/components/skills/community-skill-grid.test.tsx
```

Expected: PASS. Do not run full desktop typecheck in this task: Task 7's `SkillDetail` API change is intentionally not integrated into the page until Task 9.

- [ ] **Step 6: Commit**

```bash
git add /root/viben/apps/desktop/src/components/skills/skill-grid-states.tsx /root/viben/apps/desktop/src/components/skills/official-skill-grid.tsx /root/viben/apps/desktop/src/components/skills/community-skill-grid.tsx /root/viben/apps/desktop/src/components/skills/official-skill-grid.test.tsx /root/viben/apps/desktop/src/components/skills/community-skill-grid.test.tsx
git commit -m "feat(desktop): add infinite skill grids"
```

## Task 9: Assemble The Lightweight Skills Market Page

**Files:**
- Rewrite: `/root/viben/apps/desktop/src/pages/skills-market.tsx`
- Modify: `/root/viben/apps/desktop/src/components/skills/index.ts`
- Delete: `/root/viben/apps/desktop/src/components/skills/category-filter.tsx`
- Test: `/root/viben/apps/desktop/src/components/skills/skills-market-page.test.tsx`

- [ ] **Step 1: Write failing page assembly tests**

Create `/root/viben/apps/desktop/src/components/skills/skills-market-page.test.tsx`:

```typescript
/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SkillsMarketPage } from "@/pages/skills-market";
import type { SkillSource } from "@/components/skills";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === "skillsMarket.searchResults") return `${values?.count} results`;
      return key;
    },
  }),
}));

vi.mock("@/hooks/use-skill-install", () => ({
  useSkillInstall: () => ({
    install: vi.fn(),
    isInstalled: vi.fn(() => false),
    isInstalling: vi.fn(() => false),
    getProgress: vi.fn(() => 0),
  }),
}));

vi.mock("@/components/skills", () => ({
  SearchBar: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  }) => (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  SkillSourceTabs: ({
    source,
    onSourceChange,
  }: {
    source: SkillSource;
    onSourceChange: (source: SkillSource) => void;
  }) => (
    <div role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={source === "official"}
        onClick={() => onSourceChange("official")}
      >
        skillsMarket.officialTab
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={source === "community"}
        onClick={() => onSourceChange("community")}
      >
        skillsMarket.communityTab
      </button>
    </div>
  ),
  OfficialSkillGrid: ({ searchQuery }: { searchQuery: string }) => (
    <div data-testid="official-grid">official:{searchQuery}</div>
  ),
  CommunitySkillGrid: ({ searchQuery }: { searchQuery: string }) => (
    <div data-testid="community-grid">community:{searchQuery}</div>
  ),
  SkillDetail: () => <div data-testid="skill-detail" />,
}));

describe("SkillsMarketPage", () => {
  it("starts on official source and passes search query to the active grid", () => {
    render(<SkillsMarketPage />);

    expect(screen.getByTestId("official-grid").textContent).toBe("official:");
    fireEvent.change(screen.getByPlaceholderText("skillsMarket.searchPlaceholder"), {
      target: { value: "runner" },
    });
    expect(screen.getByTestId("official-grid").textContent).toBe("official:runner");
  });

  it("switches to community source and resets search", () => {
    render(<SkillsMarketPage />);

    const scrollContainer = screen.getByTestId("skills-market-scroll");
    Object.defineProperty(scrollContainer, "scrollTop", {
      configurable: true,
      value: 120,
      writable: true,
    });

    fireEvent.change(screen.getByPlaceholderText("skillsMarket.searchPlaceholder"), {
      target: { value: "runner" },
    });
    fireEvent.click(screen.getByRole("tab", { name: /skillsMarket.communityTab/i }));

    expect(screen.getByTestId("community-grid").textContent).toBe("community:");
    expect(scrollContainer.scrollTop).toBe(0);
  });
});
```

- [ ] **Step 2: Run page tests and verify they fail**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/skills-market-page.test.tsx
```

Expected: FAIL because the page still imports removed components and does not use source tabs/grids.

- [ ] **Step 3: Rewrite the page container**

Replace `/root/viben/apps/desktop/src/pages/skills-market.tsx` with:

```tsx
import { useCallback, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  CommunitySkillGrid,
  OfficialSkillGrid,
  SearchBar,
  SkillDetail,
  SkillSourceTabs,
} from "@/components/skills";
import type { InstallableSkill, SkillDetailItem, SkillSource } from "@/components/skills";
import { useSkillInstall } from "@/hooks/use-skill-install";

export function SkillsMarketPage() {
  const { t } = useTranslation();
  const [source, setSource] = useState<SkillSource>("official");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<SkillDetailItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { install, isInstalled, isInstalling, getProgress } = useSkillInstall();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleSourceChange = useCallback((nextSource: SkillSource) => {
    setSource(nextSource);
    setSearchQuery("");
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, []);

  const handleViewDetails = useCallback((skill: SkillDetailItem) => {
    setSelectedSkill(skill);
    setDetailOpen(true);
  }, []);

  const selectedId = selectedSkill?.data.id;

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold">{t("skillsMarket.title")}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("skillsMarket.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SkillSourceTabs source={source} onSourceChange={handleSourceChange} />
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t("skillsMarket.searchPlaceholder")}
          className="w-full lg:max-w-md"
        />
      </div>

      <div
        ref={scrollContainerRef}
        data-testid="skills-market-scroll"
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {source === "official" ? (
          <OfficialSkillGrid
            searchQuery={searchQuery}
            onViewDetails={handleViewDetails}
            onInstall={install}
            isInstalled={isInstalled}
            isInstalling={isInstalling}
            getProgress={getProgress}
          />
        ) : (
          <CommunitySkillGrid
            searchQuery={searchQuery}
            onViewDetails={handleViewDetails}
            onInstall={install}
            isInstalled={isInstalled}
            isInstalling={isInstalling}
            getProgress={getProgress}
          />
        )}
      </div>

      <SkillDetail
        skill={selectedSkill}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        isInstalled={selectedId ? isInstalled(selectedId) : false}
        isInstalling={selectedId ? isInstalling(selectedId) : false}
        installProgress={selectedId ? getProgress(selectedId) : 0}
        onInstall={(skill: InstallableSkill) => install(skill)}
      />
    </div>
  );
}
```

- [ ] **Step 4: Update barrel exports**

Replace `/root/viben/apps/desktop/src/components/skills/index.ts` with:

```typescript
export { CommunitySkillCard, CommunitySkillCardSkeleton } from "./community-skill-card";
export { CommunitySkillGrid } from "./community-skill-grid";
export { OfficialSkillCard, OfficialSkillCardSkeleton } from "./official-skill-card";
export { OfficialSkillGrid } from "./official-skill-grid";
export { SearchBar } from "./search-bar";
export { SkillDetail } from "./skill-detail";
export { SkillSourceBadge, SkillSourceTabs } from "./skill-source-tabs";
export type {
  CommunitySkillSortOption,
  InstallableSkill,
  SkillDetailItem,
  SkillInstallVisualState,
  SkillSource,
} from "./types";
```

- [ ] **Step 5: Delete category filter**

Run:

```bash
git rm /root/viben/apps/desktop/src/components/skills/category-filter.tsx
git rm /root/viben/apps/desktop/src/components/skills/skill-card.tsx
```

- [ ] **Step 6: Run page tests and typecheck**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/skills-market-page.test.tsx
pnpm --filter @viben/desktop typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add /root/viben/apps/desktop/src/pages/skills-market.tsx /root/viben/apps/desktop/src/components/skills/index.ts /root/viben/apps/desktop/src/components/skills/skills-market-page.test.tsx /root/viben/apps/desktop/src/components/skills/skill-detail.tsx /root/viben/apps/desktop/src/components/skills/skill-detail.test.tsx
git commit -m "feat(desktop): assemble dual-source skills market"
```

## Task 10: Add i18n Keys And Final Validation

**Files:**
- Modify: `/root/viben/apps/desktop/src/i18n/locales/en.json`
- Modify: `/root/viben/apps/desktop/src/i18n/locales/zh-CN.json`

- [ ] **Step 1: Add English skills market keys**

Modify the existing `skillsMarket` object in `/root/viben/apps/desktop/src/i18n/locales/en.json` by adding:

```json
{
  "officialTab": "Official",
  "communityTab": "Community",
  "officialBadge": "Official",
  "sortBy": "Sort by",
  "sort": {
    "updated": "Recently Updated",
    "downloads": "Most Downloads",
    "stars": "Most Stars",
    "trending": "Trending",
    "latest": "Latest",
    "popular": "Popular"
  },
  "showingSkills": "Showing {{count}} skills",
  "channel": "Channel",
  "downloads": "Downloads",
  "stars": "Stars",
  "executesCodeWarning": "This skill executes code",
  "viewOnClawhub": "View on ClaWHub"
}
```

Keep existing `sortLatest`, `sortPopular`, and `sortDownloads` keys in place until no remaining component imports them.

- [ ] **Step 2: Add Chinese skills market keys**

Modify the existing `skillsMarket` object in `/root/viben/apps/desktop/src/i18n/locales/zh-CN.json` by adding:

```json
{
  "officialTab": "官方",
  "communityTab": "社区",
  "officialBadge": "官方认证",
  "sortBy": "排序",
  "sort": {
    "updated": "最近更新",
    "downloads": "最多下载",
    "stars": "最多收藏",
    "trending": "热门趋势",
    "latest": "最新",
    "popular": "最受欢迎"
  },
  "showingSkills": "显示 {{count}} 个技能",
  "channel": "频道",
  "downloads": "下载量",
  "stars": "收藏数",
  "executesCodeWarning": "此技能会执行代码",
  "viewOnClawhub": "在 ClaWHub 查看"
}
```

- [ ] **Step 3: Validate JSON**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('/root/viben/apps/desktop/src/i18n/locales/en.json','utf8')); JSON.parse(require('fs').readFileSync('/root/viben/apps/desktop/src/i18n/locales/zh-CN.json','utf8')); console.log('locale json ok')"
```

Expected output:

```text
locale json ok
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
pnpm --filter @viben/desktop test -- src/components/skills/skill-display-utils.test.ts src/hooks/use-clawhub-registry.test.tsx src/hooks/use-cloud-skills.test.ts src/hooks/use-skill-install.test.ts src/lib/skill-installer.test.ts src/components/skills/skill-source-tabs.test.tsx src/components/skills/official-skill-card.test.tsx src/components/skills/community-skill-card.test.tsx src/components/skills/skill-detail.test.tsx src/components/skills/official-skill-grid.test.tsx src/components/skills/community-skill-grid.test.tsx src/components/skills/skills-market-page.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run Desktop typecheck and build**

Run:

```bash
pnpm --filter @viben/desktop typecheck
pnpm --filter @viben/desktop build
```

Expected: both PASS.

- [ ] **Step 6: Run workspace typecheck and build**

Run:

```bash
pnpm typecheck
pnpm build
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add /root/viben/apps/desktop/src/i18n/locales/en.json /root/viben/apps/desktop/src/i18n/locales/zh-CN.json
git commit -m "feat(desktop): localize skills market redesign"
```

## Manual QA Checklist

- [ ] Start Desktop dev server:

```bash
pnpm desktop:restart
```

- [ ] Open the Skills Marketplace page and verify the first screen is the usable market UI, not a landing page.
- [ ] Verify Official tab loads ClaWHub cards, sort dropdown includes Recently Updated, Most Downloads, Most Stars, Trending.
- [ ] Verify Community tab loads Cloud Skills cards, sort dropdown includes Latest, Popular, Most Downloads.
- [ ] Verify Cmd+K focuses the search input.
- [ ] Verify switching Official/Community clears search text and returns to the active source grid.
- [ ] Verify infinite scroll loads more on both tabs when the sentinel reaches the viewport.
- [ ] Verify card hover moves subtly, text stays inside cards at 375px, 768px, 1024px, and 1440px widths.
- [ ] Verify Official detail shows owner, downloads, stars, channel, slug copy, Official badge, and code execution warning when `executesCode` is true.
- [ ] Verify Community detail shows skill type, trigger patterns, tags, author, rating, favorites, repository link, created and updated dates.
- [ ] Verify install progress bar appears on the card and detail dialog.
- [ ] Verify duplicate, corrupt, network, and permission install errors still show user-friendly toast descriptions.

## Self-Review Notes

- Spec coverage: Tasks 2, 3, 8, and 9 implement dual source architecture, infinite scroll, sorting, and container split. Tasks 4, 6, and 7 preserve desktop install progress, toast handling, card install actions, and unified detail dialog. Task 10 covers i18n keys from the spec.
- Placeholder scan: The plan avoids deferred work markers and every code-changing step includes concrete code, exact file paths, and verification commands.
- Type consistency: `SkillDetailItem` and `InstallableSkill` both use `{ source, data }`; all cards, grids, detail dialog, page container, and installer hook pass the same union shape.
