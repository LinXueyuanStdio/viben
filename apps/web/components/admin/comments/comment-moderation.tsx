'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CommentItem {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
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
      fetchComments();
    } catch {
      toast.error(t('dashboard.admin.comments.deleteError'));
    } finally {
      setDeleteId(null);
      setDeleting(false);
    }
  };

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
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.comments.columns.user')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.comments.columns.content')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.comments.columns.entity')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.comments.columns.time')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.comments.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
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
                  <td className="px-4 py-3 text-right">
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
              ))}
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
    </div>
  );
}
