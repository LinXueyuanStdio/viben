/**
 * useModelAutoCorrect Hook
 *
 * Auto-corrects the selected model when the filtered model list changes
 * (e.g., after agent selection changes executor constraints).
 * If the currently selected model is no longer in the filtered list,
 * automatically selects the first available model.
 */

import { useEffect, useMemo, useRef } from "react";

export function useModelAutoCorrect(
  filteredModels: { id: string }[],
  selectedModelId: string | null,
  setSelectedModelId: (id: string | null) => void,
): void {
  // Create a stable string key from model IDs to use as effect dependency
  // This prevents re-running when array reference changes but content is same
  const modelIdsKey = useMemo(
    () => filteredModels.map((m) => m.id).join(","),
    [filteredModels]
  );

  // Track the first model ID for auto-selection (stable primitive)
  const firstModelId = filteredModels[0]?.id ?? null;

  // Use ref to track if we've already corrected for this model list
  // Initialize to empty string so first run always checks
  const lastCorrectedKeyRef = useRef("");

  useEffect(() => {
    // Skip if no models available
    if (filteredModels.length === 0) return;

    // Skip if we already corrected for this exact model list
    if (modelIdsKey === lastCorrectedKeyRef.current) return;

    // Check if current selection is valid
    const currentValid = filteredModels.some((m) => m.id === selectedModelId);

    if (!currentValid && firstModelId) {
      // Auto-correct to first available model
      setSelectedModelId(firstModelId);
      // Mark this key as corrected to prevent re-triggering
      lastCorrectedKeyRef.current = modelIdsKey;
    } else if (currentValid) {
      // Selection is valid, mark as handled to skip future checks for same list
      lastCorrectedKeyRef.current = modelIdsKey;
    }
  }, [modelIdsKey, selectedModelId, firstModelId, setSelectedModelId, filteredModels.length]);
}
