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
  /** Size of the pet sprite in pixels. Defaults to 96. */
  size?: number;
  /** Force a specific animation row ID, overriding automatic animation selection. */
  forcedRowId?: string | null;
  /** Callback fired when interaction state changes. */
  onInteractionChange?: (state: PetInteraction) => void;
}

const IDLE_TIMEOUT_MS = 45000;
const BUBBLE_AUTO_HIDE_MS = 4000;

const DEFAULT_SIZE = 96;

export function PetContainer({
  pet,
  position: positionProp,
  onPositionChange,
  onTap: onTapProp,
  showBubble: showBubbleProp,
  bubbleContent,
  className = '',
  style,
  size = DEFAULT_SIZE,
  forcedRowId,
  onInteractionChange,
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

  // Notify parent of interaction state changes
  useEffect(() => {
    onInteractionChange?.(interaction);
  }, [interaction, onInteractionChange]);

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
  const currentRowId = forcedRowId ?? ambientRowId ?? getAnimationIdForInteraction(interaction);

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
          size={size}
        />
        <span className="pet-sprite-shadow" aria-hidden />
      </div>
    </div>
  );
}
