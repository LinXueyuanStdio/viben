# Design System Phase 2: Component Updates

## Goal

Update and create core UI components to implement the Browse MCP design system visual language, including warm amber hover effects, bento grid cards, and refined sidebar styling.

## Background

This is Phase 2 of the Browse MCP design system implementation. Phase 1 (CSS Foundation) establishes the CSS variables, typography, and color system. This phase builds on those variables to update component behavior and appearance.

**Parent Task**: `.trellis/tasks/02-02-design-system-implementation/prd.md`
**Design Spec**: `.trellis/spec/frontend/design-system.md`

## Dependencies

**IMPORTANT**: Phase 1 (CSS Foundation) MUST be completed first.

Phase 1 provides:
- Brand color variables (`--brand-amber-*`, `--brand-peach-*`, `--brand-teal-*`)
- Neutral color scale (`--neutral-*`)
- Animation timing variables (`--duration-*`, `--ease-*`)
- Shadow system (`--shadow-*`, `--shadow-primary`)
- Spacing scale (`--space-*`)
- Border radius variables (`--radius-*`)
- Typography with Crimson Pro + Inter fonts

These CSS variables are required for the component updates in this phase.

## Requirements

### 1. Button Component Enhancement

**File**: `apps/desktop/src/components/ui/button.tsx`

Update the existing button component with design system enhancements:

1. **Hover Lift Effect**
   - Add `hover:-translate-y-0.5` transform on hover
   - Smooth transition using `--duration-fast` (200ms)
   - Use `--ease-out-expo` easing curve

2. **Colored Shadow on Hover**
   - Add warm amber shadow: `shadow-[0_8px_16px_-4px_oklch(0.70_0.18_75_/_0.3)]`
   - Or use `--shadow-primary` CSS variable if defined

3. **Active State**
   - Add `active:translate-y-0` to return to original position
   - Reduce shadow on active: `active:shadow-sm`

4. **Updated Color Mapping**
   - Primary variant uses `--brand-amber-600` background
   - Hover state uses `--brand-amber-700`
   - Focus ring uses brand amber color

5. **Variant Updates**
   - `default`: Solid amber with lift + colored shadow
   - `secondary`: Outlined with amber border, transparent bg, hover lift
   - `ghost`: Transparent, amber text on hover
   - `destructive`: Red (unchanged except for lift effect)
   - `outline`: Updated border color to use design system

### 2. Card Component Creation

**File**: `apps/desktop/src/components/ui/card.tsx` (NEW)

Create a new Card component with bento grid support:

1. **Base Card Styling**
   - Background: `var(--surface)` (white in light, neutral-800 in dark)
   - Border: `var(--border)` with 1px width
   - Border radius: `--radius-lg` (1rem/16px)
   - Padding: `--space-6` (1.5rem/24px)

2. **Hover Effects**
   - Border glow: `hover:border-primary/30`
   - Lift effect: `hover:-translate-y-1`
   - Shadow increase: `hover:shadow-lg`
   - Transition: `duration-300` with appropriate easing

3. **Bento Grid Size Variants**
   - `small`: `grid-column: span 4` (1/3 width)
   - `medium`: `grid-column: span 6` (1/2 width)
   - `large`: `grid-column: span 8` (2/3 width)
   - `full`: `grid-column: span 12` (full width)

4. **Height Variants**
   - `short`: `min-height: 200px`
   - `default`: Auto height
   - `tall`: `min-height: 400px`

5. **Gradient Background Option**
   - Optional `gradient` prop for subtle radial gradient
   - Implementation: `::before` pseudo-element with `radial-gradient`
   - Color: `oklch(0.70 0.18 75 / 0.05)` (subtle amber tint)

6. **Subcomponents**
   - `CardHeader`: For title and description
   - `CardTitle`: Using serif font (Crimson Pro)
   - `CardDescription`: Secondary text color
   - `CardContent`: Main content area
   - `CardFooter`: Actions area with proper spacing

### 3. Sidebar Component Updates

**File**: `apps/desktop/src/components/layout/sidebar.tsx`

Update existing sidebar with design system styling:

1. **Background Update**
   - Use `--sidebar` variable (warm-tinted background)
   - In dark mode: `--neutral-800` or `--neutral-900`

2. **Logo Area Enhancement**
   - Icon background: `--brand-amber-600`
   - Text: Serif font (Crimson Pro) for brand name
   - Subtle border-bottom using `--sidebar-border`

3. **Navigation Item Hover Animation**
   - Add smooth background transition
   - Use `--duration-fast` for hover state
   - Active item: Use `--sidebar-accent` with subtle amber tint
   - Hover item: Background slides in from left (optional)

4. **Active State Indicator**
   - Left border accent using `--brand-amber-600`
   - Or background highlight with `--sidebar-accent`
   - Font weight: `medium` (500) for active

5. **Color Updates**
   - Primary text: `--sidebar-foreground`
   - Secondary text: `--sidebar-foreground/70`
   - Icon color: Match text color, amber on active

## Technical Notes

### Animation Performance

- Use `transform` and `opacity` for animations (GPU accelerated)
- Avoid animating `width`, `height`, `top`, `left`
- Consider `will-change: transform` for frequently animated elements

### CSS Variable Usage

```css
/* Correct usage - reference CSS variables */
className="bg-[var(--brand-amber-600)]"

/* Or use Tailwind theme mapping if configured */
className="bg-primary"
```

### Tailwind CVA Pattern

Continue using `class-variance-authority` (cva) for variants:

```tsx
const cardVariants = cva(
  "base-classes-here",
  {
    variants: {
      size: { small: "...", medium: "...", large: "...", full: "..." },
      height: { short: "...", default: "...", tall: "..." },
    },
    defaultVariants: {
      size: "medium",
      height: "default",
    },
  }
);
```

### Dark Mode Compatibility

All components must work in both light and dark modes:
- Test hover states in both themes
- Verify shadow visibility (may need adjustment for dark mode)
- Ensure text contrast meets accessibility standards

## Acceptance Criteria

### Button Component
- [ ] Buttons lift on hover (`-translate-y-0.5`)
- [ ] Buttons have colored shadow on hover (warm amber tint)
- [ ] Buttons return to original position on active/click
- [ ] Transition timing uses design system variables
- [ ] All existing variants still work correctly
- [ ] Works in both light and dark mode

### Card Component
- [ ] Card component exists at `apps/desktop/src/components/ui/card.tsx`
- [ ] Supports size variants: small, medium, large, full
- [ ] Supports height variants: short, default, tall
- [ ] Has hover effect (border glow + lift + shadow)
- [ ] Optional gradient background works
- [ ] Includes subcomponents: CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- [ ] Uses design system colors and spacing
- [ ] Works in both light and dark mode

### Sidebar Component
- [ ] Uses updated color scheme from design system
- [ ] Navigation items have smooth hover animation
- [ ] Active item has visible indicator
- [ ] Logo area uses brand styling
- [ ] Colors work in both light and dark mode

### Overall Quality
- [ ] `pnpm typecheck` passes with no errors
- [ ] `pnpm lint` passes with no errors
- [ ] `pnpm dev` runs without console errors
- [ ] Components render correctly in the app
- [ ] No visual regressions in existing UI

## Out of Scope

The following are NOT part of this phase:

- Page transition animations (Phase 3)
- Dashboard chart animations (Phase 3)
- Loading/skeleton states (Phase 3)
- Bento Grid layout component (Phase 4)
- Responsive breakpoint handling for bento grid (Phase 4)
- Full dashboard layout refactor (Phase 4)

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `apps/desktop/src/components/ui/button.tsx` | Modify | Add hover lift, shadow, active states |
| `apps/desktop/src/components/ui/card.tsx` | Create | New bento-style card component |
| `apps/desktop/src/components/layout/sidebar.tsx` | Modify | Update colors and hover animations |

## Estimated Time

2-3 hours

## Reference

- Design System Spec: `.trellis/spec/frontend/design-system.md`
- Parent PRD: `.trellis/tasks/02-02-design-system-implementation/prd.md`
- Phase 1 Task: `.trellis/tasks/02-02-design-system-phase1-foundation/` (dependency)
