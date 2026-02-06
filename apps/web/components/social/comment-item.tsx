'use client';

import * as React from 'react';
import { Trash2, MessageSquare, CornerDownRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Author {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Comment {
  id: string;
  content: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: Author;
  replies?: Comment[];
}

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onDelete: (commentId: string) => Promise<void>;
  onReply: (parentId: string) => void;
  isReply?: boolean;
  isAuthenticated: boolean;
}

export function CommentItem({
  comment,
  currentUserId,
  onDelete,
  onReply,
  isReply = false,
  isAuthenticated,
}: CommentItemProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const isOwner = currentUserId === comment.author.id;

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className={cn('group', isReply && 'ml-8')}>
      <div className="flex gap-3">
        {isReply && (
          <CornerDownRight className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
        )}
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.author.avatarUrl || undefined} />
          <AvatarFallback>
            {comment.author.username[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">
              {comment.author.displayName}
            </span>
            <span className="text-xs text-muted-foreground">
              @{comment.author.username}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelativeTime(comment.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
            {comment.content}
          </p>
          <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {isAuthenticated && !isReply && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onReply(comment.id)}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}
            {isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      your comment{comment.replies && comment.replies.length > 0 ? ' and all its replies' : ''}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Render replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onDelete={onDelete}
              onReply={onReply}
              isReply
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
    </div>
  );
}

CommentItem.displayName = 'CommentItem';
