"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import { cn, Separator } from "@viben/ui";
import type { Comment } from "./comment-types";
import { CommentItem } from "./comment-item";
import { CommentInput } from "./comment-input";

export interface CommentListProps {
  comments: Comment[];
  currentUserId: string;
  onAdd?: (content: string) => void;
  onEdit?: (commentId: string, content: string) => void;
  onDelete?: (commentId: string) => void;
  onToggleReaction?: (commentId: string, emoji: string) => void;
  disabled?: boolean;
  className?: string;
  inputPlaceholder?: string;
  emptyMessage?: string;
}

export const CommentList = React.forwardRef<HTMLDivElement, CommentListProps>(
  (
    {
      comments,
      currentUserId,
      onAdd,
      onEdit,
      onDelete,
      onToggleReaction,
      disabled = false,
      className,
      inputPlaceholder = "添加评论...",
      emptyMessage = "暂无评论",
    },
    ref
  ) => {
    return (
      <div ref={ref} className={cn("space-y-4", className)}>
        {/* Comments List */}
        {comments.length > 0 ? (
          <div className="space-y-0">
            {comments.map((comment, index) => (
              <React.Fragment key={comment.id}>
                <CommentItem
                  comment={comment}
                  currentUserId={currentUserId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleReaction={onToggleReaction}
                />
                {index < comments.length - 1 && (
                  <Separator className="my-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <MessageSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        )}

        {/* Comment Input */}
        {onAdd && (
          <>
            {comments.length > 0 && <Separator />}
            <CommentInput
              onSubmit={onAdd}
              placeholder={inputPlaceholder}
              disabled={disabled}
            />
          </>
        )}
      </div>
    );
  }
);

CommentList.displayName = "CommentList";
