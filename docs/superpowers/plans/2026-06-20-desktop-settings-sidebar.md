# Desktop Settings Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Desktop settings experience so `/settings` and `/settings/:section` use the main Desktop sidebar for settings navigation while the page content renders settings details only.

**Architecture:** Extract settings navigation into a focused sidebar component, keep settings detail rendering in `SettingsPage`, and add small pure helpers for settings path parsing and return-history lookup. The main `Sidebar` switches its middle content by route, while preserving the existing bottom drawer and wakeword button in settings mode.

**Tech Stack:** React 19, React Router, Zustand tab store, Vitest, Tailwind v4, lucide-react, existing Viben Desktop navigation APIs.

---

## File Structure

- Create `apps/desktop/src/pages/settings/settings-sidebar-utils.ts`
  - Pure helpers for settings path detection, section extraction, and finding the nearest non-settings history entry.
- Create `apps/desktop/src/pages/settings/settings-sidebar-utils.test.ts`
  - Unit tests for the pure helpers. These tests drive return behavior and path parsing before UI changes.
- Create `apps/desktop/src/pages/settings/settings-sidebar-content.tsx`
  - Reusable settings navigation list for the main Desktop sidebar. It supports expanded and collapsed sidebar states.
- Create `apps/desktop/src/pages/settings/settings-sidebar-content.test.tsx`
  - Component tests for section click behavior and replace-mode settings navigation.
- Create `apps/desktop/src/hooks/use-desktop-routing.test.tsx`
  - Hook test proving settings section switches replace the current history entry instead of appending another settings entry.
- Modify `apps/desktop/src/hooks/use-desktop-routing.ts`
  - Make `openSettings(section, { stackMode: "replace" })` call `tabActions.replaceUrl()` so in-settings section switches do not add tab history entries.
- Modify `apps/desktop/src/pages/settings/index.tsx`
  - Remove the internal left settings nav. Keep only active-section derivation, preload side effects, animation, and detail rendering.
- Modify `apps/desktop/src/components/layout/sidebar.tsx`
  - Add settings route mode. Replace workspace sidebar body with return button + settings nav, while preserving `SidebarBottomDrawer` and `WakeWordTaskButton`.

## Task 1: Add Settings Sidebar Pure Helpers

**Files:**
- Create: `apps/desktop/src/pages/settings/settings-sidebar-utils.ts`
- Test: `apps/desktop/src/pages/settings/settings-sidebar-utils.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `apps/desktop/src/pages/settings/settings-sidebar-utils.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { TabNavigationState } from "@/stores/tab-store";
import {
  findPreviousNonSettingsHistoryIndex,
  getSettingsSectionFromPathname,
  isSettingsPathname,
} from "./settings-sidebar-utils";

function state(url: string): TabNavigationState {
  return {
    url,
    breadcrumbStack: [],
  };
}

describe("settings sidebar utils", () => {
  it("detects settings routes only", () => {
    expect(isSettingsPathname("/settings")).toBe(true);
    expect(isSettingsPathname("/settings/general")).toBe(true);
    expect(isSettingsPathname("/settings/gateway")).toBe(true);
    expect(isSettingsPathname("/workspace/global/chat")).toBe(false);
    expect(isSettingsPathname("/settings-panel")).toBe(false);
  });

  it("extracts settings section from pathname with general fallback", () => {
    expect(getSettingsSectionFromPathname("/settings")).toBe("general");
    expect(getSettingsSectionFromPathname("/settings/general")).toBe("general");
    expect(getSettingsSectionFromPathname("/settings/gateway")).toBe("gateway");
    expect(getSettingsSectionFromPathname("/settings/terminalFonts")).toBe("terminalFonts");
    expect(getSettingsSectionFromPathname("/workspace/global/chat")).toBe("general");
  });

  it("finds nearest non-settings history entry before current index", () => {
    const history = [
      state("/workspace/global/chat"),
      state("/settings/general"),
      state("/settings/gateway"),
      state("/settings/model"),
    ];

    expect(findPreviousNonSettingsHistoryIndex(history, 3)).toBe(0);
  });

  it("returns null when no previous non-settings entry exists", () => {
    const history = [
      state("/settings/general"),
      state("/settings/gateway"),
    ];

    expect(findPreviousNonSettingsHistoryIndex(history, 1)).toBeNull();
  });

  it("ignores forward history entries after current index", () => {
    const history = [
      state("/workspace/global/chat"),
      state("/settings/general"),
      state("/documents"),
    ];

    expect(findPreviousNonSettingsHistoryIndex(history, 1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the helper tests and verify they fail**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/settings/settings-sidebar-utils.test.ts
```

Expected: FAIL because `settings-sidebar-utils.ts` does not exist.

- [ ] **Step 3: Implement the pure helpers**

Create `apps/desktop/src/pages/settings/settings-sidebar-utils.ts`:

```typescript
import type { SettingsSection } from "@/navigation/navigation-meta";
import { normalizeSettingsSection } from "@/navigation/navigation-meta";
import type { TabNavigationState } from "@/stores/tab-store";

export function isSettingsPathname(pathname: string): boolean {
  return pathname === "/settings" || pathname.startsWith("/settings/");
}

export function isSettingsUrl(url: string): boolean {
  const pathname = url.split(/[?#]/, 1)[0] ?? url;
  return isSettingsPathname(pathname);
}

export function getSettingsSectionFromPathname(pathname: string): SettingsSection {
  if (!isSettingsPathname(pathname)) return "general";
  const section = pathname.split("/settings/")[1];
  return normalizeSettingsSection(section);
}

export function findPreviousNonSettingsHistoryIndex(
  history: TabNavigationState[],
  currentIndex: number,
): number | null {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry && !isSettingsUrl(entry.url)) {
      return index;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run the helper tests and verify they pass**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/settings/settings-sidebar-utils.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add apps/desktop/src/pages/settings/settings-sidebar-utils.ts apps/desktop/src/pages/settings/settings-sidebar-utils.test.ts
git commit -m "test: add settings sidebar navigation helpers"
```

If the repository lockfile hook fails with the existing `pnpm-lock.yaml` mismatch, verify the staged files are only the two Task 1 files, then use:

```bash
git commit --no-verify -m "test: add settings sidebar navigation helpers"
```

## Task 2: Support Replace Semantics in `openSettings`

**Files:**
- Modify: `apps/desktop/src/hooks/use-desktop-routing.ts`
- Create: `apps/desktop/src/hooks/use-desktop-routing.test.tsx`

- [ ] **Step 1: Write the failing hook test**

Create `apps/desktop/src/hooks/use-desktop-routing.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDesktopRouting } from "./use-desktop-routing";
import { getCurrentWindowTabStore } from "@/stores/tab-store";
import type { Root } from "react-dom/client";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@/components/navigation", () => ({
  useOptionalNavigationShell: () => null,
  useNavigationShellHeaderState: () => null,
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(element: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });
}

function RoutingProbe({
  onReady,
}: {
  onReady: (routing: ReturnType<typeof useDesktopRouting>) => void;
}) {
  const routing = useDesktopRouting();

  React.useEffect(() => {
    onReady(routing);
  }, [onReady, routing]);

  return null;
}

describe("useDesktopRouting", () => {
  beforeEach(() => {
    const store = getCurrentWindowTabStore();
    store.setState({
      tabs: [],
      activeTabId: null,
      recentlyClosedTabs: [],
    });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = null;
    container = null;
  });

  it("replaces the current history entry when opening a settings section with replace stack mode", () => {
    const store = getCurrentWindowTabStore();
    let routing: ReturnType<typeof useDesktopRouting> | null = null;

    act(() => {
      store.getState().openTab({
        navigationState: {
          url: "/workspace/global/chat",
          breadcrumbStack: [],
        },
      });
    });

    render(<RoutingProbe onReady={(next) => { routing = next; }} />);

    act(() => {
      routing?.openSettings("general");
    });

    act(() => {
      routing?.openSettings("gateway", { stackMode: "replace" });
    });

    const activeTab = store
      .getState()
      .tabs.find((tab) => tab.id === store.getState().activeTabId);

    expect(activeTab?.navigationHistory.map((entry) => entry.url)).toEqual([
      "/workspace/global/chat",
      "/settings/gateway",
    ]);
    expect(activeTab?.historyIndex).toBe(1);
  });
});
```

- [ ] **Step 2: Run the hook test and verify it fails**

Run:

```bash
pnpm --filter @viben/desktop test -- src/hooks/use-desktop-routing.test.tsx
```

Expected: FAIL because `openSettings("gateway", { stackMode: "replace" })` currently ignores `stackMode` and appends a new settings history entry.

- [ ] **Step 3: Update `openSettings` to replace the current history entry**

In `apps/desktop/src/hooks/use-desktop-routing.ts`, replace the body after the `openMode === "new-tab"` branch with:

```typescript
      if (options?.stackMode === "replace") {
        tabActions.replaceUrl(url, {
          breadcrumbStack: buildColdStartBreadcrumb(url),
        });
        return;
      }
      navigateReset(url);
```

Update the dependency array from:

```typescript
    [navigateReset, openInNewTab],
```

to:

```typescript
    [navigateReset, openInNewTab, tabActions],
```

Do not use `navigateReplace(url)` for this behavior. In the current tab store, `replaceNavigation()` replaces only the breadcrumb stack top and still appends a new history entry through `pushLocation()`.

- [ ] **Step 4: Run the hook test and verify it passes**

Run:

```bash
pnpm --filter @viben/desktop test -- src/hooks/use-desktop-routing.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run targeted typecheck**

Run:

```bash
pnpm --filter @viben/desktop typecheck
```

Expected: no new TypeScript errors from `apps/desktop/src/hooks/use-desktop-routing.ts`.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add apps/desktop/src/hooks/use-desktop-routing.ts apps/desktop/src/hooks/use-desktop-routing.test.tsx
git commit -m "fix: replace settings section navigation"
```

## Task 3: Extract `SettingsSidebarContent`

**Files:**
- Create: `apps/desktop/src/pages/settings/settings-sidebar-content.tsx`
- Test: `apps/desktop/src/pages/settings/settings-sidebar-content.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `apps/desktop/src/pages/settings/settings-sidebar-content.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsSidebarContent } from "./settings-sidebar-content";

const openSettings = vi.fn();
const syncChannels = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-desktop-routing", () => ({
  useDesktopRouting: () => ({
    openSettings,
  }),
}));

vi.mock("@/hooks", () => ({
  syncChannels: () => syncChannels(),
}));

describe("SettingsSidebarContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates settings sections with replace stack mode", () => {
    render(
      <MemoryRouter initialEntries={["/settings/general"]}>
        <SettingsSidebarContent collapsed={false} showExpanded />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "settings.sections.gateway" }));

    expect(openSettings).toHaveBeenCalledWith("gateway", { stackMode: "replace" });
  });

  it("preloads channel data when opening the channels section", () => {
    render(
      <MemoryRouter initialEntries={["/settings/general"]}>
        <SettingsSidebarContent collapsed={false} showExpanded />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "settings.sections.channels" }));

    expect(openSettings).toHaveBeenCalledWith("channels", { stackMode: "replace" });
    expect(syncChannels).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/settings/settings-sidebar-content.test.tsx
```

Expected: FAIL because `settings-sidebar-content.tsx` does not exist.

- [ ] **Step 3: Write the component file**

Create `apps/desktop/src/pages/settings/settings-sidebar-content.tsx`:

```tsx
import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { syncChannels } from "@/hooks";
import { SidebarIconButton } from "@/components/layout/sidebar-icon-button";
import { cn } from "@/lib/utils";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { SECTIONS } from "./constants";
import type { SettingsSection } from "./types";
import { getSettingsSectionFromPathname } from "./settings-sidebar-utils";

interface SettingsSidebarContentProps {
  collapsed: boolean;
  showExpanded: boolean;
}

export function SettingsSidebarContent({
  collapsed,
  showExpanded,
}: SettingsSidebarContentProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { openSettings } = useDesktopRouting();
  const activeSection = getSettingsSectionFromPathname(location.pathname);

  const handleSectionChange = useCallback(
    (section: SettingsSection) => {
      openSettings(section, { stackMode: "replace" });
      if (section === "channels") {
        syncChannels();
      }
    },
    [openSettings],
  );

  if (collapsed && !showExpanded) {
    return (
      <div className="flex flex-col gap-1">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const title = t(section.labelKey);
          const isActive = activeSection === section.id;

          return (
            <div key={section.id} className="grid w-full place-items-center">
              <SidebarIconButton
                icon={
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      isActive && "text-primary",
                    )}
                  />
                }
                tooltip={title}
                onClick={() => handleSectionChange(section.id)}
              />
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const title = t(section.labelKey);
        const isActive = activeSection === section.id;

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => handleSectionChange(section.id)}
            className={cn(
              "group relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm",
              "transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? [
                    "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                    "before:absolute before:left-0 before:top-1/2 before:h-6 before:w-1",
                    "before:-translate-y-1/2 before:rounded-r-full before:bg-primary",
                  ]
                : [
                    "text-sidebar-foreground/70",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  ],
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors duration-200",
                "group-hover:text-primary",
                isActive && "text-primary",
              )}
            />
            <span className="truncate">{title}</span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run the component test and verify it passes**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/settings/settings-sidebar-content.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @viben/desktop typecheck
```

Expected: no TypeScript errors from `settings-sidebar-content.tsx`.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add apps/desktop/src/pages/settings/settings-sidebar-content.tsx apps/desktop/src/pages/settings/settings-sidebar-content.test.tsx
git commit -m "feat: add settings sidebar content"
```

## Task 4: Make `SettingsPage` Detail-Only

**Files:**
- Modify: `apps/desktop/src/pages/settings/index.tsx`

- [ ] **Step 1: Edit imports**

In `apps/desktop/src/pages/settings/index.tsx`, remove unused imports:

```tsx
import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import {
  DEFAULT_SETTINGS_SECTION,
  SECTIONS,
  VALID_SECTIONS,
  easeOutExpo,
} from "./constants";
```

Replace them with:

```tsx
import { useState, useEffect } from "react";
import { syncChannels } from "@/hooks";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import type { SettingsSection } from "./types";
import { easeOutExpo } from "./constants";
import { getSettingsSectionFromPathname } from "./settings-sidebar-utils";
```

- [ ] **Step 2: Remove in-page section click handler**

Delete this block from `SettingsPage`:

```tsx
  const { t } = useTranslation();
  const { openSettings } = useDesktopRouting();
```

Delete the `getSectionFromPath` function and replace the `useState` initializer with:

```tsx
  const [activeSection, setActiveSection] = useState<SettingsSection>(() =>
    getSettingsSectionFromPathname(location.pathname)
  );
```

Delete the full `handleSectionChange` callback block because settings navigation now lives in the main `Sidebar`.

- [ ] **Step 3: Keep URL-driven active section sync**

Replace the URL sync effect with:

```tsx
  useEffect(() => {
    const sectionFromPath = getSettingsSectionFromPathname(location.pathname);
    if (sectionFromPath !== activeSection) {
      setActiveSection(sectionFromPath);
    }
    if (sectionFromPath === "channels") {
      syncChannels();
    }
  }, [activeSection, location.pathname]);
```

- [ ] **Step 4: Replace the JSX layout**

Replace the `return` JSX in `SettingsPage` with:

```tsx
  return (
    <motion.div
      className="h-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div
        className={cn(
          "h-full overflow-auto",
          ["agents", "mcp", "skills"].includes(activeSection) ? "" : "p-6",
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            variants={tabContentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={cn(
              ["agents", "mcp", "skills"].includes(activeSection)
                ? "h-full"
                : "max-w-2xl",
            )}
          >
            {renderSectionContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @viben/desktop typecheck
```

Expected: no unused import errors and no TypeScript errors from `SettingsPage`.

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add apps/desktop/src/pages/settings/index.tsx
git commit -m "refactor: make settings page detail only"
```

## Task 5: Add Settings Mode to Desktop Sidebar

**Files:**
- Modify: `apps/desktop/src/components/layout/sidebar.tsx`

- [ ] **Step 1: Update imports**

In `apps/desktop/src/components/layout/sidebar.tsx`, add `ArrowLeft` to the lucide import list:

```tsx
  ArrowLeft,
```

Add these imports:

```tsx
import { SettingsSidebarContent } from "@/pages/settings/settings-sidebar-content";
import {
  findPreviousNonSettingsHistoryIndex,
  isSettingsPathname,
} from "@/pages/settings/settings-sidebar-utils";
import { getCurrentWindowTabStore } from "@/stores/tab-store";
```

- [ ] **Step 2: Expand desktop routing destructure**

Replace:

```tsx
  const { openWorkspaceSection, openWorkspaceHome, openPath, openDashboard } = useDesktopRouting();
```

with:

```tsx
  const {
    currentTab,
    openWorkspaceSection,
    openWorkspaceHome,
    openPath,
    openDashboard,
  } = useDesktopRouting();
```

Keep the existing `const location = useLocation();`.

- [ ] **Step 3: Add settings mode and return handler**

After `showExpanded` is computed, add:

```tsx
  const isSettingsMode = isSettingsPathname(location.pathname);

  const handleReturnFromSettings = useCallback(() => {
    if (currentTab) {
      const previousIndex = findPreviousNonSettingsHistoryIndex(
        currentTab.navigationHistory,
        currentTab.historyIndex,
      );

      if (previousIndex !== null) {
        getCurrentWindowTabStore()
          .getState()
          .jumpToHistory(currentTab.id, previousIndex);
        return;
      }
    }

    if (activeWorkspaceId) {
      openWorkspaceSection(activeWorkspaceId, "chat");
      return;
    }

    openDashboard();
  }, [activeWorkspaceId, currentTab, openDashboard, openWorkspaceSection]);
```

- [ ] **Step 4: Add settings-mode content fragments**

Before `ExpandedContent`, add:

```tsx
  const ExpandedSettingsContent = (
    <>
      <div className="flex h-10 items-center border-b border-sidebar-border px-2">
        <Button
          variant="ghost"
          className="h-8 w-full justify-start gap-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={handleReturnFromSettings}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate text-sm font-medium">{t("common.back", "Back")}</span>
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 pt-2">
        <SettingsSidebarContent collapsed={false} showExpanded />
      </ScrollArea>

      <div className="px-2 pb-2">
        <Separator className="mb-2 bg-sidebar-border" />
        <SidebarBottomDrawer collapsed={false} onOpenChange={handleMenuOpenChange} />
        <WakeWordTaskButton collapsed={false} disabled={!activeWorkspace} />
      </div>
    </>
  );

  const CollapsedSettingsContent = (
    <>
      <div className="flex h-10 items-center justify-center border-b border-sidebar-border px-2">
        <SidebarIconButton
          icon={<ArrowLeft className="h-4 w-4" />}
          tooltip={t("common.back", "Back")}
          onClick={handleReturnFromSettings}
        />
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2 pt-2">
        <SettingsSidebarContent collapsed showExpanded={false} />
      </ScrollArea>

      <div className="flex flex-col pb-2">
        <div className="grid w-full place-items-center py-2">
          <Separator className="w-10 bg-sidebar-border" />
        </div>
        <SidebarBottomDrawer collapsed onOpenChange={handleMenuOpenChange} />
        <WakeWordTaskButton collapsed disabled={!activeWorkspace} />
      </div>
    </>
  );
```

- [ ] **Step 5: Switch rendered content by route**

Replace this line inside the `<aside>`:

```tsx
            {showExpanded ? ExpandedContent : CollapsedContent}
```

with:

```tsx
            {isSettingsMode
              ? showExpanded
                ? ExpandedSettingsContent
                : CollapsedSettingsContent
              : showExpanded
                ? ExpandedContent
                : CollapsedContent}
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm --filter @viben/desktop typecheck
```

Expected: no TypeScript errors from `sidebar.tsx`.

- [ ] **Step 7: Commit Task 5**

Run:

```bash
git add apps/desktop/src/components/layout/sidebar.tsx
git commit -m "feat: show settings navigation in desktop sidebar"
```

## Task 6: Final Verification

**Files:**
- Verify all files changed in Tasks 1-5.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm --filter @viben/desktop test -- src/pages/settings/settings-sidebar-utils.test.ts src/navigation/navigate.test.ts
```

Expected: PASS.

Then run:

```bash
pnpm --filter @viben/desktop test -- src/hooks/use-desktop-routing.test.tsx src/pages/settings/settings-sidebar-content.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run Desktop typecheck**

Run:

```bash
pnpm --filter @viben/desktop typecheck
```

Expected: PASS or only pre-existing unrelated failures. If failures appear in files changed by this plan, fix them before continuing.

- [ ] **Step 3: Run workspace verification if feasible**

Run:

```bash
pnpm typecheck
```

Expected: PASS or known unrelated failures. Record any existing failures with file paths and first error messages.

- [ ] **Step 4: Manual UI smoke test**

Run the desktop dev server:

```bash
pnpm desktop:restart
```

Verify manually:

- Enter settings from the bottom drawer.
- Sidebar top shows the return button.
- Sidebar middle shows settings sections.
- Sidebar bottom still shows Gateway Status / bottom drawer and Wakeword Button.
- Bottom drawer still exposes Documents, Devices, Settings, Console, and user menu.
- Switching settings sections updates `/settings/:section` without adding a chain of settings entries that trap the return button.
- Return exits settings to the nearest non-settings tab history entry.
- If no non-settings history exists, return opens active workspace chat, or dashboard when no workspace is active.
- Collapsed sidebar shows icon-only return and icon-only settings sections.

- [ ] **Step 5: Final status check**

Run:

```bash
git status --short
```

Expected: only intentional changes from this plan are present. Do not stage or revert unrelated dirty files.

- [ ] **Step 6: Commit final fixes if any**

If Task 6 required code fixes, run:

```bash
git add apps/desktop/src/pages/settings apps/desktop/src/hooks/use-desktop-routing.ts apps/desktop/src/hooks/use-desktop-routing.test.tsx apps/desktop/src/components/layout/sidebar.tsx
git commit -m "fix: polish desktop settings sidebar behavior"
```

If there were no Task 6 code changes, do not create an empty commit.
