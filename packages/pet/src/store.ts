import { createStore } from 'zustand/vanilla';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PetConfig, PetPosition, PetInteraction } from './types';
import { PET_DEFAULTS } from './types';

export interface PetState {
  // Persisted state
  pet: PetConfig | null;
  position: PetPosition;

  // Transient state (not persisted)
  interaction: PetInteraction;
  ambientRowId: string | null;
  bubbleOpen: boolean;

  // Actions
  setPet: (pet: PetConfig | null) => void;
  setPosition: (position: PetPosition) => void;
  setInteraction: (interaction: PetInteraction) => void;
  setAmbientRowId: (id: string | null) => void;
  setBubbleOpen: (open: boolean) => void;
  reset: () => void;
}

const DEFAULT_STATE = {
  pet: null,
  position: { ...PET_DEFAULTS.position },
  interaction: 'idle' as PetInteraction,
  ambientRowId: null,
  bubbleOpen: false,
};

/**
 * In-memory storage fallback for SSR environments where localStorage
 * is not available.
 */
function createMemoryStorage(): {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
} {
  const store = new Map<string, string>();
  return {
    getItem: (name: string) => store.get(name) ?? null,
    setItem: (name: string, value: string) => { store.set(name, value); },
    removeItem: (name: string) => { store.delete(name); },
  };
}

function getStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return createJSONStorage(() => localStorage);
    }
  } catch {
    // localStorage not available (SSR, iframe sandbox, etc.)
  }
  return createJSONStorage(() => createMemoryStorage());
}

/**
 * Creates a new pet store instance with optional persistence.
 * Each store uses its own storage key to avoid collisions in tests.
 */
export function createPetStore(storageKey?: string) {
  const key = storageKey ?? 'viben-pet-store';

  return createStore<PetState>()(
    persist(
      (set) => ({
        ...DEFAULT_STATE,

        setPet: (pet) => set({ pet }),
        setPosition: (position) => set({ position }),
        setInteraction: (interaction) => set({ interaction }),
        setAmbientRowId: (id) => set({ ambientRowId: id }),
        setBubbleOpen: (open) => set({ bubbleOpen: open }),
        reset: () => set({ ...DEFAULT_STATE }),
      }),
      {
        name: key,
        storage: getStorage(),
        // Only persist pet and position, not transient interaction state
        partialize: (state) => ({
          pet: state.pet,
          position: state.position,
        }),
      },
    ),
  );
}

/** Default store instance for use across the application. */
export const usePetStore = createPetStore();
