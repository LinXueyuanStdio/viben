import { useTranslation } from "react-i18next";

export function useFormattedDueDate(date: Date): string {
  const { t } = useTranslation();
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return t("kanban.dueDate.overdueDays", { count: Math.abs(diffDays) });
  if (diffDays === 0) return t("kanban.dueDate.today");
  if (diffDays === 1) return t("kanban.dueDate.tomorrow");
  if (diffDays < 7) return t("kanban.dueDate.inDays", { count: diffDays });

  return date.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

export function useDueDateStatus(dueDate: string | Date) {
  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const displayText = useFormattedDueDate(date);

  return {
    isOverdue: diffDays < 0,
    isDueSoon: diffDays >= 0 && diffDays <= 2,
    diffDays,
    displayText,
  };
}

// Keep old names as aliases for backwards compatibility during migration
/** @deprecated Use useFormattedDueDate instead */
export const formatDueDate = useFormattedDueDate;
/** @deprecated Use useDueDateStatus instead */
export const getDueDateStatus = useDueDateStatus;
