import { describe, expect, it } from 'vitest';

import { getPetPublicAssetUrl, getPublicAssetUrl } from '../example/src/lib/publicAssets';

describe('example public asset URLs', () => {
  it('keeps root-based asset paths when Vite base is root', () => {
    expect(getPublicAssetUrl('/pets/tux/pet.json', '/')).toBe('/pets/tux/pet.json');
  });

  it('prefixes public asset paths with the configured Vite base', () => {
    expect(getPublicAssetUrl('/pets/tux/pet.json', '/viben/pet/')).toBe('/viben/pet/pets/tux/pet.json');
  });

  it('builds pet asset URLs from the pet id and asset path', () => {
    expect(getPetPublicAssetUrl('tux', 'pet.json', '/viben/pet/')).toBe('/viben/pet/pets/tux/pet.json');
    expect(getPetPublicAssetUrl('tux', 'spritesheet.webp', '/viben/pet/')).toBe(
      '/viben/pet/pets/tux/spritesheet.webp'
    );
  });
});
