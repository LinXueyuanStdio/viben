import { describe, expect, it } from 'vitest';

import { createCustomPetConfig } from '../example/src/lib/customPetConfig';
import { PET_DEFAULTS, STANDARD_ANIMATIONS } from '../src/types';
import type { CustomPet } from '../example/src/lib/petStorage';

const customPet: CustomPet = {
  id: 'custom-1',
  displayName: 'Custom One',
  description: 'A custom pet',
  accent: '#00ff00',
  greeting: 'Hello custom',
  spritesheetDataUrl: 'data:image/png;base64,custom',
  createdAt: 1,
  updatedAt: 1,
};

describe('example custom pet config', () => {
  it('creates a renderable pet config from a stored custom pet', () => {
    expect(createCustomPetConfig(customPet)).toEqual({
      id: 'custom-1',
      name: 'Custom One',
      description: 'A custom pet',
      accent: '#00ff00',
      greeting: 'Hello custom',
      spritesheet: 'data:image/png;base64,custom',
      atlas: {
        cols: 8,
        rows: 9,
        cellWidth: 192,
        cellHeight: 208,
        animations: STANDARD_ANIMATIONS,
      },
      ambient: PET_DEFAULTS.ambient,
      idleTimeoutMs: PET_DEFAULTS.idleTimeoutMs,
    });
  });
});
