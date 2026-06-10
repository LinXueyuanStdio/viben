import { useEffect, useState, useCallback } from "react";
import type { PetConfig } from "@viben/pet";
import {
  fetchPetConfigFromGateway,
  loadPetConfig,
  type PetConfigResponse,
} from "@/lib/pet-loader";

export type { PetConfigResponse };

/** Default pet ID when user has no selection */
const DEFAULT_PET_ID = "dario";

export interface UsePetResult {
  /** The loaded pet config - always non-null after loading (has default fallback) */
  pet: PetConfig | null;
  /** Raw config from gateway */
  config: PetConfigResponse | null;
  /** Whether the pet window should be displayed (user preference) */
  enabled: boolean;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Hook to load and manage pet state.
 *
 * Always loads the pet config regardless of the `enabled` setting.
 * The `enabled` flag only controls whether the pet window is displayed,
 * not whether pet data is available (e.g., for chat avatars).
 */
export function usePet(): UsePetResult {
  const [pet, setPet] = useState<PetConfig | null>(null);
  const [config, setConfig] = useState<PetConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const cfg = await fetchPetConfigFromGateway();

        if (!mounted) return;
        setConfig(cfg);

        // Use user's selected pet or fall back to default
        const petId = cfg?.current ?? DEFAULT_PET_ID;

        const petData = await loadPetConfig(petId);
        if (mounted) {
          setPet(petData);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          // Even on error, try to load the default pet
          try {
            const fallbackPet = await loadPetConfig(DEFAULT_PET_ID);
            if (mounted) {
              setPet(fallbackPet);
            }
          } catch {
            // If even default fails, pet stays null
            setPet(null);
          }
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    pet,
    config,
    enabled: config?.enabled ?? false,
    loading,
    error,
    reload,
  };
}
