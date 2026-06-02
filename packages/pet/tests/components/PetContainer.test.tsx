import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PetContainer } from '../../src/components/PetContainer';
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

describe('PetContainer', () => {
  it('renders nothing when pet is null', () => {
    const { container } = render(<PetContainer pet={null} />);
    expect(container.querySelector('.pet-overlay')).toBeNull();
  });

  it('renders pet overlay when pet is provided', () => {
    render(<PetContainer pet={mockPet} />);
    const overlay = document.querySelector('.pet-overlay');
    expect(overlay).toBeTruthy();
  });

  it('shows bubble when showBubble is true', () => {
    render(<PetContainer pet={mockPet} showBubble={true} />);
    const bubble = document.querySelector('.pet-bubble');
    expect(bubble).toBeTruthy();
  });

  it('hides bubble when showBubble is false', () => {
    render(<PetContainer pet={mockPet} showBubble={false} />);
    const bubble = document.querySelector('.pet-bubble');
    expect(bubble).toBeNull();
  });

  it('displays pet name in bubble', () => {
    render(<PetContainer pet={mockPet} showBubble={true} />);
    const name = document.querySelector('.pet-bubble-name');
    expect(name?.textContent).toBe('Test Pet');
  });

  it('displays greeting in bubble', () => {
    render(<PetContainer pet={mockPet} showBubble={true} />);
    const content = document.querySelector('.pet-bubble-line');
    expect(content?.textContent).toBe('Hello!');
  });

  it('renders sprite element for interaction', () => {
    const onTap = vi.fn();
    render(<PetContainer pet={mockPet} onTap={onTap} showBubble={false} />);

    const sprite = document.querySelector('.pet-sprite') as HTMLElement;
    expect(sprite).toBeTruthy();
    expect(sprite.style.cursor).toBe('grab');
  });

  it('applies custom position', () => {
    render(
      <PetContainer
        pet={mockPet}
        position={{ right: 100, bottom: 200 }}
      />
    );
    const overlay = document.querySelector('.pet-overlay') as HTMLElement;
    expect(overlay?.style.right).toBe('100px');
    expect(overlay?.style.bottom).toBe('200px');
  });
});
