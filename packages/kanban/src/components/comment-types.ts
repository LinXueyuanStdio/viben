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
 * Format a date string to a relative time string (Chinese)
 * @param date - ISO date string
 * @returns Relative time string like "刚刚", "5分钟前", "1小时前", "昨天", "3天前"
 */
export function formatRelativeTime(date: string): string {
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
    return "刚刚";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }

  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }

  if (diffDays === 1) {
    return "昨天";
  }

  if (diffDays < 7) {
    return `${diffDays}天前`;
  }

  if (diffWeeks < 4) {
    return `${diffWeeks}周前`;
  }

  if (diffMonths < 12) {
    return `${diffMonths}个月前`;
  }

  return `${diffYears}年前`;
}
