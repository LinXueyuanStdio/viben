import { useEffect, useState, useCallback } from "react";
import type { PetConfig } from "@viben/pet";
import {
  fetchPetConfigFromGateway,
  loadPetConfig,
  type PetConfigResponse,
} from "@/lib/pet-loader";

export type { PetConfigResponse };

export interface UsePetResult {
  pet: PetConfig | null;
  config: PetConfigResponse | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Hook to load and manage pet state
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

        if (!cfg?.enabled || !cfg.current) {
          setPet(null);
          setLoading(false);
          return;
        }

        const petData = await loadPetConfig(cfg.current);
        if (mounted) {
          setPet(petData);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setPet(null);
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

  return { pet, config, loading, error, reload };
}
