/**
 * useModelAutoCorrect Hook
 *
 * Auto-corrects the selected model when the filtered model list changes
 * (e.g., after agent selection changes executor constraints).
 * If the currently selected model is no longer in the filtered list,
 * automatically selects the first available model.
 */

import { useEffect } from "react";

export function useModelAutoCorrect(
  filteredModels: { id: string }[],
  selectedModelId: string | null,
  setSelectedModelId: (id: string | null) => void,
): void {
  useEffect(() => {
    if (filteredModels.length === 0) return;
    const currentValid = filteredModels.some((m) => m.id === selectedModelId);
    if (!currentValid) {
      setSelectedModelId(filteredModels[0].id);
    }
  }, [filteredModels, selectedModelId, setSelectedModelId]);
}
