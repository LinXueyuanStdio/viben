import { useCallback } from "react";
import type {
  CommandQueueItem,
  UseCommandQueueInputRecallOptions,
  UseCommandQueueInputRecallReturn,
} from "./types";
import { mergeQueuedInputRecallItems } from "./merge-queued-content";

const DEFAULT_JOINER = "\n\n";

export function useCommandQueueInputRecall({
  value,
  onValueChange,
  recall,
  joiner = DEFAULT_JOINER,
  onRecalled,
}: UseCommandQueueInputRecallOptions): UseCommandQueueInputRecallReturn {
  const onRecallQueuedInput = useCallback(
    (currentValue?: string) => {
      const inputValue = currentValue ?? value;
      if (inputValue.trim().length > 0) return;

      const recalledItems = recall();
      if (recalledItems.length === 0) return;

      const recalledValue = mergeQueuedInputRecallItems(recalledItems, joiner);
      if (!recalledValue) return;

      onValueChange(recalledValue);
      onRecalled?.(recalledItems, recalledValue);
    },
    [joiner, onRecalled, onValueChange, recall, value]
  );

  return { onRecallQueuedInput };
}
