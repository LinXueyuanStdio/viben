# Pet Package Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create React components and hooks for rendering and interacting with the pet sprite.

**Architecture:** React components using CSS sprite animation. Hooks encapsulate drag handling, animation state, and ambient cycling. Components are headless-friendly with style injection points.

**Tech Stack:** React 18, TypeScript, CSS Modules (optional), Framer Motion (optional)

**Spec Reference:** `docs/superpowers/specs/2026-05-31-pets-v1-design.md`

**Depends On:** Plan 1 (packages/pet core) must be completed first.

---

## File Structure

```
packages/pet/src/
├── components/
│   ├── PetSprite.tsx         # Sprite renderer with CSS animation
│   ├── PetContainer.tsx      # Draggable container with interaction handling
│   ├── PetBubble.tsx         # Speech bubble component
│   └── index.ts              # Component exports
├── hooks/
│   ├── usePetAnimation.ts    # Animation row selection and timing
│   ├── usePetDrag.ts         # Pointer drag handling
│   ├── usePetAmbient.ts      # Ambient animation cycling
│   └── index.ts              # Hook exports
├── styles/
│   └── pet.css               # Base styles and keyframes
└── index.ts                  # Updated exports
```

---

## Task 1: Base Styles

**Files:**
- Create: `packages/pet/src/styles/pet.css`

- [ ] **Step 1: Create pet.css with keyframes and base styles**

```css
/* packages/pet/src/styles/pet.css */

/* Sprite animation keyframe - moves horizontally through frames */
@keyframes pet-sprite-play {
  from {
    background-position-x: 0;
  }
  to {
    background-position-x: var(--pet-sprite-end-x, -1536px);
  }
}

/* Container styles */
.pet-container {
  position: fixed;
  z-index: 9999;
  user-select: none;
  touch-action: none;
  cursor: grab;
}

.pet-container[data-dragging="true"] {
  cursor: grabbing;
}

/* Sprite wrapper */
.pet-sprite {
  position: relative;
  width: var(--pet-cell-width, 192px);
  height: var(--pet-cell-height, 208px);
}

/* Sprite image layer */
.pet-sprite-image {
  width: 100%;
  height: 100%;
  background-repeat: no-repeat;
  background-position-y: var(--pet-row-offset, 0);
  animation: pet-sprite-play var(--pet-duration, 1s) steps(var(--pet-frames, 6)) infinite;
}

/* Glow/shadow effect */
.pet-sprite-shadow {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 8px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.2) 0%, transparent 70%);
  pointer-events: none;
}

/* Speech bubble */
.pet-bubble {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-bottom: 8px;
  padding: 8px 12px;
  background: var(--pet-bubble-bg, white);
  border: 1px solid var(--pet-bubble-border, #e5e5e5);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  max-width: 200px;
  font-size: 13px;
  line-height: 1.4;
  white-space: pre-wrap;
}

.pet-bubble::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: var(--pet-bubble-bg, white);
  border-bottom: none;
}

.pet-bubble-name {
  font-weight: 600;
  font-size: 12px;
  color: var(--pet-accent, #6366f1);
  margin-bottom: 4px;
}

.pet-bubble-text {
  color: #374151;
}

/* Animation states */
.pet-sprite[data-interaction="idle"] .pet-sprite-image {
  /* Default idle animation */
}

.pet-sprite[data-interaction="hover"] .pet-sprite-image {
  /* Waving animation - different row */
}

.pet-sprite[data-interaction="waiting"] .pet-sprite-image {
  animation-play-state: running;
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .pet-sprite-image {
    animation: none;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/pet/src/styles/pet.css
git commit -m "feat(pet): add base CSS styles and sprite animation keyframes"
```

---

## Task 2: usePetDrag Hook

**Files:**
- Create: `packages/pet/src/hooks/usePetDrag.ts`
- Create: `packages/pet/tests/hooks/usePetDrag.test.ts`

- [ ] **Step 1: Write failing tests for usePetDrag**

```typescript
// packages/pet/tests/hooks/usePetDrag.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePetDrag } from '../../src/hooks/usePetDrag';

describe('usePetDrag', () => {
  it('initializes with not dragging', () => {
    const { result } = renderHook(() =>
      usePetDrag({
        position: { right: 24, bottom: 24 },
        onPositionChange: vi.fn(),
      })
    );

    expect(result.current.isDragging).toBe(false);
    expect(result.current.dragDirection).toBeNull();
  });

  it('starts drag on pointer down', () => {
    const { result } = renderHook(() =>
      usePetDrag({
        position: { right: 24, bottom: 24 },
        onPositionChange: vi.fn(),
      })
    );

    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        clientX: 100,
        clientY: 100,
        currentTarget: { setPointerCapture: vi.fn() },
        pointerId: 1,
      } as unknown as React.PointerEvent);
    });

    expect(result.current.isDragging).toBe(true);
  });

  it('ignores non-primary button', () => {
    const { result } = renderHook(() =>
      usePetDrag({
        position: { right: 24, bottom: 24 },
        onPositionChange: vi.fn(),
      })
    );

    act(() => {
      result.current.handlers.onPointerDown({
        button: 2, // Right click
        clientX: 100,
        clientY: 100,
        currentTarget: { setPointerCapture: vi.fn() },
        pointerId: 1,
      } as unknown as React.PointerEvent);
    });

    expect(result.current.isDragging).toBe(false);
  });

  it('calls onPositionChange during drag', () => {
    const onPositionChange = vi.fn();
    const { result } = renderHook(() =>
      usePetDrag({
        position: { right: 100, bottom: 100 },
        onPositionChange,
      })
    );

    // Start drag
    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        clientX: 200,
        clientY: 200,
        currentTarget: { setPointerCapture: vi.fn() },
        pointerId: 1,
      } as unknown as React.PointerEvent);
    });

    // Move pointer
    act(() => {
      result.current.handlers.onPointerMove({
        clientX: 250,
        clientY: 200,
      } as unknown as React.PointerEvent);
    });

    expect(onPositionChange).toHaveBeenCalled();
  });

  it('detects drag direction', () => {
    const { result } = renderHook(() =>
      usePetDrag({
        position: { right: 100, bottom: 100 },
        onPositionChange: vi.fn(),
      })
    );

    // Start drag
    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        clientX: 200,
        clientY: 200,
        currentTarget: { setPointerCapture: vi.fn() },
        pointerId: 1,
      } as unknown as React.PointerEvent);
    });

    // Move significantly to the right
    act(() => {
      result.current.handlers.onPointerMove({
        clientX: 280,
        clientY: 200,
      } as unknown as React.PointerEvent);
    });

    expect(result.current.dragDirection).toBe('drag-right');
  });

  it('ends drag on pointer up', () => {
    const { result } = renderHook(() =>
      usePetDrag({
        position: { right: 24, bottom: 24 },
        onPositionChange: vi.fn(),
      })
    );

    // Start drag
    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        clientX: 100,
        clientY: 100,
        currentTarget: { setPointerCapture: vi.fn() },
        pointerId: 1,
      } as unknown as React.PointerEvent);
    });

    expect(result.current.isDragging).toBe(true);

    // End drag
    act(() => {
      result.current.handlers.onPointerUp({
        currentTarget: { releasePointerCapture: vi.fn() },
        pointerId: 1,
      } as unknown as React.PointerEvent);
    });

    expect(result.current.isDragging).toBe(false);
    expect(result.current.dragDirection).toBeNull();
  });

  it('detects tap (no movement)', () => {
    const onTap = vi.fn();
    const { result } = renderHook(() =>
      usePetDrag({
        position: { right: 24, bottom: 24 },
        onPositionChange: vi.fn(),
        onTap,
      })
    );

    // Start and immediately end (tap)
    act(() => {
      result.current.handlers.onPointerDown({
        button: 0,
        clientX: 100,
        clientY: 100,
        currentTarget: { setPointerCapture: vi.fn() },
        pointerId: 1,
      } as unknown as React.PointerEvent);
    });

    act(() => {
      result.current.handlers.onPointerUp({
        currentTarget: { releasePointerCapture: vi.fn() },
        pointerId: 1,
      } as unknown as React.PointerEvent);
    });

    expect(onTap).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Install testing library**

Run:
```bash
cd packages/pet && pnpm add -D @testing-library/react jsdom
```

- [ ] **Step 3: Update vitest.config.ts for React testing**

```typescript
// packages/pet/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
  },
});
```

- [ ] **Step 4: Create test setup file**

```typescript
// packages/pet/tests/setup.ts
import '@testing-library/react';
```

- [ ] **Step 5: Run tests to verify they fail**

Run:
```bash
cd packages/pet && pnpm test
```

Expected: FAIL - module not found

- [ ] **Step 6: Implement usePetDrag**

```typescript
// packages/pet/src/hooks/usePetDrag.ts
import { useCallback, useRef, useState } from 'react';
import type { PetInteraction, PetPosition } from '../types';
import { classifyDragDirection, DRAG_GESTURE_MIN_PX, DRAG_AXIS_BIAS } from '../interaction';

export interface UsePetDragOptions {
  position: PetPosition;
  onPositionChange: (position: PetPosition) => void;
  onTap?: () => void;
  /** Viewport bounds for clamping */
  bounds?: { width: number; height: number };
}

export interface UsePetDragResult {
  isDragging: boolean;
  dragDirection: PetInteraction | null;
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
  };
}

interface DragState {
  startX: number;
  startY: number;
  startRight: number;
  startBottom: number;
  moved: boolean;
}

const MOVE_THRESHOLD = 4;
const EDGE_PADDING = 8;
const SPRITE_SIZE = 120; // Approximate sprite + shadow

export function usePetDrag({
  position,
  onPositionChange,
  onTap,
  bounds,
}: UsePetDragOptions): UsePetDragResult {
  const [isDragging, setIsDragging] = useState(false);
  const [dragDirection, setDragDirection] = useState<PetInteraction | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const getViewportBounds = useCallback(() => {
    if (bounds) return bounds;
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 1920, height: 1080 };
  }, [bounds]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return; // Only primary button

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startRight: position.right,
        startBottom: position.bottom,
        moved: false,
      };

      setIsDragging(true);
      setDragDirection(null);
    },
    [position.right, position.bottom]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      // Check if moved beyond threshold
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < MOVE_THRESHOLD) {
        return;
      }
      drag.moved = true;

      // Calculate new position (right/bottom are distances from edges)
      const { width, height } = getViewportBounds();
      const nextRight = Math.max(
        EDGE_PADDING,
        Math.min(width - SPRITE_SIZE, drag.startRight - dx)
      );
      const nextBottom = Math.max(
        EDGE_PADDING,
        Math.min(height - SPRITE_SIZE, drag.startBottom - dy)
      );

      onPositionChange({ right: nextRight, bottom: nextBottom });

      // Classify drag direction
      const direction = classifyDragDirection(dx, dy, DRAG_GESTURE_MIN_PX, DRAG_AXIS_BIAS);
      if (direction) {
        setDragDirection(direction);
      }
    },
    [onPositionChange, getViewportBounds]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;

      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if capture already released
      }

      // Detect tap (no movement)
      if (drag && !drag.moved && onTap) {
        onTap();
      }

      setIsDragging(false);
      setDragDirection(null);
    },
    [onTap]
  );

  return {
    isDragging,
    dragDirection,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
  };
}
```

- [ ] **Step 7: Create hooks index**

```typescript
// packages/pet/src/hooks/index.ts
export * from './usePetDrag';
```

- [ ] **Step 8: Run tests to verify they pass**

Run:
```bash
cd packages/pet && pnpm test
```

Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add packages/pet/src/hooks/usePetDrag.ts packages/pet/src/hooks/index.ts packages/pet/tests/hooks/usePetDrag.test.ts packages/pet/tests/setup.ts packages/pet/vitest.config.ts
git commit -m "feat(pet): add usePetDrag hook for pointer drag handling"
```

---

## Task 3: usePetAnimation Hook

**Files:**
- Create: `packages/pet/src/hooks/usePetAnimation.ts`
- Modify: `packages/pet/src/hooks/index.ts`

- [ ] **Step 1: Implement usePetAnimation**

```typescript
// packages/pet/src/hooks/usePetAnimation.ts
import { useMemo } from 'react';
import type { PetConfig, PetInteraction, PetAnimationDef, PetAtlasLayout } from '../types';
import { pickAnimationRow } from '../atlas';
import { getAnimationIdForInteraction } from '../interaction';
import { createAnimationStyle, type AnimationStyle } from '../animation';

export interface UsePetAnimationOptions {
  pet: PetConfig | null;
  interaction: PetInteraction;
  /** Override animation ID (e.g., for ambient) */
  overrideAnimationId?: string | null;
}

export interface UsePetAnimationResult {
  /** Current animation definition */
  animation: PetAnimationDef | null;
  /** CSS style properties for sprite */
  style: AnimationStyle | null;
  /** CSS custom properties for the sprite element */
  cssVars: Record<string, string | number>;
}

export function usePetAnimation({
  pet,
  interaction,
  overrideAnimationId,
}: UsePetAnimationOptions): UsePetAnimationResult {
  return useMemo(() => {
    if (!pet) {
      return { animation: null, style: null, cssVars: {} };
    }

    const { atlas } = pet;

    // Determine which animation to play
    const targetId = overrideAnimationId ?? getAnimationIdForInteraction(interaction);
    const animation = pickAnimationRow(atlas.animations, targetId);

    if (!animation) {
      return { animation: null, style: null, cssVars: {} };
    }

    const style = createAnimationStyle(atlas, animation);

    // CSS custom properties for the sprite element
    const cssVars: Record<string, string | number> = {
      '--pet-cell-width': `${atlas.cellWidth}px`,
      '--pet-cell-height': `${atlas.cellHeight}px`,
      '--pet-row-offset': `${style.backgroundPositionY}px`,
      '--pet-duration': style.animationDuration,
      '--pet-frames': animation.frames,
      '--pet-sprite-end-x': `${-(animation.frames * atlas.cellWidth)}px`,
    };

    return { animation, style, cssVars };
  }, [pet, interaction, overrideAnimationId]);
}
```

- [ ] **Step 2: Update hooks index**

```typescript
// packages/pet/src/hooks/index.ts
export * from './usePetDrag';
export * from './usePetAnimation';
```

- [ ] **Step 3: Verify types compile**

Run:
```bash
cd packages/pet && pnpm typecheck
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/pet/src/hooks/usePetAnimation.ts packages/pet/src/hooks/index.ts
git commit -m "feat(pet): add usePetAnimation hook for animation row selection"
```

---

## Task 4: usePetAmbient Hook

**Files:**
- Create: `packages/pet/src/hooks/usePetAmbient.ts`
- Modify: `packages/pet/src/hooks/index.ts`

- [ ] **Step 1: Implement usePetAmbient**

```typescript
// packages/pet/src/hooks/usePetAmbient.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { PetConfig, PetInteraction } from '../types';
import { PET_DEFAULTS } from '../types';
import { pickAmbientAnimation, randomInRange } from '../animation';

export interface UsePetAmbientOptions {
  pet: PetConfig | null;
  interaction: PetInteraction;
  /** Disable ambient when true (e.g., during drag) */
  disabled?: boolean;
}

export interface UsePetAmbientResult {
  /** Currently playing ambient animation ID, or null */
  ambientRowId: string | null;
  /** Reset the ambient cycle */
  reset: () => void;
}

export function usePetAmbient({
  pet,
  interaction,
  disabled = false,
}: UsePetAmbientOptions): UsePetAmbientResult {
  const [ambientRowId, setAmbientRowId] = useState<string | null>(null);
  const lastPlayedRef = useRef<string | undefined>(undefined);
  const playTimerRef = useRef<number | undefined>(undefined);
  const restTimerRef = useRef<number | undefined>(undefined);

  const clearTimers = useCallback(() => {
    if (playTimerRef.current !== undefined) {
      window.clearTimeout(playTimerRef.current);
      playTimerRef.current = undefined;
    }
    if (restTimerRef.current !== undefined) {
      window.clearTimeout(restTimerRef.current);
      restTimerRef.current = undefined;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    setAmbientRowId(null);
    lastPlayedRef.current = undefined;
  }, [clearTimers]);

  useEffect(() => {
    // Only run ambient when idle and not disabled
    if (interaction !== 'idle' || disabled || !pet) {
      clearTimers();
      setAmbientRowId(null);
      return;
    }

    const ambient = pet.ambient ?? PET_DEFAULTS.ambient;
    const { animations } = pet.atlas;

    const playBeat = () => {
      const def = pickAmbientAnimation(animations, ambient.pool, lastPlayedRef.current);
      if (!def) return;

      lastPlayedRef.current = def.id;
      setAmbientRowId(def.id);

      // Schedule end of play
      const playMs = randomInRange(ambient.playMs);
      playTimerRef.current = window.setTimeout(() => {
        setAmbientRowId(null);

        // Schedule next beat
        const restMs = randomInRange(ambient.restMs);
        restTimerRef.current = window.setTimeout(playBeat, restMs);
      }, playMs);
    };

    // Initial delay before first beat
    const initialDelay = randomInRange(ambient.initialDelayMs);
    restTimerRef.current = window.setTimeout(playBeat, initialDelay);

    return () => {
      clearTimers();
      setAmbientRowId(null);
    };
  }, [interaction, disabled, pet, clearTimers]);

  return { ambientRowId, reset };
}
```

- [ ] **Step 2: Update hooks index**

```typescript
// packages/pet/src/hooks/index.ts
export * from './usePetDrag';
export * from './usePetAnimation';
export * from './usePetAmbient';
```

- [ ] **Step 3: Verify types compile**

Run:
```bash
cd packages/pet && pnpm typecheck
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/pet/src/hooks/usePetAmbient.ts packages/pet/src/hooks/index.ts
git commit -m "feat(pet): add usePetAmbient hook for ambient animation cycling"
```

---

## Task 5: PetSprite Component

**Files:**
- Create: `packages/pet/src/components/PetSprite.tsx`
- Create: `packages/pet/src/components/index.ts`

- [ ] **Step 1: Implement PetSprite**

```tsx
// packages/pet/src/components/PetSprite.tsx
import type { CSSProperties } from 'react';
import type { PetConfig, PetInteraction } from '../types';
import { usePetAnimation } from '../hooks/usePetAnimation';

export interface PetSpriteProps {
  pet: PetConfig;
  interaction: PetInteraction;
  /** Override animation ID (e.g., for ambient) */
  overrideAnimationId?: string | null;
  /** Additional class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

export function PetSprite({
  pet,
  interaction,
  overrideAnimationId,
  className = '',
  style: styleProp,
}: PetSpriteProps) {
  const { animation, cssVars } = usePetAnimation({
    pet,
    interaction,
    overrideAnimationId,
  });

  if (!animation) return null;

  const spriteStyle: CSSProperties = {
    ...cssVars,
    backgroundImage: `url(${pet.spritesheet})`,
    ...styleProp,
  };

  return (
    <div
      className={`pet-sprite ${className}`}
      data-interaction={interaction}
      data-animation={animation.id}
      style={{ '--pet-accent': pet.accent } as CSSProperties}
    >
      <div className="pet-sprite-image" style={spriteStyle} />
      <span className="pet-sprite-shadow" aria-hidden="true" />
    </div>
  );
}
```

- [ ] **Step 2: Create components index**

```typescript
// packages/pet/src/components/index.ts
export * from './PetSprite';
```

- [ ] **Step 3: Verify types compile**

Run:
```bash
cd packages/pet && pnpm typecheck
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/pet/src/components/PetSprite.tsx packages/pet/src/components/index.ts
git commit -m "feat(pet): add PetSprite component for sprite rendering"
```

---

## Task 6: PetBubble Component

**Files:**
- Create: `packages/pet/src/components/PetBubble.tsx`
- Modify: `packages/pet/src/components/index.ts`

- [ ] **Step 1: Implement PetBubble**

```tsx
// packages/pet/src/components/PetBubble.tsx
import type { CSSProperties, ReactNode } from 'react';

export interface PetBubbleProps {
  /** Pet name shown in bubble header */
  name: string;
  /** Bubble content - typically greeting or status */
  children: ReactNode;
  /** Accent color for name */
  accent?: string;
  /** Additional class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
  /** Called when bubble is clicked */
  onClick?: () => void;
}

export function PetBubble({
  name,
  children,
  accent = '#6366f1',
  className = '',
  style,
  onClick,
}: PetBubbleProps) {
  return (
    <div
      className={`pet-bubble ${className}`}
      role="status"
      onClick={onClick}
      style={
        {
          '--pet-accent': accent,
          '--pet-bubble-bg': 'white',
          '--pet-bubble-border': '#e5e5e5',
          ...style,
        } as CSSProperties
      }
    >
      <div className="pet-bubble-name" style={{ color: accent }}>
        {name}
      </div>
      <div className="pet-bubble-text">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Update components index**

```typescript
// packages/pet/src/components/index.ts
export * from './PetSprite';
export * from './PetBubble';
```

- [ ] **Step 3: Commit**

```bash
git add packages/pet/src/components/PetBubble.tsx packages/pet/src/components/index.ts
git commit -m "feat(pet): add PetBubble component for speech bubble"
```

---

## Task 7: PetContainer Component

**Files:**
- Create: `packages/pet/src/components/PetContainer.tsx`
- Modify: `packages/pet/src/components/index.ts`

- [ ] **Step 1: Implement PetContainer**

```tsx
// packages/pet/src/components/PetContainer.tsx
import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import type { PetConfig, PetInteraction, PetPosition } from '../types';
import { PET_DEFAULTS } from '../types';
import { usePetDrag } from '../hooks/usePetDrag';
import { usePetAmbient } from '../hooks/usePetAmbient';
import { PetSprite } from './PetSprite';
import { PetBubble } from './PetBubble';

export interface PetContainerProps {
  /** Pet configuration */
  pet: PetConfig | null;
  /** Position relative to viewport bottom-right */
  position?: PetPosition;
  /** Called when position changes (drag) */
  onPositionChange?: (position: PetPosition) => void;
  /** Called when pet is tapped (not dragged) */
  onTap?: () => void;
  /** Show speech bubble */
  showBubble?: boolean;
  /** Bubble content (defaults to greeting) */
  bubbleContent?: React.ReactNode;
  /** Additional class name */
  className?: string;
  /** Additional inline styles */
  style?: CSSProperties;
}

const IDLE_TIMEOUT_MS = PET_DEFAULTS.idleTimeoutMs;
const BUBBLE_AUTO_HIDE_MS = 4000;

export function PetContainer({
  pet,
  position: positionProp,
  onPositionChange,
  onTap: onTapProp,
  showBubble: showBubbleProp,
  bubbleContent,
  className = '',
  style,
}: PetContainerProps) {
  const [internalPosition, setInternalPosition] = useState<PetPosition>(PET_DEFAULTS.position);
  const [interaction, setInteraction] = useState<PetInteraction>('idle');
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Use prop position if provided, otherwise internal
  const position = positionProp ?? internalPosition;
  const handlePositionChange = onPositionChange ?? setInternalPosition;

  // Drag handling
  const handleTap = useCallback(() => {
    setBubbleOpen((prev) => !prev);
    onTapProp?.();
  }, [onTapProp]);

  const { isDragging, dragDirection, handlers } = usePetDrag({
    position,
    onPositionChange: handlePositionChange,
    onTap: handleTap,
  });

  // Ambient animation
  const { ambientRowId, reset: resetAmbient } = usePetAmbient({
    pet,
    interaction,
    disabled: isDragging || hovered,
  });

  // Update interaction based on drag/hover state
  useEffect(() => {
    if (isDragging && dragDirection) {
      setInteraction(dragDirection);
    } else if (hovered) {
      setInteraction('hover');
    } else {
      setInteraction('idle');
    }
  }, [isDragging, dragDirection, hovered]);

  // Idle timeout -> waiting
  useEffect(() => {
    if (interaction !== 'idle' || isDragging || hovered) return;

    const timeoutMs = pet?.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
    const timer = window.setTimeout(() => {
      setInteraction('waiting');
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [interaction, isDragging, hovered, pet?.idleTimeoutMs]);

  // Auto-hide bubble
  useEffect(() => {
    if (!bubbleOpen || showBubbleProp !== undefined) return;

    const timer = window.setTimeout(() => {
      setBubbleOpen(false);
    }, BUBBLE_AUTO_HIDE_MS);

    return () => window.clearTimeout(timer);
  }, [bubbleOpen, showBubbleProp]);

  // Show bubble on mount
  useEffect(() => {
    if (pet) {
      setBubbleOpen(true);
    }
  }, [pet?.id]);

  // Handle hover
  const handlePointerEnter = useCallback(() => {
    setHovered(true);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHovered(false);
  }, []);

  if (!pet) return null;

  const containerStyle: CSSProperties = {
    right: position.right,
    bottom: position.bottom,
    '--pet-accent': pet.accent,
    ...style,
  } as CSSProperties;

  const isBubbleVisible = showBubbleProp ?? bubbleOpen;

  return (
    <div
      className={`pet-container ${className}`}
      style={containerStyle}
      data-dragging={isDragging}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      {...handlers}
    >
      {isBubbleVisible && (
        <PetBubble name={pet.name} accent={pet.accent}>
          {bubbleContent ?? pet.greeting}
        </PetBubble>
      )}
      <PetSprite
        pet={pet}
        interaction={interaction}
        overrideAnimationId={ambientRowId}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update components index**

```typescript
// packages/pet/src/components/index.ts
export * from './PetSprite';
export * from './PetBubble';
export * from './PetContainer';
```

- [ ] **Step 3: Verify types compile**

Run:
```bash
cd packages/pet && pnpm typecheck
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/pet/src/components/PetContainer.tsx packages/pet/src/components/index.ts
git commit -m "feat(pet): add PetContainer component with drag, hover, and ambient"
```

---

## Task 8: Update Main Exports

**Files:**
- Modify: `packages/pet/src/index.ts`

- [ ] **Step 1: Update index.ts with all exports**

```typescript
// packages/pet/src/index.ts

// Types
export * from './types';

// Utilities
export * from './atlas';
export * from './interaction';
export * from './animation';

// State
export * from './store';

// Hooks
export * from './hooks';

// Components
export * from './components';

// CSS (consumers need to import this)
// import '@viben/pet/styles/pet.css';
```

- [ ] **Step 2: Run full type check**

Run:
```bash
cd packages/pet && pnpm typecheck
```

Expected: No errors

- [ ] **Step 3: Run tests**

Run:
```bash
cd packages/pet && pnpm test
```

Expected: All tests PASS

- [ ] **Step 4: Build package**

Run:
```bash
cd packages/pet && pnpm build
```

Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/pet/src/index.ts
git commit -m "feat(pet): export all components and hooks from package index"
```

---

## Task 9: Final Verification

**Files:**
- Verify: all files in `packages/pet/src/`

- [ ] **Step 1: Run all tests**

Run:
```bash
cd packages/pet && pnpm test
```

Expected: All tests PASS

- [ ] **Step 2: Full type check**

Run:
```bash
cd packages/pet && pnpm typecheck
```

Expected: No errors

- [ ] **Step 3: Build and verify output**

Run:
```bash
cd packages/pet && pnpm build && ls dist/
```

Expected: All `.js` and `.d.ts` files present

- [ ] **Step 4: Final commit**

```bash
git add -A packages/pet/
git commit -m "feat(pet): complete packages/pet components layer

Components:
- PetSprite: CSS sprite animation renderer
- PetBubble: Speech bubble with name and content
- PetContainer: Full-featured draggable container

Hooks:
- usePetDrag: Pointer drag with direction detection
- usePetAnimation: Animation row selection and CSS vars
- usePetAmbient: Ambient animation cycling

Ready for example app (Plan 3)"
```

---

## Summary

This plan creates the component layer of `packages/pet`:

| File | Purpose |
|------|---------|
| `styles/pet.css` | Base styles and keyframes |
| `hooks/usePetDrag.ts` | Pointer drag handling |
| `hooks/usePetAnimation.ts` | Animation row selection |
| `hooks/usePetAmbient.ts` | Ambient animation cycling |
| `components/PetSprite.tsx` | Sprite renderer |
| `components/PetBubble.tsx` | Speech bubble |
| `components/PetContainer.tsx` | Full container with all features |

**Next:** Plan 3 (Example App) depends on this plan completing successfully.
