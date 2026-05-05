import { Loader2 } from "lucide-react";
import { CommentList, type Comment } from "@viben/kanban";
import { ScrollArea } from "@viben/ui";

export interface CommentsTabProps {
  comments: Comment[];
  currentUserId: string;
  isLoading: boolean;
  disabled: boolean;
  inputPlaceholder: string;
  emptyMessage: string;
  onAdd: (content: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onDelete: (commentId: string) => void;
  onToggleReaction: (commentId: string, emoji: string) => void;
}

export function CommentsTab({
  comments,
  currentUserId,
  isLoading,
  disabled,
  inputPlaceholder,
  emptyMessage,
  onAdd,
  onEdit,
  onDelete,
  onToggleReaction,
}: CommentsTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <CommentList
            comments={comments}
            currentUserId={currentUserId}
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleReaction={onToggleReaction}
            disabled={disabled}
            inputPlaceholder={inputPlaceholder}
            emptyMessage={emptyMessage}
          />
        )}
      </div>
    </ScrollArea>
  );
}
