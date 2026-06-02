# Pet Package Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create React components and hooks for rendering and interacting with the pet sprite, adapted from the open-design reference implementation.

**Architecture:** React components using CSS sprite animation. Hooks encapsulate drag handling, animation state, and ambient cycling. Components are self-contained with no external dependencies beyond React and the core library.

**Tech Stack:** React 18, TypeScript, Vitest

**Spec Reference:** `docs/superpowers/specs/2026-05-31-pets-v1-design.md`

**Reference Implementation:** `~/github/others/open-design/apps/web/src/components/pet/`

**Depends On:** Plan 1 (packages/pet core) must be completed first.

---

## File Structure

```
packages/pet/src/
├── components/
│   ├── PetSprite.tsx         # Sprite renderer with JS-driven animation
│   ├── PetContainer.tsx      # Draggable container with full interaction
│   ├── PetBubble.tsx         # Speech bubble component
│   └── index.ts              # Component exports
├── hooks/
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

- [ ] **Step 1: Create styles directory**

Run:
```bash
mkdir -p packages/pet/src/styles
```

- [ ] **Step 2: Create pet.css with base styles**

```css
/* packages/pet/src/styles/pet.css */

/* Sprite animation keyframe - moves horizontally through frames */
@keyframes pet-frames {
  from { background-position-x: 0%; }
  to { background-position-x: 100%; }
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
}

/* Sprite image layer - used for static and strip modes */
.pet-image {
  display: block;
  background-repeat: no-repeat;
  background-position: 0 0;
}

.pet-image.static {
  background-size: contain;
}

.pet-image.frames {
  /* Animation set via inline style */
}

.pet-image.atlas {
  /* Background position set via inline style */
}

/* Shadow effect */
.pet-sprite-shadow {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 8px;
  background: radial-gradient(ellipse, rgba(0,0,0,0.15) 0%, transparent 70%);
  pointer-events: none;
}

/* Speech bubble */
.pet-bubble {
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 8px;
  padding: 10px 14px;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  max-width: 220px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.pet-bubble::after {
  content: '';
  position: absolute;
  bottom: -7px;
  right: 20px;
  border: 7px solid transparent;
  border-top-color: white;
  border-bottom: none;
}

.pet-bubble::before {
  content: '';
  position: absolute;
  bottom: -8px;
  right: 19px;
  border: 8px solid transparent;
  border-top-color: #e5e5e5;
  border-bottom: none;
}

.pet-bubble-name {
  font-weight: 600;
  font-size: 12px;
  color: var(--pet-accent, #6366f1);
  margin-bottom: 4px;
}

.pet-bubble-line {
  color: #374151;
}

/* Idle quote styling */
.pet-idle-quote {
  margin: 0;
}

.pet-idle-quote blockquote {
  margin: 0;
  color: #374151;
  font-style: italic;
}

.pet-idle-quote figcaption {
  margin-top: 6px;
  font-size: 11px;
  color: #6b7280;
}

.pet-idle-quote figcaption::before {
  content: '— ';
}

/* Task list in bubble */
.pet-task-list {
  margin-top: 8px;
  border-top: 1px solid #f3f4f6;
  padding-top: 8px;
}

.pet-task-group {
  margin-bottom: 6px;
}

.pet-task-group:last-child {
  margin-bottom: 0;
}

.pet-task-group-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.pet-task-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-size: 12px;
  color: #374151;
  background: none;
  border: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
}

.pet-task-item:hover {
  color: var(--pet-accent, #6366f1);
}

.pet-task-item--static {
  cursor: default;
}

.pet-task-item--static:hover {
  color: #374151;
}

.pet-task-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #d1d5db;
  flex-shrink: 0;
}

.pet-task-dot[data-pet-task-status="running"] {
  background: #10b981;
}

.pet-task-dot[data-pet-task-status="queued"] {
  background: #f59e0b;
}

.pet-task-dot[data-pet-task-status="succeeded"] {
  background: #10b981;
}

.pet-task-dot[data-pet-task-status="failed"] {
  background: #ef4444;
}

.pet-task-dot[data-pet-task-status="canceled"] {
  background: #6b7280;
}

.pet-task-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pet-task-count {
  font-size: 10px;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 1px 5px;
  border-radius: 8px;
}

/* Overlay wrapper */
.pet-overlay {
  position: fixed;
  z-index: 9999;
  user-select: none;
  touch-action: none;
}

/* Status badge on sprite */
.pet-sprite-status {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--pet-accent, #6366f1);
  color: white;
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  border-radius: 9px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

/* Reduced motion preference */
@media (prefers-reduced-motion: reduce) {
  .pet-image.frames {
    animation: none !important;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/pet/src/styles/pet.css
git commit -m "feat(pet): add base CSS styles for pet components"
```

---

## Task 2: usePetDrag Hook

**Files:**
- Create: `packages/pet/src/hooks/usePetDrag.ts`
- Create: `packages/pet/src/hooks/index.ts`

- [ ] **Step 1: Create hooks directory**

Run:
```bash
mkdir -p packages/pet/src/hooks
```

- [ ] **Step 2: Implement usePetDrag**

```typescript
// packages/pet/src/hooks/usePetDrag.ts
import { useCallback, useRef, useState } from 'react';
import type { PetInteraction, PetPosition } from '../types';
import { classifyDragDirection, DRAG_GESTURE_MIN_PX, DRAG_AXIS_BIAS } from '../interaction';

export interface UsePetDragOptions {
  position: PetPosition;
  onPositionChange: (position: PetPosition) => void;
  onTap?: () => void;
}

export interface UsePetDragResult {
  isDragging: boolean;
  dragDirection: PetInteraction | null;
  hasMoved: boolean;
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
  direction: 'right' | 'left' | 'up' | 'down' | null;
}

const MOVE_THRESHOLD = 4;
const EDGE_PADDING = 8;
const SPRITE_SIZE = 120;

export function usePetDrag({
  position,
  onPositionChange,
  onTap,
}: UsePetDragOptions): UsePetDragResult {
  const [isDragging, setIsDragging] = useState(false);
  const [dragDirection, setDragDirection] = useState<PetInteraction | null>(null);
  const [hasMoved, setHasMoved] = useState(false);
  const dragRef = useRef<DragState | null>(null);

  const getViewportBounds = useCallback(() => {
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 1920, height: 1080 };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startRight: position.right,
        startBottom: position.bottom,
        moved: false,
        direction: null,
      };

      setIsDragging(true);
      setDragDirection(null);
      setHasMoved(false);
    },
    [position.right, position.bottom]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;

      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < MOVE_THRESHOLD) {
        return;
      }
      drag.moved = true;
      setHasMoved(true);

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

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < DRAG_GESTURE_MIN_PX && absY < DRAG_GESTURE_MIN_PX) return;
      
      let dir: 'right' | 'left' | 'up' | 'down' | null = null;
      if (absX >= absY * DRAG_AXIS_BIAS) {
        dir = dx > 0 ? 'right' : 'left';
      } else if (absY >= absX * DRAG_AXIS_BIAS) {
        dir = dy < 0 ? 'up' : 'down';
      }
      
      if (dir && dir !== drag.direction) {
        drag.direction = dir;
        setDragDirection(
          dir === 'right'
            ? 'drag-right'
            : dir === 'left'
              ? 'drag-left'
              : dir === 'up'
                ? 'drag-up'
                : 'drag-down'
        );
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
        // Ignore
      }

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
    hasMoved,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
  };
}
```

- [ ] **Step 3: Create hooks index**

```typescript
// packages/pet/src/hooks/index.ts
export * from './usePetDrag';
```

- [ ] **Step 4: Verify types compile**

Run:
```bash
cd packages/pet && pnpm typecheck
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/pet/src/hooks/
git commit -m "feat(pet): add usePetDrag hook for pointer drag handling"
```

---

## Task 3: usePetAmbient Hook

**Files:**
- Create: `packages/pet/src/hooks/usePetAmbient.ts`
- Modify: `packages/pet/src/hooks/index.ts`

- [ ] **Step 1: Implement usePetAmbient**

```typescript
// packages/pet/src/hooks/usePetAmbient.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import type { PetAnimationDef, PetAmbientConfig, PetAtlasLayout, PetInteraction } from '../types';
import { PET_DEFAULTS } from '../types';
import { pickAmbientAnimation, randomInRange } from '../animation';

export interface UsePetAmbientOptions {
  atlas: PetAtlasLayout | null;
  interaction: PetInteraction;
  ambientConfig?: PetAmbientConfig;
  disabled?: boolean;
}

export interface UsePetAmbientResult {
  ambientRowId: string | null;
  reset: () => void;
}

export function usePetAmbient({
  atlas,
  interaction,
  ambientConfig,
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
    if (interaction !== 'idle' || disabled || !atlas || atlas.animations.length === 0) {
      clearTimers();
      setAmbientRowId(null);
      return;
    }

    const ambient = ambientConfig ?? PET_DEFAULTS.ambient;
    const animations = atlas.animations;

    const playBeat = () => {
      const def = pickAmbientAnimation(animations, ambient.pool, lastPlayedRef.current);
      if (!def) return;

      lastPlayedRef.current = def.id;
      setAmbientRowId(def.id);

      const playMs = randomInRange(ambient.playMs);
      playTimerRef.current = window.setTimeout(() => {
        setAmbientRowId(null);

        const restMs = randomInRange(ambient.restMs);
        restTimerRef.current = window.setTimeout(playBeat, restMs);
      }, playMs);
    };

    const initialDelay = randomInRange(ambient.initialDelayMs);
    restTimerRef.current = window.setTimeout(playBeat, initialDelay);

    return () => {
      clearTimers();
      setAmbientRowId(null);
    };
  }, [interaction, disabled, atlas, ambientConfig, clearTimers]);

  return { ambientRowId, reset };
}
```

- [ ] **Step 2: Update hooks index**

```typescript
// packages/pet/src/hooks/index.ts
export * from './usePetDrag';
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
git add packages/pet/src/hooks/
git commit -m "feat(pet): add usePetAmbient hook for ambient animation cycling"
```

---

## Task 4: PetSprite Component

**Files:**
- Create: `packages/pet/src/components/PetSprite.tsx`
- Create: `packages/pet/src/components/index.ts`

Reference: `~/github/others/open-design/apps/web/src/components/pet/PetSpriteFace.tsx`

- [ ] **Step 1: Create components directory**

Run:
```bash
mkdir -p packages/pet/src/components
```

- [ ] **Step 2: Implement PetSprite**

```tsx
// packages/pet/src/components/PetSprite.tsx
import { useEffect, useState, type CSSProperties } from 'react';
import type { PetAnimationDef, PetAtlasLayout, PetConfig } from '../types';
import { pickAnimationRow } from '../atlas';

export interface PetSpriteProps {
  pet: PetConfig;
  rowId?: string;
  className?: string;
  size?: number;
}

export function PetSprite({ pet, rowId, className, size }: PetSpriteProps) {
  const { atlas, spritesheet } = pet;

  return (
    <AtlasSprite
      imageUrl={spritesheet}
      cols={atlas.cols}
      rows={atlas.rows}
      animations={atlas.animations}
      rowId={rowId}
      className={className}
      size={size}
    />
  );
}

interface AtlasSpriteProps {
  imageUrl: string;
  cols: number;
  rows: number;
  animations: PetAnimationDef[];
  rowId?: string;
  className?: string;
  size?: number;
}

function AtlasSprite({
  imageUrl,
  cols,
  rows,
  animations,
  rowId,
  className,
  size,
}: AtlasSpriteProps) {
  const def = pickAnimationRow(animations, rowId ?? 'idle');
  if (!def) return null;

  const rowFrames = Math.max(1, def.frames);
  const fps = Math.max(1, def.fps);

  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    if (rowFrames <= 1) return;
    const intervalMs = Math.max(16, Math.round(1000 / fps));
    const id = window.setInterval(() => {
      setFrame((f) => (f + 1) % rowFrames);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [def.id, def.row, rowFrames, fps]);

  const xPct = cols > 1 ? (frame / (cols - 1)) * 100 : 0;
  const yPct = rows > 1 ? (def.row / (rows - 1)) * 100 : 0;

  const style: CSSProperties = {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: `${cols * 100}% ${rows * 100}%`,
    backgroundPosition: `${xPct}% ${yPct}%`,
    width: size,
    height: size,
  };

  return (
    <span
      className={`${className ?? ''} pet-image atlas`.trim()}
      aria-hidden
      style={style}
    />
  );
}
```

- [ ] **Step 3: Create components index**

```typescript
// packages/pet/src/components/index.ts
export * from './PetSprite';
```

- [ ] **Step 4: Verify types compile**

Run:
```bash
cd packages/pet && pnpm typecheck
```

Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/pet/src/components/
git commit -m "feat(pet): add PetSprite component for atlas rendering"
```

---

## Task 5: PetBubble Component

**Files:**
- Create: `packages/pet/src/components/PetBubble.tsx`
- Modify: `packages/pet/src/components/index.ts`

- [ ] **Step 1: Implement PetBubble**

```tsx
// packages/pet/src/components/PetBubble.tsx
import type { CSSProperties, ReactNode } from 'react';

export interface PetBubbleProps {
  name: string;
  children: ReactNode;
  accent?: string;
  className?: string;
  style?: CSSProperties;
}

export function PetBubble({
  name,
  children,
  accent = '#6366f1',
  className = '',
  style,
}: PetBubbleProps) {
  return (
    <div
      className={`pet-bubble ${className}`}
      role="status"
      style={{ '--pet-accent': accent, ...style } as CSSProperties}
    >
      <div className="pet-bubble-name">{name}</div>
      <div className="pet-bubble-line">{children}</div>
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
git add packages/pet/src/components/
git commit -m "feat(pet): add PetBubble component for speech bubble"
```

---

## Task 6: PetContainer Component

**Files:**
- Create: `packages/pet/src/components/PetContainer.tsx`
- Modify: `packages/pet/src/components/index.ts`

Reference: `~/github/others/open-design/apps/web/src/components/pet/PetOverlay.tsx`

- [ ] **Step 1: Implement PetContainer**

```tsx
// packages/pet/src/components/PetContainer.tsx
import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import type { PetConfig, PetInteraction, PetPosition } from '../types';
import { PET_DEFAULTS } from '../types';
import { getAnimationIdForInteraction } from '../interaction';
import { usePetDrag } from '../hooks/usePetDrag';
import { usePetAmbient } from '../hooks/usePetAmbient';
import { PetSprite } from './PetSprite';
import { PetBubble } from './PetBubble';

export interface PetContainerProps {
  pet: PetConfig | null;
  position?: PetPosition;
  onPositionChange?: (position: PetPosition) => void;
  onTap?: () => void;
  showBubble?: boolean;
  bubbleContent?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

const IDLE_TIMEOUT_MS = 45000;
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

  const position = positionProp ?? internalPosition;
  const handlePositionChange = onPositionChange ?? setInternalPosition;

  const handleTap = useCallback(() => {
    setBubbleOpen((prev) => !prev);
    onTapProp?.();
  }, [onTapProp]);

  const { isDragging, dragDirection, handlers } = usePetDrag({
    position,
    onPositionChange: handlePositionChange,
    onTap: handleTap,
  });

  const { ambientRowId } = usePetAmbient({
    atlas: pet?.atlas ?? null,
    interaction,
    ambientConfig: pet?.ambient,
    disabled: isDragging || hovered,
  });

  useEffect(() => {
    if (isDragging && dragDirection) {
      setInteraction(dragDirection);
    } else if (hovered) {
      setInteraction('hover');
    } else {
      setInteraction('idle');
    }
  }, [isDragging, dragDirection, hovered]);

  useEffect(() => {
    if (interaction !== 'idle' || isDragging || hovered) return;

    const timeoutMs = pet?.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
    const timer = window.setTimeout(() => {
      setInteraction('waiting');
    }, timeoutMs);

    return () => window.clearTimeout(timer);
  }, [interaction, isDragging, hovered, pet?.idleTimeoutMs]);

  useEffect(() => {
    if (!bubbleOpen || showBubbleProp !== undefined) return;

    const timer = window.setTimeout(() => {
      setBubbleOpen(false);
    }, BUBBLE_AUTO_HIDE_MS);

    return () => window.clearTimeout(timer);
  }, [bubbleOpen, showBubbleProp]);

  useEffect(() => {
    if (pet) {
      setBubbleOpen(true);
    }
  }, [pet?.id]);

  const handlePointerEnter = useCallback(() => {
    setHovered(true);
    if (!isDragging) setInteraction('hover');
  }, [isDragging]);

  const handlePointerLeave = useCallback(() => {
    setHovered(false);
    if (!isDragging) setInteraction('idle');
  }, [isDragging]);

  if (!pet) return null;

  const containerStyle: CSSProperties = {
    right: position.right,
    bottom: position.bottom,
    '--pet-accent': pet.accent,
    ...style,
  } as CSSProperties;

  const isBubbleVisible = showBubbleProp ?? bubbleOpen;
  const currentRowId = ambientRowId ?? getAnimationIdForInteraction(interaction);

  return (
    <div
      className={`pet-overlay ${className}`}
      style={containerStyle}
      role="complementary"
      aria-label={`Pet: ${pet.name}`}
    >
      {isBubbleVisible && (
        <PetBubble name={pet.name} accent={pet.accent}>
          {bubbleContent ?? pet.greeting}
        </PetBubble>
      )}
      <div
        className="pet-sprite"
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlers.onPointerUp}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        data-pet-state={interaction}
        data-pet-ambient={ambientRowId ?? undefined}
        data-dragging={isDragging}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <PetSprite
          pet={pet}
          rowId={currentRowId}
          className="pet-sprite-glyph"
          size={96}
        />
        <span className="pet-sprite-shadow" aria-hidden />
      </div>
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
git add packages/pet/src/components/
git commit -m "feat(pet): add PetContainer component with drag, hover, and ambient"
```

---

## Task 7: Update Package Exports

**Files:**
- Modify: `packages/pet/src/index.ts`
- Modify: `packages/pet/package.json`

- [ ] **Step 1: Update index.ts with all exports**

```typescript
// packages/pet/src/index.ts
export const VERSION = '0.1.0';

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
```

- [ ] **Step 2: Update package.json exports**

Add CSS export to `package.json`:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./styles/pet.css": "./src/styles/pet.css"
  }
}
```

- [ ] **Step 3: Run full type check**

Run:
```bash
cd packages/pet && pnpm typecheck
```

Expected: No errors

- [ ] **Step 4: Build package**

Run:
```bash
cd packages/pet && pnpm build
```

Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add packages/pet/src/index.ts packages/pet/package.json
git commit -m "feat(pet): export all components, hooks, and CSS from package"
```

---

## Task 8: Final Verification

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
- PetSprite: Atlas sprite renderer with JS-driven frame animation
- PetBubble: Speech bubble with name and content
- PetContainer: Full-featured draggable container

Hooks:
- usePetDrag: Pointer drag with direction detection
- usePetAmbient: Ambient animation cycling

Styles:
- pet.css: Base styles for all components

Ready for example app (Plan 3)"
```

---

## Summary

This plan creates the component layer of `packages/pet`:

| File | Purpose |
|------|---------|
| `styles/pet.css` | Base styles and keyframes |
| `hooks/usePetDrag.ts` | Pointer drag handling |
| `hooks/usePetAmbient.ts` | Ambient animation cycling |
| `components/PetSprite.tsx` | Atlas sprite renderer |
| `components/PetBubble.tsx` | Speech bubble |
| `components/PetContainer.tsx` | Full container with all features |

**Next:** Plan 3 (Example App) depends on this plan completing successfully.
