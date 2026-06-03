import {
  PET_DEFAULTS,
  STANDARD_ANIMATIONS,
  type PetConfig,
} from '@viben/pet';
import type { CustomPet } from './petStorage';

export function createCustomPetConfig(customPet: CustomPet): PetConfig {
  return {
    id: customPet.id,
    name: customPet.displayName,
    description: customPet.description,
    accent: customPet.accent,
    greeting: customPet.greeting,
    spritesheet: customPet.spritesheetDataUrl,
    atlas: {
      cols: 8,
      rows: 9,
      cellWidth: 192,
      cellHeight: 208,
      animations: STANDARD_ANIMATIONS,
    },
    ambient: PET_DEFAULTS.ambient,
    idleTimeoutMs: PET_DEFAULTS.idleTimeoutMs,
  };
}
