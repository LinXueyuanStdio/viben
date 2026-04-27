'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare } from 'lucide-react';
import { CommentItem } from './comment-item';
import { CommentForm } from './comment-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type EntityType = 'mcp' | 'skill';

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

interface CommentSectionProps {
  entityType: EntityType;
  entityId: string;
  currentUserId?: string;
  isAuthenticated?: boolean;
  className?: string;
}

export function CommentSection({
  entityType,
  entityId,
  currentUserId,
  isAuthenticated = false,
  className,
}: CommentSectionProps) {
  const { t } = useTranslation();
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    username: string;
  } | null>(null);

  const apiPath = entityType === 'mcp' ? 'mcp' : 'skills';

  // Fetch comments on mount
  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/${apiPath}/${entityId}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments);
      } else {
        setError(t('social.failedToLoadComments'));
      }
    } catch (err) {
      setError(t('social.failedToLoadComments'));
      console.error('Failed to fetch comments:', err);
    } finally {
      setIsLoading(false);
    }
  }, [apiPath, entityId, t]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmitComment(content: string, parentId?: string) {
    try {
      const response = await fetch(`/api/${apiPath}/${entityId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parentId }),
      });

      if (response.ok) {
        const data = await response.json();
        const newComment = data.comment;

        if (parentId) {
          // Add reply to parent comment
          setComments((prev) =>
            prev.map((comment) => {
              if (comment.id === parentId) {
                return {
                  ...comment,
                  replies: [...(comment.replies || []), newComment],
                };
              }
              return comment;
            })
          );
        } else {
          // Add new top-level comment
          setComments((prev) => [newComment, ...prev]);
        }
      } else {
        throw new Error('Failed to post comment');
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
      throw err;
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      const response = await fetch(
        `/api/${apiPath}/${entityId}/comments/${commentId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        // Remove comment from state
        setComments((prev) => {
          // First check if it's a top-level comment
          const filteredTopLevel = prev.filter((c) => c.id !== commentId);
          if (filteredTopLevel.length < prev.length) {
            return filteredTopLevel;
          }

          // Otherwise, remove from replies
          return prev.map((comment) => ({
            ...comment,
            replies: comment.replies?.filter((r) => r.id !== commentId),
          }));
        });
      } else {
        throw new Error('Failed to delete comment');
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
      throw err;
    }
  }

  function handleReply(parentId: string) {
    const parentComment = comments.find((c) => c.id === parentId);
    if (parentComment) {
      setReplyingTo({
        id: parentId,
        username: parentComment.author.username,
      });
    }
  }

  function handleCancelReply() {
    setReplyingTo(null);
  }

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          {t('social.comments')}
          {comments.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <CommentForm
          onSubmit={handleSubmitComment}
          parentId={replyingTo?.id}
          replyingToUsername={replyingTo?.username}
          onCancelReply={handleCancelReply}
          isAuthenticated={isAuthenticated}
        />

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-2/3 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={fetchComments}
              className="mt-2 text-sm text-primary hover:underline"
            >
              {t('social.tryAgain')}
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">
              {t('social.noComments')}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                onDelete={handleDeleteComment}
                onReply={handleReply}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

CommentSection.displayName = 'CommentSection';
