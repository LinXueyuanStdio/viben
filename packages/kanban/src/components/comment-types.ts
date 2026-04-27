import type { TFunction } from "i18next";

export interface CommentAuthor {
  id: string;
  name: string;
  avatar?: string;
}

export interface CommentReaction {
  emoji: string;
  users: Array<{ id: string; name: string }>;
  count: number;
}

export interface Comment {
  id: string;
  content: string;
  author: CommentAuthor;
  createdAt: string;
  updatedAt?: string;
  reactions: CommentReaction[];
}

export const REACTION_EMOJIS = ["👍", "👎", "❤️", "🎉", "😄", "🤔", "👀", "🚀"];

/**
 * Format a date string to a relative time string
 * @param date - ISO date string
 * @param t - i18n translation function
 * @returns Relative time string like "just now", "5m ago", "1h ago", "yesterday", "3d ago"
 */
export function formatRelativeTime(date: string, t: TFunction): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return t("kanban.time.justNow");
  }

  if (diffMinutes < 60) {
    return t("kanban.time.minutesAgo", { count: diffMinutes });
  }

  if (diffHours < 24) {
    return t("kanban.time.hoursAgo", { count: diffHours });
  }

  if (diffDays === 1) {
    return t("kanban.time.yesterday");
  }

  if (diffDays < 7) {
    return t("kanban.time.daysAgo", { count: diffDays });
  }

  if (diffWeeks < 4) {
    return t("kanban.time.weeksAgo", { count: diffWeeks });
  }

  if (diffMonths < 12) {
    return t("kanban.time.monthsAgo", { count: diffMonths });
  }

  return t("kanban.time.yearsAgo", { count: diffYears });
}
