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
