'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Send,
  Share2,
  Bookmark,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type CommunityEntityType = 'published_page' | 'moment' | 'comment';

type CommunitySummary = {
  entity: {
    id: string;
    entity_type: CommunityEntityType;
    entity_id: string;
    visibility: string;
    status: string;
    reactions_count: number;
    bookmarks_count: number;
    comments_count: number;
    canonical_path?: string | null;
  };
  viewer: {
    is_authenticated: boolean;
    has_reacted: boolean;
    has_bookmarked: boolean;
    can_comment: boolean;
    can_moderate: boolean;
    user_id?: string | null;
    can_manage_comments?: boolean;
  };
};

type CommunityComment = {
  id: string;
  content: string;
  status: string;
  depth: number;
  replies_count: number;
  reactions_count: number;
  viewer_has_reacted: boolean;
  created_at: string;
  updated_at: string;
  author: {
    id: string;
    user_slug: string;
    display_name: string;
    avatar_url: string | null;
  };
};

type CommentsResponse = {
  comments: CommunityComment[];
  next_cursor: string | null;
};

type CommunityInteractionsProps = {
  entityType: 'published_page';
  entityId: string;
  userSlug: string;
  pageId: string;
  pageTitle: string;
  initialSummary: CommunitySummary;
  viewer: CommunitySummary['viewer'];
};

const loginMessage = '登录后才能与此页面互动。';

export function CommunityInteractions({
  entityType,
  entityId,
  userSlug,
  pageId,
  pageTitle,
  initialSummary,
  viewer,
}: CommunityInteractionsProps) {
  const [summary, setSummary] = useState<CommunitySummary>({
    ...initialSummary,
    viewer: {
      ...initialSummary.viewer,
      ...viewer,
    },
  });
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [pendingAction, setPendingAction] = useState<'like' | 'bookmark' | null>(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const readPath = useMemo(
    () =>
      initialSummary.entity.canonical_path ??
      `/${encodeURIComponent(userSlug)}/${encodeURIComponent(pageId)}?tab=read`,
    [initialSummary.entity.canonical_path, pageId, userSlug]
  );

  useEffect(() => {
    void loadComments();
  }, []);

  function requireInteractionAuth() {
    if (summary.viewer.is_authenticated) return true;
    toast.error(loginMessage);
    return false;
  }

  function canWriteComment() {
    if (!requireInteractionAuth()) return false;
    if (summary.viewer.can_comment) return true;
    toast.error('您无法在此页面评论。');
    return false;
  }

  async function refreshSummary() {
    const params = new URLSearchParams({
      entity_type: entityType,
      entity_id: entityId,
    });
    const response = await fetch(`/api/community/entities/summary?${params.toString()}`);
    if (!response.ok) return;
    const data = (await response.json()) as Partial<CommunitySummary>;
    if (data.entity && data.viewer) {
      setSummary((current) => ({
        entity: data.entity as CommunitySummary['entity'],
        viewer: {
          ...data.viewer,
          user_id: current.viewer.user_id,
        } as CommunitySummary['viewer'],
      }));
    }
  }

  async function loadComments(cursor?: string | null) {
    setIsLoadingComments(true);
    try {
      const params = new URLSearchParams({
        entity_type: entityType,
        entity_id: entityId,
        limit: '20',
      });
      if (cursor) params.set('cursor', cursor);

      const response = await fetch(`/api/community/comments?${params.toString()}`);
      if (!response.ok) throw new Error('comments_load_failed');
      const data = (await response.json()) as CommentsResponse;
      setComments((current) => (cursor ? [...current, ...data.comments] : data.comments));
      setNextCursor(data.next_cursor);
    } catch {
      setCommentError('无法加载评论。');
    } finally {
      setIsLoadingComments(false);
    }
  }

  async function toggleLike() {
    if (!requireInteractionAuth()) return;
    setPendingAction('like');
    try {
      const response = await fetch('/api/community/reactions/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          reaction_type: 'like',
        }),
      });
      if (!response.ok) throw new Error('reaction_failed');
      const data = (await response.json()) as {
        has_reacted: boolean;
        reactions_count: number;
      };
      setSummary((current) => ({
        ...current,
        entity: {
          ...current.entity,
          reactions_count: data.reactions_count,
        },
        viewer: {
          ...current.viewer,
          has_reacted: data.has_reacted,
        },
      }));
      void refreshSummary();
    } catch {
      toast.error('无法更新点赞。');
    } finally {
      setPendingAction(null);
    }
  }

  async function toggleBookmark() {
    if (!requireInteractionAuth()) return;
    setPendingAction('bookmark');
    try {
      const response = await fetch('/api/community/bookmarks/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
        }),
      });
      if (!response.ok) throw new Error('bookmark_failed');
      const data = (await response.json()) as {
        has_bookmarked: boolean;
        bookmarks_count: number;
      };
      setSummary((current) => ({
        ...current,
        entity: {
          ...current.entity,
          bookmarks_count: data.bookmarks_count,
        },
        viewer: {
          ...current.viewer,
          has_bookmarked: data.has_bookmarked,
        },
      }));
      void refreshSummary();
    } catch {
      toast.error('无法更新收藏。');
    } finally {
      setPendingAction(null);
    }
  }

  async function copyShareLink() {
    try {
      const absoluteUrl = new URL(readPath, window.location.origin).toString();
      await navigator.clipboard.writeText(absoluteUrl);
      toast.success('链接已复制。');
    } catch {
      toast.error('无法复制链接。');
    }
  }

  async function submitComment() {
    if (!canWriteComment()) return;
    const content = commentText.trim();
    if (!content) {
      setCommentError('评论不能为空。');
      return;
    }

    setIsPostingComment(true);
    setCommentError('');
    try {
      const response = await fetch('/api/community/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          parent_comment_id: null,
          content,
        }),
      });
      if (!response.ok) throw new Error('comment_failed');
      const data = (await response.json()) as {
        comment: {
          id: string;
          content: string;
          status: string;
          depth: number;
          parent_comment_id: string | null;
          created_at: string;
        };
      };
      setComments((current) => [
        {
          id: data.comment.id,
          content: data.comment.content,
          status: data.comment.status,
          depth: data.comment.depth,
          replies_count: 0,
          reactions_count: 0,
          viewer_has_reacted: false,
          created_at: data.comment.created_at,
          updated_at: data.comment.created_at,
          author: {
            id: summary.viewer.user_id ?? 'current-user',
            user_slug: 'you',
            display_name: 'You',
            avatar_url: null,
          },
        },
        ...current,
      ]);
      setSummary((current) => ({
        ...current,
        entity: {
          ...current.entity,
          comments_count: current.entity.comments_count + 1,
        },
      }));
      setCommentText('');
      void refreshSummary();
    } catch {
      setCommentError('无法发布评论。');
    } finally {
      setIsPostingComment(false);
    }
  }

  async function toggleCommentReaction(commentId: string) {
    if (!requireInteractionAuth()) return;
    const response = await fetch('/api/community/reactions/toggle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entity_type: 'comment',
        entity_id: commentId,
        reaction_type: 'like',
      }),
    });
    if (!response.ok) {
      toast.error('无法更新点赞。');
      return;
    }
    const data = (await response.json()) as {
      has_reacted: boolean;
      reactions_count: number;
    };
    setComments((current) =>
      current.map((comment) =>
        comment.id === commentId
          ? {
              ...comment,
              viewer_has_reacted: data.has_reacted,
              reactions_count: data.reactions_count,
            }
          : comment
      )
    );
  }

  async function deleteComment(commentId: string) {
    if (!requireInteractionAuth()) return;
    if (!window.confirm('确定删除此评论吗？')) return;
    const response = await fetch(`/api/community/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'delete' }),
    });
    if (!response.ok) {
      toast.error('无法删除评论。');
      return;
    }
    const data = (await response.json()) as { deleted_count?: number };
    setComments((current) => current.filter((comment) => comment.id !== commentId));
    setSummary((current) => ({
      ...current,
      entity: {
        ...current.entity,
        comments_count: Math.max(
          current.entity.comments_count - Math.max(data.deleted_count ?? 1, 1),
          0
        ),
      },
    }));
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="community-actions-title">
        <div className="relative flex items-center justify-between gap-3">
          <h2 id="community-actions-title" className="text-sm font-semibold">
            互动
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="更多操作"
            aria-haspopup="menu"
            aria-expanded={isMoreOpen}
            className="h-9 w-9"
            onClick={() => setIsMoreOpen((open) => !open)}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
          {isMoreOpen ? (
            <div
              role="menu"
              className="absolute right-0 top-10 z-10 min-w-36 rounded-md border border-border bg-popover p-1 shadow-sm"
            >
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onClick={() => {
                  setIsMoreOpen(false);
                  void copyShareLink();
                }}
              >
                <Share2 className="h-4 w-4" />
                复制链接
              </button>
            </div>
          ) : null}
        </div>
        <div className="mt-4 grid gap-2">
          <ActionButton
            label="点赞"
            count={summary.entity.reactions_count}
            active={summary.viewer.has_reacted}
            icon={<ThumbsUp className="h-4 w-4" />}
            disabled={pendingAction === 'like'}
            loading={pendingAction === 'like'}
            onClick={toggleLike}
          />
          <ActionButton
            label="收藏"
            count={summary.entity.bookmarks_count}
            active={summary.viewer.has_bookmarked}
            icon={<Bookmark className="h-4 w-4" />}
            disabled={pendingAction === 'bookmark'}
            loading={pendingAction === 'bookmark'}
            onClick={toggleBookmark}
          />
          <ActionButton
            label="评论"
            count={summary.entity.comments_count}
            icon={<MessageSquare className="h-4 w-4" />}
            onClick={() => {
              if (summary.viewer.is_authenticated) {
                commentInputRef.current?.focus();
                return;
              }
              toast.error(loginMessage);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10 justify-start"
            onClick={copyShareLink}
            aria-label={`分享 ${pageTitle}`}
          >
            <Share2 className="h-4 w-4" />
            <span>分享</span>
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="community-comments-title">
        <h2 id="community-comments-title" className="text-sm font-semibold">
          评论
        </h2>
        <div className="mt-4 space-y-3">
          <label htmlFor="community-comment" className="text-sm font-medium">
            添加评论
          </label>
          <Textarea
            id="community-comment"
            ref={commentInputRef}
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            onFocus={() => {
              if (!summary.viewer.is_authenticated) {
                toast.error(loginMessage);
              } else if (!summary.viewer.can_comment) {
                toast.error('您无法在此页面评论。');
              }
            }}
            placeholder="参与讨论"
            className="min-h-24 resize-y"
            readOnly={!summary.viewer.can_comment}
          />
          <div aria-live="polite" className="min-h-5 text-sm text-destructive">
            {commentError}
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={submitComment}
            disabled={isPostingComment || (summary.viewer.is_authenticated && !summary.viewer.can_comment)}
          >
            <Send className="h-4 w-4" />
            发布评论
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {comments.map((comment) => (
            <CommunityCommentItem
              key={comment.id}
              comment={comment}
              viewer={summary.viewer}
              onToggleReaction={toggleCommentReaction}
              onDelete={deleteComment}
            />
          ))}
          {!isLoadingComments && comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无评论。</p>
          ) : null}
          {nextCursor ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => loadComments(nextCursor)}
              disabled={isLoadingComments}
            >
              加载更多
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ActionButton({
  label,
  count,
  icon,
  active = false,
  disabled = false,
  loading = false,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn('h-10 justify-between', active && 'border-primary text-primary')}
      disabled={disabled}
      onClick={onClick}
      aria-label={`${label}：${count}`}
      aria-pressed={active}
    >
      <span className="inline-flex items-center gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {label}
      </span>
      <span className="min-w-6 text-right tabular-nums">{count}</span>
    </Button>
  );
}

function CommunityCommentItem({
  comment,
  viewer,
  onToggleReaction,
  onDelete,
}: {
  comment: CommunityComment;
  viewer: CommunitySummary['viewer'];
  onToggleReaction: (commentId: string) => void;
  onDelete: (commentId: string) => void;
}) {
  const canManage =
    viewer.can_manage_comments || viewer.can_moderate || viewer.user_id === comment.author.id;

  return (
    <article className="min-w-0 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{comment.author.display_name}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(comment.created_at).toLocaleDateString()}
          </p>
        </div>
        {canManage ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="删除评论"
            onClick={() => onDelete(comment.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{comment.content}</p>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('h-8 px-2', comment.viewer_has_reacted && 'text-primary')}
          onClick={() => onToggleReaction(comment.id)}
          aria-label={`点赞评论：${comment.reactions_count}`}
        >
          <ThumbsUp className="h-4 w-4" />
          <span className="tabular-nums">{comment.reactions_count}</span>
        </Button>
        {comment.replies_count > 0 ? <span>{comment.replies_count} 条回复</span> : null}
      </div>
    </article>
  );
}

export type { CommunityInteractionsProps };
