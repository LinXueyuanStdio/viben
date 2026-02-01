# Design System Phase 1: Foundation

## Goal

Establish the visual foundation of the Browse MCP design system by implementing CSS custom properties for colors, typography, spacing, animation timing, and background textures. This phase creates the base layer that all subsequent UI components will build upon.

After this phase, users will immediately see the new warm amber color palette and elegant typography, transforming the generic black/white/gray interface into the distinctive Browse MCP brand identity.

## Requirements

### 1. Update CSS Variables (`apps/desktop/src/index.css`)

#### 1.1 Brand Colors (OKLCH Format)

Add the complete brand-amber color scale (50-900):

```css
--brand-amber-50: oklch(0.97 0.02 75);
--brand-amber-100: oklch(0.95 0.04 75);
--brand-amber-200: oklch(0.90 0.08 75);
--brand-amber-300: oklch(0.85 0.12 75);
--brand-amber-400: oklch(0.78 0.16 75);
--brand-amber-500: oklch(0.70 0.18 75);
--brand-amber-600: oklch(0.62 0.18 75);
--brand-amber-700: oklch(0.52 0.16 75);
--brand-amber-800: oklch(0.42 0.14 75);
--brand-amber-900: oklch(0.32 0.12 75);
```

Add secondary brand colors:

```css
/* Brand Peach (accents) */
--brand-peach-400: oklch(0.82 0.14 55);
--brand-peach-500: oklch(0.75 0.16 55);
--brand-peach-600: oklch(0.68 0.16 55);

/* Brand Teal (data viz contrast) */
--brand-teal-400: oklch(0.72 0.12 195);
--brand-teal-500: oklch(0.65 0.14 195);
--brand-teal-600: oklch(0.58 0.14 195);
```

Add warm neutral scale (not pure gray):

```css
--neutral-50: oklch(0.985 0.002 75);
--neutral-100: oklch(0.97 0.002 75);
--neutral-200: oklch(0.92 0.004 75);
--neutral-300: oklch(0.85 0.004 75);
--neutral-400: oklch(0.70 0.004 75);
--neutral-500: oklch(0.56 0.004 75);
--neutral-600: oklch(0.44 0.004 75);
--neutral-700: oklch(0.32 0.004 75);
--neutral-800: oklch(0.22 0.004 75);
--neutral-900: oklch(0.15 0.004 75);
```

Add semantic colors:

```css
--color-success: oklch(0.65 0.18 145);
--color-warning: oklch(0.70 0.18 75);
--color-error: oklch(0.58 0.22 25);
--color-info: oklch(0.62 0.18 240);
```

#### 1.2 Theme Mapping

Update `:root` (light theme) variables:

| Old Variable | New Value |
|-------------|-----------|
| `--primary` | `var(--brand-amber-600)` |
| `--primary-foreground` | `oklch(1 0 0)` |
| `--background` | `var(--neutral-50)` |
| `--foreground` | `var(--neutral-900)` |
| `--secondary` | `var(--neutral-200)` |
| `--muted` | `var(--neutral-100)` |
| `--muted-foreground` | `var(--neutral-600)` |
| `--border` | `var(--neutral-200)` |
| `--sidebar-primary` | `var(--brand-amber-600)` |

Update `.dark` (dark theme) variables:

| Old Variable | New Value |
|-------------|-----------|
| `--primary` | `var(--brand-amber-500)` |
| `--primary-foreground` | `var(--neutral-900)` |
| `--background` | `var(--neutral-900)` |
| `--foreground` | `var(--neutral-50)` |
| `--secondary` | `var(--neutral-700)` |
| `--muted` | `var(--neutral-800)` |
| `--muted-foreground` | `var(--neutral-400)` |
| `--border` | `var(--neutral-700)` |
| `--sidebar-primary` | `var(--brand-amber-500)` |

Add new surface variables to both themes:

```css
/* Light */
--surface: oklch(1 0 0);
--surface-elevated: var(--neutral-100);
--foreground-secondary: var(--neutral-600);
--foreground-tertiary: var(--neutral-500);
--primary-hover: var(--brand-amber-700);
--border-strong: var(--neutral-300);

/* Dark */
--surface: var(--neutral-800);
--surface-elevated: var(--neutral-700);
--foreground-secondary: var(--neutral-400);
--foreground-tertiary: var(--neutral-500);
--primary-hover: var(--brand-amber-400);
--border-strong: var(--neutral-600);
```

#### 1.3 Spacing Scale

```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

#### 1.4 Animation Timing

```css
/* Easing curves */
--ease-in-out-cubic: cubic-bezier(0.65, 0, 0.35, 1);
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-out-back: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-spring: cubic-bezier(0.68, -0.55, 0.265, 1.55);

/* Duration scale */
--duration-instant: 100ms;
--duration-fast: 200ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
--duration-slower: 700ms;
--duration-slowest: 1000ms;
```

#### 1.5 Border Radius System

```css
--radius-sm: 0.5rem;    /* 8px */
--radius-md: 0.75rem;   /* 12px */
--radius-lg: 1rem;      /* 16px */
--radius-xl: 1.5rem;    /* 24px */
--radius-2xl: 2rem;     /* 32px */
```

#### 1.6 Shadow System

```css
--shadow-xs: 0 1px 2px 0 oklch(0 0 0 / 0.05);
--shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.1), 0 1px 2px -1px oklch(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1), 0 2px 4px -2px oklch(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.1), 0 4px 6px -4px oklch(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px oklch(0 0 0 / 0.1), 0 8px 10px -6px oklch(0 0 0 / 0.1);
--shadow-primary: 0 8px 16px -4px oklch(0.70 0.18 75 / 0.3);
```

### 2. Import Fonts

#### 2.1 Google Fonts Import

Add to `apps/desktop/index.html` (in `<head>`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

#### 2.2 Font Family Variables

Add to CSS:

```css
--font-serif: 'Crimson Pro', 'Source Serif Pro', 'Georgia', 'Times New Roman', serif;
--font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

#### 2.3 Update Base Styles

Update `@layer base` body styles:

```css
body {
  @apply bg-background text-foreground;
  font-family: var(--font-sans);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-serif);
  font-weight: 600;
  letter-spacing: -0.01em;
}

code, pre, kbd, samp {
  font-family: var(--font-mono);
}
```

### 3. Background Texture

Add subtle noise texture overlay to body:

```css
body {
  position: relative;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 1;
}
```

**Note**: Ensure content has proper z-index to appear above the texture overlay.

## Acceptance Criteria

### Colors
- [ ] `index.css` contains all brand-amber variables (50-900) in OKLCH format
- [ ] `index.css` contains brand-peach variables (400-600)
- [ ] `index.css` contains brand-teal variables (400-600)
- [ ] `index.css` contains warm neutral scale (50-900) with slight warm tint
- [ ] `index.css` contains semantic color variables (success, warning, error, info)
- [ ] Light theme (`:root`) uses new amber-based primary color
- [ ] Dark theme (`.dark`) uses slightly brighter amber for visibility
- [ ] All color variables use OKLCH format, not hex or rgb

### Typography
- [ ] Google Fonts are imported in index.html with preconnect for performance
- [ ] Crimson Pro (400, 600) is loaded
- [ ] Inter (400, 500, 600) is loaded
- [ ] JetBrains Mono (400, 500) is loaded
- [ ] CSS font family variables are defined (--font-serif, --font-sans, --font-mono)
- [ ] Headings (h1-h6) use serif font (Crimson Pro)
- [ ] Body text uses sans-serif font (Inter)
- [ ] Code elements use monospace font (JetBrains Mono)

### Spacing & Layout
- [ ] Spacing scale variables defined (--space-1 through --space-24)
- [ ] Border radius system defined (--radius-sm through --radius-2xl)
- [ ] Shadow system defined (--shadow-xs through --shadow-xl, --shadow-primary)

### Animation
- [ ] Easing curve variables defined (--ease-in-out-cubic, --ease-out-expo, --ease-out-back, --ease-spring)
- [ ] Duration scale variables defined (--duration-instant through --duration-slowest)

### Background
- [ ] Body has subtle noise texture overlay (opacity ~0.03)
- [ ] Texture uses SVG filter (feTurbulence)
- [ ] Texture does not interfere with UI interactions (pointer-events: none)
- [ ] Content renders above texture (z-index management)

### Quality
- [ ] `pnpm dev` starts without errors
- [ ] `pnpm typecheck` passes
- [ ] No console errors when loading the app
- [ ] Light mode displays correctly with warm amber colors
- [ ] Dark mode displays correctly with adjusted amber colors
- [ ] Existing UI is not broken (sidebar, buttons, cards still render)

## Technical Notes

### Color Migration Strategy

The migration from the current generic gray palette to the new warm amber palette should be done carefully:

1. **Define new variables first**: Add all brand-amber, brand-peach, brand-teal, and neutral scales before modifying theme mappings
2. **Update theme mappings**: Replace semantic variables (--primary, --background, etc.) to reference the new brand variables
3. **Preserve fallbacks**: The @theme block already maps to semantic variables, so components using Tailwind classes will automatically get new colors

### OKLCH Color Format

OKLCH provides better perceptual uniformity than RGB/HSL:
- `L`: Lightness (0-1)
- `C`: Chroma (0-0.4, typically)
- `H`: Hue angle (0-360)

Example: `oklch(0.70 0.18 75)` = Lightness 70%, Chroma 0.18, Hue 75 (amber)

### Font Loading Performance

The Google Fonts import includes:
1. `rel="preconnect"` for faster DNS lookup
2. `display=swap` for FOIT prevention (shows fallback font while loading)
3. Only required weights (no unnecessary font files)

### Background Texture Implementation

The noise texture uses an inline SVG data URI to avoid additional HTTP requests:
- `feTurbulence` creates procedural noise
- Very low opacity (0.03) for subtlety
- `position: fixed` ensures it covers the entire viewport
- `pointer-events: none` allows clicks to pass through

### Z-Index Considerations

After adding the body::before texture overlay:
- The overlay has `z-index: 1`
- Main content wrapper should have `z-index: 2` or higher (or position: relative)
- Modals/dialogs typically have z-index > 50

## Dependencies

**None** - This is the foundation phase with no external dependencies.

All required packages (Tailwind CSS, etc.) are already installed in the project.

## Out of Scope

The following are NOT part of Phase 1:
- Component style updates (buttons, cards, sidebar) - Phase 2
- Animation implementations (page transitions, chart animations) - Phase 3
- Bento Grid layout system - Phase 4
- Installing Framer Motion - Phase 3
- Dark mode toggle UI changes

This phase only establishes the CSS foundation that subsequent phases will build upon.

## Testing Checklist

After implementation, verify:

1. **Visual Check (Light Mode)**
   - [ ] App loads with warm amber accent color
   - [ ] Text is readable (neutral-900 on neutral-50 background)
   - [ ] Headings appear in serif font
   - [ ] Body text appears in sans-serif font
   - [ ] Background has subtle texture (zoom in to verify)

2. **Visual Check (Dark Mode)**
   - [ ] Toggle to dark mode
   - [ ] Amber color is slightly brighter (amber-500 vs amber-600)
   - [ ] Background uses neutral-900
   - [ ] Text is readable (neutral-50 on dark background)
   - [ ] Texture is visible but subtle

3. **Functional Check**
   - [ ] All interactive elements still clickable (texture not blocking)
   - [ ] Sidebar navigation works
   - [ ] All pages load without errors
   - [ ] No layout shifts or broken styles

## Reference

- Design System Spec: `.trellis/spec/frontend/design-system.md`
- Current CSS: `apps/desktop/src/index.css`
