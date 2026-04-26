import { useTranslation } from "react-i18next";
import { KANBAN_COLUMNS, type KanbanColumnId } from "@/lib/kanban";
import type { Status } from "@viben/kanban";
import { COLUMN_COLORS } from "../constants";

// Build column statuses with translations
// 9-column layout: backlog, queue, in_progress, paused, review, completed, failed, cancelled, archived
export function useColumnStatuses(): Status[] {
  const { t } = useTranslation();

  // Map column IDs to i18n keys
  const columnI18nKeys: Record<KanbanColumnId, string> = {
    backlog: "backlog",
    queue: "queue",
    in_progress: "inProgress",
    paused: "paused",
    review: "review",
    completed: "completed",
    failed: "failed",
    cancelled: "cancelled",
    archived: "archived",
  };

  return KANBAN_COLUMNS.map((id) => ({
    id,
    name: t(`workspace.column.${columnI18nKeys[id]}`, id.replace("_", " ")),
    color: COLUMN_COLORS[id],
  }));
}
