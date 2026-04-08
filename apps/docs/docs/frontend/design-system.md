---
sidebar_position: 2
title: Design System
description: Viben Design System - Warm Futuristic Aesthetics
---

# Viben Design System

> **Vision**: A warm, future-facing academic tool with distinctive motion design and custom visualizations.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Spacing and Layout](#spacing-and-layout)
5. [Motion and Animation](#motion-and-animation)
6. [Component Patterns](#component-patterns)
7. [Visual Details](#visual-details)
8. [Implementation Guide](#implementation-guide)

---

## Design Philosophy

### Core Principles

1. **Warm Futurism**: Combining futuristic design with approachable warmth
2. **Academic Authority**: Serif fonts + professional data visualization
3. **Memorable Motion**: Signature animations that users will remember
4. **Balanced Complexity**: Powerful enough for advanced users, accessible to all

### Target Users

- **Primary Users**: Broad user base (researchers, developers, AI builders)
- **Experience Goals**:
  - First Impression: Modern, innovative, forward-thinking
  - Lasting Memory: Warm orange tones + elegant motion

### Design Signatures (What Makes Us Unique)

- [ ] **Warm orange/amber color palette** (vs. typical AI tool blue/purple)
- [ ] **Elegant serif typography** (vs. generic Inter/Roboto)
- [ ] **Custom SVG visualizations** (vs. generic chart libraries)
- [ ] **Carefully choreographed motion design** (orchestrated, not scattered)

---

## Color System

### Brand Colors (OKLCH)

```css
/* Primary - Warm Amber/Orange */
--brand-amber-50: oklch(0.97 0.02 75);   /* Lightest tint */
--brand-amber-100: oklch(0.95 0.04 75);
--brand-amber-200: oklch(0.90 0.08 75);
--brand-amber-300: oklch(0.85 0.12 75);
--brand-amber-400: oklch(0.78 0.16 75);  /* Light accent */
--brand-amber-500: oklch(0.70 0.18 75);  /* Primary brand */
--brand-amber-600: oklch(0.62 0.18 75);  /* Primary hover */
--brand-amber-700: oklch(0.52 0.16 75);  /* Active state */
--brand-amber-800: oklch(0.42 0.14 75);
--brand-amber-900: oklch(0.32 0.12 75);  /* Darkest shade */

/* Secondary - Warm Peach (for accents) */
--brand-peach-400: oklch(0.82 0.14 55);
--brand-peach-500: oklch(0.75 0.16 55);
--brand-peach-600: oklch(0.68 0.16 55);

/* Neutrals - Warm Grays (not pure gray) */
--neutral-50: oklch(0.985 0.002 75);     /* Slightly warm tinted */
--neutral-100: oklch(0.97 0.002 75);
--neutral-200: oklch(0.92 0.004 75);
--neutral-300: oklch(0.85 0.004 75);
--neutral-400: oklch(0.70 0.004 75);
--neutral-500: oklch(0.56 0.004 75);
--neutral-600: oklch(0.44 0.004 75);
--neutral-700: oklch(0.32 0.004 75);
--neutral-800: oklch(0.22 0.004 75);
--neutral-900: oklch(0.15 0.004 75);

/* Accent - Teal (for data visualization contrast) */
--brand-teal-400: oklch(0.72 0.12 195);
--brand-teal-500: oklch(0.65 0.14 195);
--brand-teal-600: oklch(0.58 0.14 195);

/* Semantic Colors */
--color-success: oklch(0.65 0.18 145);   /* Green */
--color-warning: oklch(0.70 0.18 75);    /* Amber (reuse brand) */
--color-error: oklch(0.58 0.22 25);      /* Red */
--color-info: oklch(0.62 0.18 240);      /* Blue */
```

### Theme Mapping

**Light Theme**:
```css
:root {
  /* Backgrounds */
  --background: var(--neutral-50);
  --surface: oklch(1 0 0);              /* Pure white cards */
  --surface-elevated: var(--neutral-100);

  /* Text */
  --foreground: var(--neutral-900);
  --foreground-secondary: var(--neutral-600);
  --foreground-tertiary: var(--neutral-500);

  /* Brand */
  --primary: var(--brand-amber-600);
  --primary-hover: var(--brand-amber-700);
  --primary-foreground: oklch(1 0 0);

  /* Borders */
  --border: var(--neutral-200);
  --border-strong: var(--neutral-300);
}
```

**Dark Theme**:
```css
.dark {
  /* Backgrounds */
  --background: var(--neutral-900);
  --surface: var(--neutral-800);
  --surface-elevated: var(--neutral-700);

  /* Text */
  --foreground: var(--neutral-50);
  --foreground-secondary: var(--neutral-400);
  --foreground-tertiary: var(--neutral-500);

  /* Brand (slightly brighter on dark) */
  --primary: var(--brand-amber-500);
  --primary-hover: var(--brand-amber-400);
  --primary-foreground: var(--neutral-900);

  /* Borders */
  --border: var(--neutral-700);
  --border-strong: var(--neutral-600);
}
```

### Color Usage Rules

1. **DO**: Use warm amber as the primary action color (buttons, links, highlights)
2. **DO**: Use teal for data visualization to contrast with amber
3. **DO**: Use neutral-50 (not pure white) for light backgrounds to maintain warmth
4. **DON'T**: Use cool grays - all grays should have a slight warm tint
5. **DON'T**: Overuse color - let amber be the hero with plenty of neutral space

---

## Typography

### Font Stack

**Display & Headings** (serif for authority):
```css
font-family: 'Crimson Pro', 'Source Serif Pro', 'Georgia', 'Times New Roman', serif;
```

**Body Text** (sans-serif for readability):
```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
```

**Code & Monospace**:
```css
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
```

### Type Scale

```css
/* Display - for hero sections */
--font-display-size: 3.5rem;      /* 56px */
--font-display-line-height: 1.1;
--font-display-weight: 600;
--font-display-letter-spacing: -0.02em;

/* Heading 1 - page titles */
--font-h1-size: 2.25rem;          /* 36px */
--font-h1-line-height: 1.2;
--font-h1-weight: 600;
--font-h1-letter-spacing: -0.015em;

/* Heading 2 - section headers */
--font-h2-size: 1.875rem;         /* 30px */
--font-h2-line-height: 1.25;
--font-h2-weight: 600;
--font-h2-letter-spacing: -0.01em;

/* Heading 3 - subsection headers */
--font-h3-size: 1.5rem;           /* 24px */
--font-h3-line-height: 1.3;
--font-h3-weight: 600;
--font-h3-letter-spacing: -0.005em;

/* Heading 4 */
--font-h4-size: 1.25rem;          /* 20px */
--font-h4-line-height: 1.4;
--font-h4-weight: 600;

/* Body Large */
--font-body-lg-size: 1.125rem;    /* 18px */
--font-body-lg-line-height: 1.6;
--font-body-lg-weight: 400;

/* Body */
--font-body-size: 1rem;           /* 16px */
--font-body-line-height: 1.6;
--font-body-weight: 400;

/* Body Small */
--font-body-sm-size: 0.875rem;    /* 14px */
--font-body-sm-line-height: 1.5;
--font-body-sm-weight: 400;

/* Caption */
--font-caption-size: 0.75rem;     /* 12px */
--font-caption-line-height: 1.4;
--font-caption-weight: 500;
--font-caption-letter-spacing: 0.01em;
```

### Usage Guidelines

1. **Headings (h1-h4)**: Always use serif (Crimson Pro)
2. **Body Text**: Use sans-serif (Inter) for screen readability
3. **Data Labels**: Use monospace (JetBrains Mono) for precision
4. **Emphasis**: Use weight variation (500/600) rather than italic for clarity

**Implementation Example**:
```css
h1, h2, h3, h4, h5, h6 {
  font-family: 'Crimson Pro', serif;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--foreground);
}

body, p, span, div {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  color: var(--foreground);
}
```

---

## Spacing and Layout

### Spacing Scale

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

### Layout System: Bento Grid

**Philosophy**: Flexible card-based layout where cards have varied sizes, creating visual rhythm.

**Grid Structure**:
```css
.bento-grid {
  display: grid;
  gap: var(--space-6);
  grid-template-columns: repeat(12, 1fr);
}

/* Card size variants */
.bento-card-small {
  grid-column: span 4;  /* 1/3 width */
}

.bento-card-medium {
  grid-column: span 6;  /* 1/2 width */
}

.bento-card-large {
  grid-column: span 8;  /* 2/3 width */
}

.bento-card-full {
  grid-column: span 12; /* Full width */
}

/* Height variants */
.bento-card-short {
  min-height: 200px;
}

.bento-card-tall {
  min-height: 400px;
}

.bento-card-hero {
  min-height: 600px;
}
```

**Responsive Breakpoints**:
```css
/* Mobile: single column */
@media (max-width: 640px) {
  .bento-card-small,
  .bento-card-medium,
  .bento-card-large,
  .bento-card-full {
    grid-column: span 12;
  }
}

/* Tablet: 2-3 columns */
@media (min-width: 641px) and (max-width: 1024px) {
  .bento-card-small {
    grid-column: span 6;
  }
  .bento-card-large {
    grid-column: span 12;
  }
}
```

### Layout Patterns

**Dashboard Layout**:

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  ← Small (4 cols)   │
│ │   Stat 1    │ │   Stat 2    │ │   Stat 3    │ │   Stat 4    │                     │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘                     │
│                                                                                      │
│ ┌─────────────────────────────────────────────┐ ┌───────────────────┐               │
│ │                                             │ │                   │  ← Large (8)  │
│ │           Large Chart                       │ │   Medium Card     │    + Medium(4)│
│ │                                             │ │                   │               │
│ └─────────────────────────────────────────────┘ └───────────────────┘               │
│                                                                                      │
│ ┌────────────────────────────────────────────────────────────────────┐              │
│ │                                                                    │  ← Full-width│
│ │              Full-width Activity Heatmap                           │              │
│ │                                                                    │              │
│ └────────────────────────────────────────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Motion and Animation

### Animation Philosophy

**"Orchestrated Excellence"**: Every animation is purposeful, elegant, and part of an overall composition. Avoid scattered micro-interactions.

### Timing

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

### Key Animation Patterns

#### 1. Page Load Sequence (Hero Animation)

**Staggered reveal with fade + slide**:

```css
/* Container for staggered children */
.page-enter {
  animation: fade-in var(--duration-slow) var(--ease-out-expo);
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Stagger delay for children */
.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 100ms; }
.stagger-item:nth-child(3) { animation-delay: 200ms; }
.stagger-item:nth-child(4) { animation-delay: 300ms; }
```

#### 2. Card Entrance

**Scale + fade + lift**:

```css
.card-enter {
  animation: card-pop-in var(--duration-normal) var(--ease-out-back);
}

@keyframes card-pop-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
```

#### 3. Button Interactions

**Hover + active states with spring**:

```css
.button {
  transition: all var(--duration-fast) var(--ease-out-expo);
}

.button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px -4px oklch(0.70 0.18 75 / 0.3);
}

.button:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px -2px oklch(0.70 0.18 75 / 0.2);
}
```

#### 4. Data Visualization Animations

**Chart animations on mount**:

```css
/* Line chart path animation */
.chart-path {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: draw-line var(--duration-slower) var(--ease-out-expo) forwards;
}

@keyframes draw-line {
  to {
    stroke-dashoffset: 0;
  }
}

/* Bar chart grow animation */
.bar-fill {
  transform-origin: bottom;
  animation: grow-bar var(--duration-normal) var(--ease-out-back);
  animation-fill-mode: both;
}

@keyframes grow-bar {
  from {
    transform: scaleY(0);
  }
  to {
    transform: scaleY(1);
  }
}

/* Stagger bars */
.bar-fill:nth-child(1) { animation-delay: 100ms; }
.bar-fill:nth-child(2) { animation-delay: 200ms; }
.bar-fill:nth-child(3) { animation-delay: 300ms; }
```

#### 5. Heatmap Cell Animation

**Cascade effect**:

```css
.heatmap-cell {
  animation: cell-pop var(--duration-fast) var(--ease-out-back);
  animation-fill-mode: both;
}

@keyframes cell-pop {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* Position-based cascade delay */
.heatmap-cell {
  animation-delay: calc((var(--row) + var(--col)) * 20ms);
}
```

#### 6. Navigation Transitions

**Page slide transitions**:

```tsx
/* Framer Motion page transition variants */
const pageVariants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  enter: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1], // ease-out-expo
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: {
      duration: 0.2,
    },
  },
};
```

### Animation Checklist

- [ ] Page load: Staggered fade + slide
- [ ] Card entrance: Scale + fade with spring easing
- [ ] Button hover: Lift with shadow
- [ ] Chart data: Animated draw/grow
- [ ] Heatmap: Cascading cell appearance
- [ ] Page transitions: Smooth horizontal slide
- [ ] Skeleton loading: Shimmer effect
- [ ] Success states: Celebratory bounce

---

## Component Patterns

### Button

**Variants**:
- `primary`: Solid amber background
- `secondary`: Amber border outline
- `ghost`: Transparent, amber text on hover
- `destructive`: Red for dangerous actions

**Sizes**: `sm`, `md`, `lg`

```tsx
// Enhanced button with hover lift
const Button = ({ variant = 'primary', size = 'md', children }) => (
  <button
    className={cn(
      'inline-flex items-center justify-center rounded-lg font-medium',
      'transition-all duration-200 ease-out-expo',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      'disabled:opacity-50 disabled:pointer-events-none',
      variant === 'primary' && [
        'bg-primary text-primary-foreground',
        'hover:bg-primary-hover hover:-translate-y-0.5',
        'hover:shadow-[0_8px_16px_-4px_oklch(0.70_0.18_75_/_0.3)]',
        'active:translate-y-0 active:shadow-sm',
      ],
      variant === 'secondary' && [
        'border-2 border-primary text-primary bg-transparent',
        'hover:bg-primary/10 hover:-translate-y-0.5',
        'active:translate-y-0',
      ],
      size === 'sm' && 'h-9 px-4 text-sm',
      size === 'md' && 'h-11 px-6 text-base',
      size === 'lg' && 'h-13 px-8 text-lg',
    )}
  >
    {children}
  </button>
);
```

### Card

**Bento-style card with hover effects**:

```tsx
const Card = ({ children, className, size = 'medium' }) => (
  <div
    className={cn(
      'rounded-2xl bg-surface border border-border',
      'p-6 transition-all duration-300',
      'hover:border-primary/30 hover:shadow-lg',
      'hover:-translate-y-1',
      size === 'small' && 'bento-card-small',
      size === 'medium' && 'bento-card-medium',
      size === 'large' && 'bento-card-large',
      className
    )}
  >
    {children}
  </div>
);
```

### StatCard

**Dashboard stat card with icon and animated value**:

```tsx
const StatCard = ({ title, value, change, icon: Icon }) => (
  <Card size="small" className="bento-card-short">
    <div className="flex items-start justify-between mb-4">
      <span className="text-sm text-foreground-secondary">{title}</span>
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="text-3xl font-serif font-semibold mb-2 animate-count-up">
      {value}
    </div>
    {change && (
      <div className="flex items-center gap-1 text-sm">
        <TrendingUp className="h-4 w-4 text-success" />
        <span className="text-success">+{change}%</span>
      </div>
    )}
  </Card>
);
```

### ChartContainer

**Wrapper for custom SVG charts**:

```tsx
const ChartContainer = ({ title, subtitle, children }) => (
  <Card size="large" className="bento-card-tall">
    <div className="mb-6">
      <h3 className="text-xl font-serif font-semibold mb-1">{title}</h3>
      {subtitle && (
        <p className="text-sm text-foreground-secondary">{subtitle}</p>
      )}
    </div>
    <div className="chart-container">
      {children}
    </div>
  </Card>
);
```

---

## Visual Details

### Subtle Background Textures

**Noise overlay for depth**:

```css
body {
  background: var(--background);
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

**Subtle gradient mesh on cards**:

```css
.card-gradient {
  position: relative;
  overflow: hidden;
}

.card-gradient::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at 10% 20%,
    oklch(0.70 0.18 75 / 0.05),
    transparent 60%
  );
  pointer-events: none;
}
```

### Border Radius System

```css
--radius-sm: 0.5rem;    /* 8px - small elements */
--radius-md: 0.75rem;   /* 12px - buttons, inputs */
--radius-lg: 1rem;      /* 16px - cards */
--radius-xl: 1.5rem;    /* 24px - large cards */
--radius-2xl: 2rem;     /* 32px - hero sections */
```

### Shadow System

```css
/* Elevation shadows with warm amber tint */
--shadow-xs: 0 1px 2px 0 oklch(0 0 0 / 0.05);
--shadow-sm: 0 1px 3px 0 oklch(0 0 0 / 0.1),
             0 1px 2px -1px oklch(0 0 0 / 0.1);
--shadow-md: 0 4px 6px -1px oklch(0 0 0 / 0.1),
             0 2px 4px -2px oklch(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px oklch(0 0 0 / 0.1),
             0 4px 6px -4px oklch(0 0 0 / 0.1);
--shadow-xl: 0 20px 25px -5px oklch(0 0 0 / 0.1),
             0 8px 10px -6px oklch(0 0 0 / 0.1);

/* Colored shadow for primary buttons */
--shadow-primary: 0 8px 16px -4px oklch(0.70 0.18 75 / 0.3);
```

---

## Implementation Guide

### CSS Architecture

**Use CSS custom properties for theming**:

```css
/* ✅ Correct */
.button {
  background: var(--primary);
  color: var(--primary-foreground);
}

/* ❌ Wrong - hardcoded colors */
.button {
  background: #f59e0b;
  color: white;
}
```

**Use Tailwind utilities for spacing/layout, custom CSS for complex animations**:

```tsx
// ✅ Correct - Tailwind for spacing
<div className="p-6 space-y-4">

// ✅ Correct - Custom class for complex animation
<div className="card-enter-animation">

// ❌ Wrong - Inline styles for animation
<div style={{ animation: 'fadeIn 300ms' }}>
```

### Animation Implementation

**Prefer CSS animations for simple transitions**:

```css
/* ✅ Correct - Pure CSS */
.button {
  transition: transform 200ms ease-out-expo;
}

.button:hover {
  transform: translateY(-2px);
}
```

**Use Framer Motion for complex sequences**:

```tsx
// ✅ Correct - Framer Motion for orchestrated sequences
<motion.div
  variants={pageVariants}
  initial="initial"
  animate="enter"
  exit="exit"
>
  {children}
</motion.div>
```

### Custom Chart Guidelines

1. **Always use SVG** for charts (not canvas or third-party libraries)
2. **Animate paths** on mount with stroke-dasharray
3. **Use brand colors**: Amber for primary data, teal for secondary
4. **Accessibility**: Include aria-labels and title elements

Example:
```tsx
<svg viewBox="0 0 100 100" className="w-full h-full">
  <title>Activity over time</title>
  <path
    d={pathData}
    fill="none"
    stroke="var(--brand-amber-600)"
    strokeWidth="2"
    className="chart-path"
    vectorEffect="non-scaling-stroke"
  />
</svg>
```

---

## Anti-patterns (What NOT to Do)

### Don't: Generic AI Tool Aesthetics

- **Purple gradients on white** (overused in AI tools)
- **Inter/Roboto everywhere** (lacks personality)
- **Flat gray color schemes** (boring and forgettable)
- **Generic chart libraries** (recharts with default styling)

### Don't: Scattered Micro-interactions

```tsx
// Wrong - random animations everywhere
<div className="hover:scale-105">
  <div className="hover:rotate-2">
    <div className="hover:brightness-110">
```

Instead: Orchestrate purposeful animation sequences

### Don't: Inconsistent Spacing

```tsx
// Wrong - arbitrary spacing values
<div className="mt-3 mb-5 p-7">

// Correct - use the spacing scale
<div className="mt-4 mb-6 p-8">
```

---

## New Component Checklist

Before adding a new component, verify:

- [ ] Uses warm amber (`var(--primary)`) for primary actions
- [ ] Typography: Serif for headings, sans-serif for body
- [ ] Spacing: Uses spacing scale (4, 6, 8, 12, etc.)
- [ ] Motion: Purposeful hover/entrance animations
- [ ] Dark mode: Works in both light and dark themes
- [ ] Accessibility: Proper aria labels, focus states
- [ ] Responsive: Works on mobile/tablet/desktop
- [ ] Bento-ready: Can resize to small/medium/large cards

---

## Migration from Current Design

### Phase 1: Foundation

- [ ] Update CSS variables to new color system
- [ ] Replace system font stack with Crimson Pro + Inter
- [ ] Add animation timing variables

### Phase 2: Components

- [ ] Update Button component with hover lift
- [ ] Refactor cards to Bento grid system
- [ ] Add animation classes

### Phase 3: Polish

- [ ] Add subtle background textures
- [ ] Implement page transition animations
- [ ] Enhance chart animations
- [ ] Add staggered loading sequences

---

## Resources

### Fonts

- **Crimson Pro**: [Google Fonts](https://fonts.google.com/specimen/Crimson+Pro)
- **Inter**: [Google Fonts](https://fonts.google.com/specimen/Inter)
- **JetBrains Mono**: [JetBrains](https://www.jetbrains.com/lp/mono/)

### Color Tools

- **OKLCH Color Picker**: [oklch.com](https://oklch.com/)
- **Color Space Converter**: [colorjs.io](https://colorjs.io/)

### Animation Libraries

- **Framer Motion**: [framer.com/motion](https://www.framer.com/motion/)
- **Easing Functions**: [easings.net](https://easings.net/)

---

**Last Updated**: 2026-02-28
**Version**: 1.0.0
**Status**: Completed - Ready for Implementation
