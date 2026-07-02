'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Trash2, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BatchActionsBar } from '@/components/admin/batch-actions-bar';
import type { BatchAction } from '@/components/admin/batch-actions-bar';
import { cn } from '@/lib/utils';

interface CommentUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

interface CommentItem {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  user: CommentUser;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 30) return `${diffDays} 天前`;
  return d.toLocaleDateString('zh-CN');
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN');
}

export function CommentModeration() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  // Detail dialog state
  const [detailComment, setDetailComment] = useState<CommentItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Edit mode state
  const [editContent, setEditContent] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentEntityType = searchParams.get('entity_type') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const entityTypeLabels: Record<string, string> = {
    mcp: t('dashboard.admin.comments.entityTypes.mcp'),
    skill: t('dashboard.admin.comments.entityTypes.skill'),
    collection: t('dashboard.admin.comments.entityTypes.collection'),
  };

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        entity_type: currentEntityType,
      });
      const res = await fetch(`/api/admin/comments?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      const data = await res.json();
      setComments(data.comments);
      setPagination(data.pagination);
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.comments.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentEntityType, t]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/admin/comments?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/comments/${deleteId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete comment');
      toast.success(t('dashboard.admin.comments.deleteSuccess'));
      setDeleteId(null);
      setDetailComment(null);
      fetchComments();
    } catch {
      toast.error(t('dashboard.admin.comments.deleteError'));
    } finally {
      setDeleting(false);
    }
  };

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(comments.map((c) => c.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Batch actions
  const batchActions: BatchAction[] = [
    {
      key: 'delete',
      label: '批量删除',
      variant: 'destructive',
      requireConfirm: true,
      confirmTitle: '批量删除评论',
      confirmDescription: `确定要删除选中的 ${selectedIds.size} 条评论吗？此操作不可撤销。`,
      onAction: async () => {
        setBatchLoading(true);
        try {
          const ids = [...selectedIds];
          const res = await fetch('/api/admin/comments/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', ids }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Batch delete failed');
          toast.success(`已删除 ${data.affected} 条评论`);
          deselectAll();
          fetchComments();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '批量删除失败');
        } finally {
          setBatchLoading(false);
        }
      },
    },
  ];

  // Open detail dialog and fetch full comment
  const openDetail = useCallback(async (comment: CommentItem) => {
    setDetailComment(comment);
    setEditing(false);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/comments/${comment.id}`);
      if (res.ok) {
        const data = await res.json();
        setDetailComment(data.comment);
      }
    } catch {
      // Keep the list-level data if detail fetch fails
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetailComment(null);
    setEditing(false);
    setEditContent('');
  }, []);

  const startEdit = useCallback(() => {
    if (detailComment) {
      setEditContent(detailComment.content);
      setEditing(true);
    }
  }, [detailComment]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditContent('');
  }, []);

  const saveEdit = useCallback(async () => {
    if (!detailComment || !editContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/comments/${detailComment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update comment');
      }
      const data = await res.json();
      toast.success(t('dashboard.admin.comments.editSuccess'));
      // Merge updated fields into existing detail to preserve user/entityName
      setDetailComment((prev) =>
        prev
          ? {
              ...prev,
              content: data.comment.content,
              updatedAt: data.comment.updatedAt,
            }
          : prev
      );
      setEditing(false);
      fetchComments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dashboard.admin.comments.editError'));
    } finally {
      setSaving(false);
    }
  }, [detailComment, editContent, fetchComments, t]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.comments.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.admin.comments.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'mcp', 'skill', 'collection'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => updateFilter('entity_type', type)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentEntityType === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {type === 'all' ? t('dashboard.admin.comments.filterAll') : entityTypeLabels[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Actions Bar */}
      <BatchActionsBar
        selectedCount={selectedIds.size}
        totalCount={comments.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        actions={batchActions}
        loading={batchLoading}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchComments} className="mt-2 text-sm text-primary hover:underline">{t('dashboard.admin.comments.retry')}</button>
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">{t('dashboard.admin.comments.emptyTitle')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-muted-foreground/30 cursor-pointer accent-primary"
                    checked={selectedIds.size === comments.length && comments.length > 0}
                    onChange={() => {
                      if (selectedIds.size === comments.length) {
                        deselectAll();
                      } else {
                        selectAll();
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.comments.columns.user')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.comments.columns.content')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.comments.columns.entity')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.comments.columns.time')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.comments.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((c) => {
                const isSelected = selectedIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors',
                      isSelected && 'bg-primary/5'
                    )}
                    onClick={() => openDetail(c)}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-muted-foreground/30 cursor-pointer accent-primary"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={c.user.avatarUrl ?? undefined} />
                          <AvatarFallback className="text-xs">{getInitials(c.user.displayName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium">{c.user.displayName}</span>
                          <span className="text-muted-foreground ml-1">@{c.user.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[300px] truncate">
                      {c.content.length > 80 ? `${c.content.slice(0, 80)}...` : c.content}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="flex items-center gap-1">
                        <Badge variant="outline">{entityTypeLabels[c.entityType] || c.entityType}</Badge>
                        <span className="text-muted-foreground">{c.entityName}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(c.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(c.id)}
                        title={t('dashboard.admin.comments.delete')}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('page', String(page));
            return (
              <button
                key={page}
                type="button"
                onClick={() => router.push(`/admin/comments?${params.toString()}`)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === currentPage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {t('dashboard.admin.comments.showing', { count: comments.length, total: pagination.total })}
      </p>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.comments.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.admin.comments.deleteConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comment Detail Dialog */}
      <Dialog open={!!detailComment} onOpenChange={closeDetail}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{'评论详情'}</DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : detailComment ? (
            <div className="space-y-4">
              {/* Author Info */}
              <div className="flex items-center gap-3 border-b pb-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={detailComment.user.avatarUrl ?? undefined} />
                  <AvatarFallback>{getInitials(detailComment.user.displayName)}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{detailComment.user.displayName}</div>
                  <div className="text-sm text-muted-foreground">@{detailComment.user.username}</div>
                </div>
              </div>

              {/* Entity Info */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">评论对象：</span>
                <Badge variant="outline">{entityTypeLabels[detailComment.entityType] || detailComment.entityType}</Badge>
                <span className="text-sm">{detailComment.entityName}</span>
              </div>

              {/* Comment Content */}
              <div>
                <span className="text-sm text-muted-foreground block mb-2">评论内容：</span>
                {editing ? (
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[120px]"
                    placeholder="编辑评论内容..."
                  />
                ) : (
                  <div className="rounded-md bg-muted/50 p-4 whitespace-pre-wrap text-sm leading-relaxed">
                    {detailComment.content}
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div className="flex flex-col gap-1 text-sm text-muted-foreground border-t pt-4">
                <div>
                  创建时间：{formatDateTime(detailComment.createdAt)}
                </div>
                {detailComment.updatedAt && (
                  <div>
                    更新时间：{formatDateTime(detailComment.updatedAt)}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter className="flex justify-between sm:justify-between">
            <div className="flex gap-2">
              {editing ? (
                <>
                  <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                    <X className="h-4 w-4 mr-1" />
                    取消
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={saving || !editContent.trim()}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                    保存
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    <Pencil className="h-4 w-4 mr-1" />
                    编辑
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (detailComment) {
                        setDeleteId(detailComment.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    删除
                  </Button>
                </>
              )}
            </div>
            <Button variant="outline" onClick={closeDetail}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
