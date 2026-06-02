import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PetSprite } from '../../src/components/PetSprite';
import type { PetConfig } from '../../src/types';
import { STANDARD_ANIMATIONS } from '../../src/types';

const mockPet: PetConfig = {
  id: 'test-pet',
  name: 'Test Pet',
  description: 'A test pet',
  accent: '#ff0000',
  greeting: 'Hello!',
  spritesheet: 'data:image/png;base64,test',
  atlas: {
    cols: 8,
    rows: 9,
    cellWidth: 192,
    cellHeight: 208,
    animations: STANDARD_ANIMATIONS,
  },
};

describe('PetSprite', () => {
  it('renders with pet config', () => {
    render(<PetSprite pet={mockPet} />);
    const sprite = document.querySelector('.pet-image.atlas');
    expect(sprite).toBeTruthy();
  });

  it('applies custom className', () => {
    render(<PetSprite pet={mockPet} className="custom-class" />);
    const sprite = document.querySelector('.custom-class');
    expect(sprite).toBeTruthy();
  });

  it('sets background image from spritesheet', () => {
    render(<PetSprite pet={mockPet} />);
    const sprite = document.querySelector('.pet-image.atlas') as HTMLElement;
    expect(sprite?.style.backgroundImage).toContain(mockPet.spritesheet);
  });

  it('accepts custom size', () => {
    render(<PetSprite pet={mockPet} size={64} />);
    const sprite = document.querySelector('.pet-image.atlas') as HTMLElement;
    expect(sprite?.style.width).toBe('64px');
    expect(sprite?.style.height).toBe('64px');
  });
});
