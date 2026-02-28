# Tailwind CSS v4 - Workspace Package Configuration

> Critical: How to properly configure Tailwind v4 to scan workspace packages for CSS classes in a pnpm monorepo.

---

## Problem

When using Tailwind CSS v4 with the Vite plugin (`@tailwindcss/vite`) in a pnpm monorepo, external workspace packages (like `@viben/kanban`, `@viben/ui`) are **not automatically scanned** for CSS classes.

This causes CSS classes used in those packages to be purged from the final build, breaking layouts and styles.

### Symptoms

- Layout breaks silently (no build errors)
- Grid layouts (`inline-grid`, `grid-flow-col`) don't work
- Flex layouts appear broken
- CSS properties like `auto-cols-[280px]` have no effect

---

## Root Cause

Tailwind v4 with Vite plugin auto-detects content sources from the project, but:

1. It only scans files in `src/` by default
2. Workspace packages symlinked via pnpm (`node_modules/@viben/*`) are **not included**
3. CSS classes in external packages get purged because Tailwind doesn't know about them

---

## Solution

Add `@source` directives to your CSS entry file to explicitly include workspace packages.

### Example: `apps/desktop/src/index.css`

```css
@import "tailwindcss";

/* Scan workspace packages for Tailwind classes */
@source "../node_modules/@viben/kanban/src/**/*.tsx";
@source "../node_modules/@viben/ui/src/**/*.tsx";

@theme {
  /* ... theme configuration */
}
```

### Key Points

1. **Use node_modules path** - The path `../node_modules/@viben/kanban` follows the symlink correctly
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
| `inline-grid` | Make container an inline grid | `display: inline-grid` |
| `grid-flow-col` | Flow items in columns | `grid-auto-flow: column` |
| `auto-cols-[280px]` | Set column width | `grid-auto-columns: 280px` |
| `divide-x` | Add vertical dividers | `border-left-width: 1px` |
| `border-x` | Add left/right borders | `border-left/right-width: 1px` |

If any of these are missing from the compiled CSS, the kanban will stack vertically instead of horizontally.

---

## Common Mistakes

### ❌ Wrong: Relative path from src/

```css
/* This path may not resolve correctly */
@source "../../packages/kanban/src/**/*.tsx";
```

### ✅ Correct: Path through node_modules

```css
/* Follow the symlink through node_modules */
@source "../node_modules/@viben/kanban/src/**/*.tsx";
```

### ❌ Wrong: Only scanning dist/

```css
/* dist/ contains compiled JS, not source with class strings */
@source "../node_modules/@viben/kanban/dist/**/*.js";
```

### ✅ Correct: Scan source TSX files

```css
/* Source files contain the class string literals */
@source "../node_modules/@viben/kanban/src/**/*.tsx";
```

---

## Related Files

| File | Purpose |
|------|---------|
| `apps/desktop/src/index.css` | CSS entry point with `@source` directives |
| `apps/desktop/vite.config.ts` | Vite config with `@tailwindcss/vite` plugin |
| `packages/kanban/src/kanban.tsx` | Kanban components using grid classes |

---

## Debugging Tips

1. **CSS file size changed?** If the CSS file size increases after adding `@source`, it's working
2. **Same hash after rebuild?** Cache wasn't cleared - delete `.turbo` and `dist/`
3. **Classes still missing?** Check the glob pattern covers all files using those classes

---

**Last Updated:** 2026-02-08
**Status:** ✅ Production Fix
