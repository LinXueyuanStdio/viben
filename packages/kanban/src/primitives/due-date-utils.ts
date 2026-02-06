export function formatDueDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `逾期 ${Math.abs(diffDays)} 天`;
  if (diffDays === 0) return "今天";
  if (diffDays === 1) return "明天";
  if (diffDays < 7) return `${diffDays} 天后`;

  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

export function getDueDateStatus(dueDate: string | Date) {
  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    isOverdue: diffDays < 0,
    isDueSoon: diffDays >= 0 && diffDays <= 2,
    diffDays,
    displayText: formatDueDate(date),
  };
}
