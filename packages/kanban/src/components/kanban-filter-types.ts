import type { IssuePriority } from "../primitives/priority-config";

export interface KanbanFilter {
  search?: string;
  priorities?: IssuePriority[];
  tagIds?: string[];
  assigneeIds?: string[];
}

export function countActiveFilters(filter: KanbanFilter): number {
  let count = 0;
  if (filter.search) count++;
  if (filter.priorities?.length) count++;
  if (filter.tagIds?.length) count++;
  if (filter.assigneeIds?.length) count++;
  return count;
}
