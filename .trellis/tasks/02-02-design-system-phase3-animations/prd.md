# Design System Phase 3: Animations & Polish

## Goal

Implement the animation and polish layer of the Browse MCP design system, bringing the interface to life with choreographed page transitions, staggered entrance animations, animated data visualizations, and smooth loading states.

This phase transforms the static UI (built in Phase 1 & 2) into a dynamic, memorable experience that reinforces the warm, future-forward brand identity.

## Background

Phase 1 established the foundation (CSS variables including animation timing and easing), and Phase 2 updated components with the new design tokens. Phase 3 adds the motion layer:

- **Framer Motion** for React-based page transitions and complex animation sequences
- **CSS animations** for simpler effects like skeleton loading and theme transitions
- **Staggered animations** for visual rhythm and perceived performance

The design system spec (`.trellis/spec/frontend/design-system.md`) defines the animation philosophy as "Choreographed Excellence" - every animation is purposeful, elegant, and part of a larger composition.

## Requirements

### 1. Install Framer Motion

- Add `framer-motion` as a dependency to `apps/desktop/package.json`
- Run `pnpm install` to install the package

### 2. Page Transition Animations

Update `apps/desktop/src/App.tsx`:

- Wrap the Routes with `AnimatePresence` from Framer Motion
- Create page transition variants:
  ```typescript
  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    enter: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
  };
  ```
- Wrap each page component with `motion.div` using these variants
- Consider creating a reusable `PageWrapper` component

### 3. Dashboard Enhancements

Update `apps/desktop/src/pages/dashboard.tsx`:

#### 3.1 StatCard Staggered Entrance

- Add stagger animation to StatCard components
- Each card fades in and slides up with 100ms delay between cards
- Use `motion.div` with staggerChildren variant

#### 3.2 Activity Heatmap Cascade Animation

- Each cell should appear with a cascade effect
- Delay based on row + column position: `(row + col) * 20ms`
- Scale from 0 to 1 with fade

#### 3.3 Line Chart Draw Animation

- Animate the chart path using `stroke-dasharray` and `stroke-dashoffset`
- Path should "draw" from left to right over 700ms
- Add `pathLength` animation if using Framer Motion

#### 3.4 Bar Charts Grow Animation

- Bars should grow from 0 to full height
- Use `scaleY` with `transform-origin: bottom`
- Stagger each bar with 100ms delay

### 4. Loading States

Create skeleton loading components in `apps/desktop/src/components/ui/skeleton.tsx`:

#### 4.1 Skeleton Component

```tsx
interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}
```

#### 4.2 Shimmer Effect

- Add CSS shimmer animation to skeleton components
- Use gradient animation moving left to right
- Animation duration: 1.5s, infinite loop

#### 4.3 Apply to Dashboard

- Show skeleton StatCards while `usageLoading` is true
- Show skeleton chart areas while data is loading
- Show skeleton heatmap grid while loading

### 5. Theme Toggle Animation

- Ensure Light/Dark theme toggle has smooth color transitions
- Add `transition: background-color 300ms, color 300ms, border-color 300ms` to body and key elements
- Optionally add a subtle scale/rotate animation to the theme toggle button

### 6. Animation CSS Variables (if not done in Phase 1)

Ensure `apps/desktop/src/index.css` includes:

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

## Acceptance Criteria

### Page Transitions
- [ ] `framer-motion` is installed and listed in package.json
- [ ] Page transitions have fade + slide animation (0 -> 20px x-axis)
- [ ] Transitions use `ease-out-expo` easing
- [ ] Enter duration is 300ms, exit duration is 200ms
- [ ] `AnimatePresence` properly handles route changes

### Dashboard Animations
- [ ] StatCards have staggered entrance (100ms delay between cards)
- [ ] StatCards fade in and slide up on page load
- [ ] Activity Heatmap cells have cascade animation based on position
- [ ] Line chart path "draws" from left to right
- [ ] Bar charts grow from bottom with stagger effect

### Loading States
- [ ] Skeleton component exists with text/circular/rectangular variants
- [ ] Skeleton has shimmer effect (gradient animation)
- [ ] Dashboard shows skeleton states while loading
- [ ] Skeletons match the approximate size/shape of real content

### Theme Toggle
- [ ] Theme switch has smooth color transition (300ms)
- [ ] All colored elements (background, text, borders) transition smoothly
- [ ] No visual glitches or flashing during theme change

### Animation Quality
- [ ] All animations use defined easing and duration variables
- [ ] Animations are performant (use transform/opacity, not width/height)
- [ ] No animation jank or stuttering (maintain 60 FPS)
- [ ] Animations can be disabled via `prefers-reduced-motion`

### Overall
- [ ] `pnpm dev` starts without errors
- [ ] `pnpm typecheck` passes
- [ ] No console errors related to Framer Motion or animations
- [ ] Dark mode animations work correctly

## Technical Notes

### Framer Motion Setup

Install with:
```bash
cd apps/desktop && pnpm add framer-motion
```

Basic page wrapper pattern:
```tsx
import { motion } from 'framer-motion';

export function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
```

### Stagger Animation Pattern

```tsx
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

<motion.div variants={containerVariants} initial="hidden" animate="show">
  {items.map((item) => (
    <motion.div key={item.id} variants={itemVariants}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

### Shimmer CSS Effect

```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--muted) 25%,
    var(--muted-foreground) 50%,
    var(--muted) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

### SVG Path Animation

For line charts:
```tsx
<motion.path
  d={pathD}
  initial={{ pathLength: 0 }}
  animate={{ pathLength: 1 }}
  transition={{ duration: 0.7, ease: "easeOut" }}
/>
```

### Performance Best Practices

1. **Animate transform and opacity only** - These properties are GPU-accelerated
2. **Use `will-change: transform`** for complex animations
3. **Avoid animating layout properties** (width, height, top, left)
4. **Use `layoutId` for shared element transitions** if needed
5. **Respect `prefers-reduced-motion`**:
   ```tsx
   const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   ```

### React Router v7 + AnimatePresence

Note: React Router v7 may require specific handling for AnimatePresence. The pattern typically involves:

```tsx
import { useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

function App() {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* routes */}
      </Routes>
    </AnimatePresence>
  );
}
```

## Dependencies

### Required Before Starting
- **Phase 1 Complete**: CSS animation variables (timing, easing) must be defined in index.css
- **Phase 2 Complete**: Components should use the design system tokens

### Package Dependencies
- `framer-motion`: `pnpm add framer-motion` in apps/desktop

### No Additional Dependencies Required
- Skeleton and shimmer effects use pure CSS
- Theme transitions use CSS transitions

## Out of Scope

- Bento Grid implementation (Phase 4)
- Responsive layout changes (Phase 4)
- Creating new chart types
- Complex physics-based animations
- 3D transforms or WebGL effects

## Files to Create/Modify

### Create
- `apps/desktop/src/components/ui/skeleton.tsx` - Skeleton loading component
- `apps/desktop/src/components/layout/page-wrapper.tsx` - Optional reusable page transition wrapper

### Modify
- `apps/desktop/package.json` - Add framer-motion
- `apps/desktop/src/App.tsx` - Add AnimatePresence and page transitions
- `apps/desktop/src/pages/dashboard.tsx` - Add stagger, chart, and heatmap animations
- `apps/desktop/src/index.css` - Add shimmer keyframes and animation utilities

## Estimated Time

3-4 hours

## Reference

- Design System Spec: `.trellis/spec/frontend/design-system.md` (Motion & Animation section)
- Parent Task PRD: `.trellis/tasks/02-02-design-system-implementation/prd.md`
- Framer Motion Docs: https://www.framer.com/motion/
