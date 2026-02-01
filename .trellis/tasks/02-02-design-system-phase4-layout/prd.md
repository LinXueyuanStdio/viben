# Design System Phase 4: Bento Grid Layout

## Goal

Implement a flexible 12-column Bento Grid layout system and refactor the Dashboard to use it. This phase creates the foundational layout infrastructure that enables the distinctive card-based "Bento box" aesthetic defined in the Browse MCP design system.

## Background

The current Dashboard uses ad-hoc grid layouts with inconsistent column spans. Phase 4 establishes a unified grid system that:
- Provides consistent, reusable layout patterns
- Enables responsive behavior across all screen sizes
- Creates visual rhythm through varying card sizes
- Supports the warm, modern aesthetic of the design system

## Dependencies

**Phase 2 must be completed first:**
- Card component (`apps/desktop/src/components/ui/card.tsx`) must exist with:
  - Bento Grid size variants (small, medium, large, full)
  - Hover effects (border glow + lift + shadow)
  - Gradient background support

If the Card component is not available, create a minimal version as part of this phase.

## Requirements

### 1. Bento Grid Component

Create `apps/desktop/src/components/layout/bento-grid.tsx` with:

**Grid Container:**
```css
display: grid;
gap: var(--space-6);           /* 24px gap */
grid-template-columns: repeat(12, 1fr);
```

**Card Size Variants:**
- `small`: span 4 columns (1/3 width)
- `medium`: span 6 columns (1/2 width)
- `large`: span 8 columns (2/3 width)
- `full`: span 12 columns (full width)

**Height Variants:**
- `short`: min-height 200px
- `tall`: min-height 400px
- `hero`: min-height 600px

**Component API:**
```tsx
// BentoGrid - Container component
<BentoGrid gap="lg">
  {children}
</BentoGrid>

// BentoCard - Individual card with size/height control
<BentoCard size="medium" height="short">
  {children}
</BentoCard>
```

### 2. Responsive Breakpoints

Implement responsive behavior:

| Breakpoint | Small | Medium | Large | Full |
|------------|-------|--------|-------|------|
| Mobile (<640px) | 12 cols | 12 cols | 12 cols | 12 cols |
| Tablet (641-1024px) | 6 cols | 6 cols | 12 cols | 12 cols |
| Desktop (>1024px) | 4 cols | 6 cols | 8 cols | 12 cols |

### 3. Dashboard Refactoring

Refactor `apps/desktop/src/pages/dashboard.tsx` to use Bento Grid:

**Target Layout:**
```
Desktop Layout:
+-------+-------+-------+-------+
|  Stat |  Stat |  Stat |  Stat |  <- 4x Small cards
+---------------+---------------+
|               |               |
|  Line Chart   |  Bar Chart    |  <- Large + Medium
|               |               |
+-------------------------------+
|                               |
|      Activity Heatmap         |  <- Full width
|                               |
+---------------+---------------+
|  Source Usage |  Quick Actions|  <- 2x Medium
+---------------+---------------+
|       Environment Status      |  <- Full width
+-------------------------------+
```

**Migration Tasks:**
- [ ] Replace manual `grid-cols-*` classes with BentoGrid
- [ ] Convert StatCard to use BentoCard wrapper
- [ ] Wrap chart containers in BentoCard
- [ ] Apply consistent card styling

### 4. CSS Grid Utilities

Add to `apps/desktop/src/index.css`:

```css
/* Bento Grid base styles */
.bento-grid {
  display: grid;
  gap: var(--space-6);
  grid-template-columns: repeat(12, 1fr);
}

/* Size variants */
.bento-card-small { grid-column: span 4; }
.bento-card-medium { grid-column: span 6; }
.bento-card-large { grid-column: span 8; }
.bento-card-full { grid-column: span 12; }

/* Height variants */
.bento-card-short { min-height: 200px; }
.bento-card-tall { min-height: 400px; }
.bento-card-hero { min-height: 600px; }

/* Responsive overrides */
@media (max-width: 640px) {
  .bento-card-small,
  .bento-card-medium,
  .bento-card-large,
  .bento-card-full {
    grid-column: span 12;
  }
}

@media (min-width: 641px) and (max-width: 1024px) {
  .bento-card-small { grid-column: span 6; }
  .bento-card-large { grid-column: span 12; }
}
```

## Acceptance Criteria

### Component Implementation
- [ ] `bento-grid.tsx` exists at `apps/desktop/src/components/layout/`
- [ ] BentoGrid component exports properly from components index
- [ ] BentoCard supports all size variants: small, medium, large, full
- [ ] BentoCard supports all height variants: short, tall, hero
- [ ] Components use TypeScript with proper type definitions

### Dashboard Refactoring
- [ ] Dashboard imports and uses BentoGrid/BentoCard
- [ ] All stat cards wrapped in BentoCard with size="small"
- [ ] Chart sections use appropriate BentoCard sizes
- [ ] Activity heatmap uses full width BentoCard
- [ ] Layout matches the target design diagram

### Responsive Design
- [ ] Mobile (<640px): All cards span full width (single column)
- [ ] Tablet (641-1024px): Small cards span 6 cols, large spans 12
- [ ] Desktop (>1024px): Full grid system active with all sizes
- [ ] No horizontal scrolling on any screen size
- [ ] Sidebar collapse works correctly on smaller screens

### Quality Checks
- [ ] `pnpm dev` starts without errors
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] No console errors on Dashboard page
- [ ] Grid renders correctly in both Light and Dark modes

## Technical Notes

### Grid Gap Spacing

Use consistent gap values from spacing scale:
- Default gap: `var(--space-6)` (24px)
- Compact gap: `var(--space-4)` (16px)
- Wide gap: `var(--space-8)` (32px)

If `--space-*` variables are not yet defined (Phase 1 incomplete), use Tailwind gap utilities: `gap-6`, `gap-4`, `gap-8`.

### Tailwind CSS Grid Classes

The implementation can leverage Tailwind's grid utilities:
```tsx
// Using Tailwind classes
<div className="grid grid-cols-12 gap-6">
  <div className="col-span-4 lg:col-span-4 md:col-span-6 sm:col-span-12">
```

Or use custom CSS classes for cleaner JSX:
```tsx
// Using custom Bento classes
<div className="bento-grid">
  <div className="bento-card-small">
```

### Card Component Compatibility

If Phase 2 Card component exists, BentoCard should compose it:
```tsx
const BentoCard = ({ size, height, children, ...props }) => (
  <Card className={cn(sizeClasses[size], heightClasses[height])} {...props}>
    {children}
  </Card>
);
```

If Card component does not exist, BentoCard should implement basic card styling:
```tsx
const BentoCard = ({ size, height, children, className }) => (
  <div className={cn(
    "rounded-lg border bg-card p-6",
    sizeClasses[size],
    heightClasses[height],
    className
  )}>
    {children}
  </div>
);
```

### Sidebar Interaction

The main content area sits beside the sidebar. Ensure:
- Grid width respects sidebar width
- No layout shift when sidebar collapses
- Content remains readable at all breakpoints

## Out of Scope

- Card hover animations (Phase 2 or 3)
- Page transition animations (Phase 3)
- Custom SVG chart implementations
- Skeleton loading states
- Theme toggle functionality

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `apps/desktop/src/components/layout/bento-grid.tsx` | CREATE | New Bento Grid component |
| `apps/desktop/src/components/layout/index.ts` | MODIFY | Export BentoGrid |
| `apps/desktop/src/pages/dashboard.tsx` | MODIFY | Refactor to use BentoGrid |
| `apps/desktop/src/index.css` | MODIFY | Add grid CSS utilities |

## Reference

- Design System Spec: `.trellis/spec/frontend/design-system.md` (Section: Spacing & Layout)
- Parent PRD: `.trellis/tasks/02-02-design-system-implementation/prd.md` (Phase 4)

---

**Phase**: 4 of 4  
**Estimated Time**: 2-3 hours  
**Priority**: P2  
**Status**: Planning
