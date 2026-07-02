'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface RatingItem {
  userId: string;
  entityType: string;
  entityId: string;
  score: number;
  createdAt: string;
  entityName: string;
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

function renderStars(score: number) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < score ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  );
}

export function RatingManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RatingItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentEntityType = searchParams.get('entity_type') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const entityTypeLabels: Record<string, string> = {
    mcp: t('dashboard.admin.entityTypes.mcp'),
    skill: t('dashboard.admin.entityTypes.skill'),
  };

  function formatRelativeTime(date: Date | string): string {
    const now = new Date();
    const d = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t('dashboard.admin.ratings.justNow');
    if (diffMins < 60) return t('dashboard.admin.ratings.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('dashboard.admin.ratings.hoursAgo', { count: diffHours });
    if (diffDays < 30) return t('dashboard.admin.ratings.daysAgo', { count: diffDays });
    return d.toLocaleDateString();
  }

  const fetchRatings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        entity_type: currentEntityType,
      });
      const res = await fetch(`/api/admin/ratings?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch ratings');
      const data = await res.json();
      setRatings(data.ratings);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.ratings.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentEntityType, t]);

  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set(key, value);
    else params.delete(key);
    params.delete('page');
    router.push(`/admin/ratings?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Encode composite key: userId__entityType__entityId
      const encodedId = `${deleteTarget.userId}__${deleteTarget.entityType}__${deleteTarget.entityId}`;
      const res = await fetch(`/api/admin/ratings/${encodedId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete rating');
      fetchRatings();
      toast.success(t('dashboard.admin.ratings.deleteSuccess'));
    } catch {
      toast.error(t('dashboard.admin.ratings.deleteError'));
    } finally {
      setDeleteTarget(null);
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.ratings.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.admin.ratings.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'mcp', 'skill'] as const).map((type) => (
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
              {type === 'all' ? t('dashboard.admin.ratings.filterAll') : entityTypeLabels[type]}
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
          <button onClick={fetchRatings} className="mt-2 text-sm text-primary hover:underline">
            {t('dashboard.admin.ratings.retry')}
          </button>
        </div>
      ) : ratings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">{t('dashboard.admin.ratings.emptyTitle')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.ratings.columns.user')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.ratings.columns.entity')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.ratings.columns.score')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.ratings.columns.time')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.ratings.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((r) => (
                <tr key={`${r.userId}:${r.entityType}:${r.entityId}`} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={r.user.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">{getInitials(r.user.displayName)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{r.user.displayName}</span>
                        <span className="text-muted-foreground ml-1">@{r.user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="flex items-center gap-1">
                      <Badge variant="outline">{entityTypeLabels[r.entityType] || r.entityType}</Badge>
                      <span className="text-muted-foreground">{r.entityName}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {renderStars(r.score)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                    {formatRelativeTime(r.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(r)}
                      title={t('dashboard.admin.ratings.delete')}
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
                onClick={() => router.push(`/admin/ratings?${params.toString()}`)}
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
        {t('dashboard.admin.ratings.showing', { count: ratings.length, total: pagination.total })}
      </p>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.ratings.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.admin.ratings.deleteConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
