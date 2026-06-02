/** 动画行定义 */
export interface PetAnimationDef {
  id: string;
  row: number;
  frames: number;
  fps: number;
}

export interface PetAtlasLayout {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  animations: PetAnimationDef[];
}

export interface PetAmbientConfig {
  pool: string[];
  playMs: { min: number; variance: number };
  restMs: { min: number; variance: number };
  initialDelayMs: { min: number; variance: number };
}

export interface PetConfig {
  id: string;
  name: string;
  description: string;
  accent: string;
  greeting: string;
  spritesheet: string;
  atlas: PetAtlasLayout;
  ambient?: PetAmbientConfig;
  idleTimeoutMs?: number;
}

export type PetInteraction =
  | 'idle'
  | 'hover'
  | 'drag-right'
  | 'drag-left'
  | 'drag-up'
  | 'drag-down'
  | 'waiting';

export interface PetPosition {
  right: number;
  bottom: number;
}

export interface PetPreset {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  path: string;
}

export const PET_DEFAULTS = {
  idleTimeoutMs: 45000,
  position: { right: 24, bottom: 24 } as PetPosition,
  ambient: {
    pool: ['waving', 'review', 'jumping'],
    playMs: { min: 1400, variance: 900 },
    restMs: { min: 9000, variance: 9000 },
    initialDelayMs: { min: 4000, variance: 3000 },
  } as PetAmbientConfig,
} as const;

export const CODEX_ATLAS = {
  cols: 8,
  rows: 9,
  cellWidth: 192,
  cellHeight: 208,
  width: 1536,
  height: 1872,
  aspect: 1536 / 1872,
} as const;

export const STANDARD_ANIMATIONS: PetAnimationDef[] = [
  { id: 'idle', row: 0, frames: 6, fps: 6 },
  { id: 'running-right', row: 1, frames: 8, fps: 8 },
  { id: 'running-left', row: 2, frames: 8, fps: 8 },
  { id: 'waving', row: 3, frames: 4, fps: 6 },
  { id: 'jumping', row: 4, frames: 5, fps: 7 },
  { id: 'failed', row: 5, frames: 8, fps: 7 },
  { id: 'waiting', row: 6, frames: 6, fps: 6 },
  { id: 'running', row: 7, frames: 6, fps: 8 },
  { id: 'review', row: 8, frames: 6, fps: 6 },
];

/**
 * Atlas row definition using 'index' field (open-design compatibility).
 * Maps to PetAnimationDef but uses 'index' instead of 'row'.
 */
export interface PetAtlasRowDef {
  index: number;
  id: string;
  frames: number;
  fps: number;
}

/**
 * Convert PetAtlasRowDef to PetAnimationDef.
 */
export function rowDefToAnimationDef(rowDef: PetAtlasRowDef): PetAnimationDef {
  return {
    id: rowDef.id,
    row: rowDef.index,
    frames: rowDef.frames,
    fps: rowDef.fps,
  };
}

/**
 * Convert PetAnimationDef to PetAtlasRowDef.
 */
export function animationDefToRowDef(animDef: PetAnimationDef): PetAtlasRowDef {
  return {
    id: animDef.id,
    index: animDef.row,
    frames: animDef.frames,
    fps: animDef.fps,
  };
}
