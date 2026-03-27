---
sidebar_position: 7
title: Tailwind v4 Workspace Package Configuration
description: Configure Tailwind v4 to scan workspace packages in a pnpm monorepo
---

# Tailwind CSS v4 - Workspace Package Configuration

> Key: How to properly configure Tailwind v4 in a pnpm monorepo to scan CSS classes from workspace packages.

---

## Problem

When using Tailwind CSS v4's Vite plugin (`@tailwindcss/vite`) in a pnpm monorepo, external workspace packages (such as `@viben/kanban`, `@viben/ui`) **are not automatically scanned** for CSS classes.

This causes CSS classes used in these packages to be purged from the final build, breaking layouts and styles.

### Symptoms

- Layouts silently fail (no build errors)
- Grid layouts (`inline-grid`, `grid-flow-col`) don't work
- Flex layouts behave abnormally
- CSS properties like `auto-cols-[280px]` have no effect

---

## Root Cause

Tailwind v4 with the Vite plugin automatically detects content sources in the project, but:

1. By default, it only scans files in `src/`
2. Workspace packages symlinked via pnpm (`node_modules/@viben/*`) **are not included**
3. CSS classes in external packages are purged because Tailwind doesn't know they exist

---

## Solution

Add `@source` directives in the CSS entry file to explicitly include workspace packages.

### Example: `apps/desktop/src/index.css`

```css
@import "tailwindcss";

/* Scan Tailwind classes in workspace packages */
@source "../node_modules/@viben/kanban/src/**/*.tsx";
@source "../node_modules/@viben/ui/src/**/*.tsx";

@theme {
  /* ... theme configuration */
}
```

### Key Points

1. **Use node_modules paths** - The path `../node_modules/@viben/kanban` will correctly follow symlinks
2. **Include source files** - Point to the `src/` directory with TSX files, not the `dist/` output
3. **Use glob patterns** - `**/*.tsx` captures all component files

---

## Verification

After adding `@source` directives:

1. **Clear all caches:**
   ```bash
   rm -rf apps/desktop/dist .turbo node_modules/.vite
   ```

2. **Rebuild:**
   ```bash
   pnpm build --filter @viben/desktop
   ```

3. **Check CSS output:**
   ```bash
   # Split minified CSS and search for classes
   cat apps/desktop/dist/assets/index-*.css | tr '}' '\n' | grep "inline-grid"
   ```

   Expected output:
   ```
   .inline-grid{display:inline-grid
   .auto-cols-\[280px\]{grid-auto-columns:280px
   .grid-flow-col{grid-auto-flow:column
   ```

---

## CSS Classes Required for Horizontal Kanban Layout

The kanban board requires these CSS classes to display horizontally:

| Class | Purpose | CSS Output |
|-------|---------|------------|
| `inline-grid` | Makes the container an inline grid | `display: inline-grid` |
| `grid-flow-col` | Flows items by column | `grid-auto-flow: column` |
| `auto-cols-[280px]` | Sets column width | `grid-auto-columns: 280px` |
| `divide-x` | Adds vertical dividers | `border-left-width: 1px` |
| `border-x` | Adds left/right borders | `border-left/right-width: 1px` |

If any of these classes are missing from the compiled CSS, the kanban will stack vertically instead of horizontally.

---

## Common Mistakes

### Wrong: Using relative paths from src/

```css
/* This path may not resolve correctly */
@source "../../packages/kanban/src/**/*.tsx";
```

### Correct: Paths through node_modules

```css
/* Follow symlinks through node_modules */
@source "../node_modules/@viben/kanban/src/**/*.tsx";
```

### Wrong: Only scanning dist/

```css
/* dist/ contains compiled JS, not source code with class strings */
@source "../node_modules/@viben/kanban/dist/**/*.js";
```

### Correct: Scan source TSX files

```css
/* Source files contain class string literals */
@source "../node_modules/@viben/kanban/src/**/*.tsx";
```

---

## Related Files

| File | Purpose |
|------|---------|
| `apps/desktop/src/index.css` | CSS entry point with `@source` directives |
| `apps/desktop/vite.config.ts` | Vite configuration with `@tailwindcss/vite` plugin |
| `packages/kanban/src/kanban.tsx` | Kanban component using grid classes |

---

## Debugging Tips

1. **CSS file size changed?** If the CSS file size increases after adding `@source`, it's working
2. **Same hash after rebuild?** Cache not cleared - delete `.turbo` and `dist/`
3. **Classes still missing?** Check if the glob pattern covers all files using those classes

---

**Last Updated:** 2026-02-28
**Status:** ✅ Production Fix
