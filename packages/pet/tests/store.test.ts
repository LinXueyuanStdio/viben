import { describe, it, expect, beforeEach } from 'vitest';
import { createPetStore } from '../src/store';
import type { PetConfig, PetPosition, PetInteraction } from '../src/types';

describe('createPetStore', () => {
  it('creates a store with default state', () => {
    const store = createPetStore('test-store-defaults');
    const state = store.getState();

    expect(state.pet).toBeNull();
    expect(state.position).toEqual({ right: 24, bottom: 24 });
    expect(state.interaction).toBe('idle');
    expect(state.ambientRowId).toBeNull();
    expect(state.bubbleOpen).toBe(false);
  });

  it('setPet updates the pet config', () => {
    const store = createPetStore('test-store-setPet');
    const petConfig: PetConfig = {
      id: 'test-pet',
      name: 'TestPet',
      description: 'A test pet',
      accent: '#ff0000',
      greeting: 'Hello!',
      spritesheet: '/sprites/test.png',
      atlas: {
        cols: 8,
        rows: 9,
        cellWidth: 192,
        cellHeight: 208,
        animations: [{ id: 'idle', row: 0, frames: 6, fps: 6 }],
      },
    };

    store.getState().setPet(petConfig);
    expect(store.getState().pet).toEqual(petConfig);
  });

  it('setPosition updates position', () => {
    const store = createPetStore('test-store-setPosition');
    const newPos: PetPosition = { right: 100, bottom: 200 };

    store.getState().setPosition(newPos);
    expect(store.getState().position).toEqual(newPos);
  });

  it('setInteraction updates interaction state', () => {
    const store = createPetStore('test-store-setInteraction');

    store.getState().setInteraction('hover');
    expect(store.getState().interaction).toBe('hover');

    store.getState().setInteraction('drag-right');
    expect(store.getState().interaction).toBe('drag-right');
  });

  it('setAmbientRowId updates ambient row id', () => {
    const store = createPetStore('test-store-setAmbientRowId');

    store.getState().setAmbientRowId('waving');
    expect(store.getState().ambientRowId).toBe('waving');

    store.getState().setAmbientRowId(null);
    expect(store.getState().ambientRowId).toBeNull();
  });

  it('setBubbleOpen updates bubble state', () => {
    const store = createPetStore('test-store-setBubbleOpen');

    store.getState().setBubbleOpen(true);
    expect(store.getState().bubbleOpen).toBe(true);

    store.getState().setBubbleOpen(false);
    expect(store.getState().bubbleOpen).toBe(false);
  });

  it('reset restores default state while keeping actions', () => {
    const store = createPetStore('test-store-reset');

    // Set some state
    store.getState().setInteraction('hover');
    store.getState().setBubbleOpen(true);
    store.getState().setAmbientRowId('jumping');
    store.getState().setPosition({ right: 50, bottom: 50 });

    // Reset
    store.getState().reset();

    const state = store.getState();
    expect(state.pet).toBeNull();
    expect(state.position).toEqual({ right: 24, bottom: 24 });
    expect(state.interaction).toBe('idle');
    expect(state.ambientRowId).toBeNull();
    expect(state.bubbleOpen).toBe(false);
  });

  it('different storage keys create independent stores', () => {
    const store1 = createPetStore('test-store-independent-1');
    const store2 = createPetStore('test-store-independent-2');

    store1.getState().setInteraction('hover');
    expect(store1.getState().interaction).toBe('hover');
    expect(store2.getState().interaction).toBe('idle');
  });
});
