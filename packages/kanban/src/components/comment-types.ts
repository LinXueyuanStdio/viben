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
