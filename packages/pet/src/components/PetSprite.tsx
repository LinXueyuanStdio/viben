import { useEffect, useState, type CSSProperties } from 'react';
import type { PetAnimationDef, PetConfig } from '../types';
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
