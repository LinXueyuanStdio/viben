import type { QueuedInputRecallItem } from "../chat-input/types";

const DEFAULT_QUEUE_RECALL_JOINER = "\n\n";

export function mergeQueuedInputRecallItems(
  items: QueuedInputRecallItem[],
  joiner = DEFAULT_QUEUE_RECALL_JOINER
): string {
  return items
    .map((item) => item.content.trim())
    .filter(Boolean)
    .join(joiner);
}
