import { useCallback, useRef, useState } from 'react';
import type { PetInteraction, PetPosition } from '../types';
import { DRAG_GESTURE_MIN_PX, DRAG_AXIS_BIAS } from '../interaction';

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
