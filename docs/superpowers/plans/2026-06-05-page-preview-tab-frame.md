# Page Preview Tab Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a reusable browser-style tab frame from `GlobalTabBar` and use it in the dedicated page preview window.

**Architecture:** Keep `GlobalTabBar` as the owner of tab store, routing, history, and drag-and-drop behavior. Move only reusable titlebar/frame presentation into focused components under `apps/desktop/src/components/browser-tab-frame/`, then compose those components from both main window and preview window.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Radix DropdownMenu/Tooltip, Vitest jsdom.

---

### Task 1: Shared Tab Frame Tests

**Files:**
- Create: `apps/desktop/src/components/browser-tab-frame/browser-tab-frame.test.tsx`

- [ ] Write jsdom tests using `react-dom/client` and `act`.
- [ ] Assert that leading controls, tab content, spacer, right controls, and window controls render in the expected visual order.
- [ ] Assert that `BrowserTabFrameIconButton` invokes `onClick` and respects `disabled`.
- [ ] Assert that `BrowserTabFrameTab` close button calls `onClose` without calling `onSelect`.
- [ ] Run `pnpm --filter @viben/desktop test -- src/components/browser-tab-frame/browser-tab-frame.test.tsx` and confirm it fails because the module does not exist.

### Task 2: Extract Shared Components

**Files:**
- Create: `apps/desktop/src/components/browser-tab-frame/index.ts`
- Create: `apps/desktop/src/components/browser-tab-frame/browser-tab-frame.tsx`

- [ ] Implement `BrowserTabFrame`, `BrowserTabFrameIconButton`, and `BrowserTabFrameTab`.
- [ ] Use static imports only.
- [ ] Keep component props business-agnostic.
- [ ] Run the focused test and confirm it passes.

### Task 3: Refactor GlobalTabBar

**Files:**
- Modify: `apps/desktop/src/components/global-tab-bar/index.tsx`

- [ ] Replace the top-level titlebar layout with `BrowserTabFrame`.
- [ ] Keep current DnD, `SortableTabItem`, history context menus, sidebar toggle, and new-tab behavior intact.
- [ ] Keep `WindowControls` owned by `GlobalTabBar`, passed as the frame `windowControls` slot.
- [ ] Run existing tab store tests and the focused frame test.

### Task 4: Preview Window Toolbar

**Files:**
- Modify: `apps/desktop/src/pages/apps/page-preview-window.tsx`

- [ ] Add local iframe refresh state.
- [ ] Add platform detection matching main window behavior for macOS titlebar spacing.
- [ ] Render `BrowserTabFrame` above `PagePreview`.
- [ ] Use `BrowserTabFrameTab` for the current page tab.
- [ ] Add browser-open icon button with hover/focus behavior and tooltip.
- [ ] Add more dropdown menu with requested items and shortcuts.
- [ ] Wire refresh, copy link, open default browser, and close current preview window.

### Task 5: Verification

**Files:**
- No production file changes expected.

- [ ] Run `pnpm --filter @viben/desktop test -- src/components/browser-tab-frame/browser-tab-frame.test.tsx`.
- [ ] Run `pnpm --filter @viben/desktop typecheck`.
- [ ] Run `pnpm --filter @viben/desktop build` if typecheck passes and time permits.
- [ ] Report any failures with exact command and cause.
