'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Trash2, Star } from 'lucide-react';
import { toast } from 'sonner';
import { FeedbackDetailDialog } from './feedback-detail-dialog';

interface Feedback {
  id: string; pageId: string; category: string; rating: number; content: string;
  createdAt: string; reporterId: string; reporterName: string | null; reporterDisplayName: string | null;
}

interface Pagination {
  page: number; limit: number; total: number; totalPages: number;
}

export function FeedbackManagement() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [detailFeedbackId, setDetailFeedbackId] = useState<string | null>(null);

  const currentCategory = searchParams.get('category') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const CATEGORY_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    bug: { label: t('dashboard.admin.feedbacks.categories.bug'), variant: 'destructive' },
    suggestion: { label: t('dashboard.admin.feedbacks.categories.suggestion'), variant: 'default' },
    other: { label: t('dashboard.admin.feedbacks.categories.other'), variant: 'secondary' },
  };

  const fetchFeedbacks = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20', category: currentCategory });
      const res = await fetch(`/api/admin/feedbacks?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch feedbacks');
      const data = await res.json();
      setFeedbacks(data.feedbacks);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.feedbacks.loadError'));
    } finally { setLoading(false); }
  }, [currentPage, currentCategory, t]);

  useEffect(() => { fetchFeedbacks(); }, [fetchFeedbacks]);

  const updateFilter = (c: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (c && c !== 'all') params.set('category', c); else params.delete('category');
    params.delete('page');
    router.push(`/admin/feedbacks?${params.toString()}`);
  };

  const setPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`/admin/feedbacks?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/feedbacks/${deleteId}`, { method: 'DELETE' });
      toast.success(t('dashboard.admin.feedbacks.deleteSuccess'));
      setDeleteId(null);
      fetchFeedbacks();
    } catch {
      toast.error(t('dashboard.admin.feedbacks.deleteError'));
      setDeleteId(null);
    } finally { setDeleting(false); }
  };

  const renderStars = (rating: number) => (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
      ))}
    </span>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.feedbacks.title')}</h1><p className="text-muted-foreground">{t('dashboard.admin.feedbacks.subtitle')}</p></div>
      </div>
      <div className="flex gap-2">
        {(['all', 'bug', 'suggestion', 'other'] as const).map((c) => (
          <button key={c} type="button" onClick={() => updateFilter(c)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${currentCategory === c ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
            {c === 'all' ? t('dashboard.admin.feedbacks.filterAll') : CATEGORY_CONFIG[c]?.label || c}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center"><p className="text-destructive">{error}</p><button onClick={fetchFeedbacks} className="mt-2 text-sm text-primary hover:underline">{t('dashboard.admin.feedbacks.retry')}</button></div>
      ) : feedbacks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center"><p className="text-lg text-muted-foreground">{t('dashboard.admin.feedbacks.emptyTitle')}</p></div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full">
            <thead><tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.feedbacks.columns.reporter')}</th><th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.feedbacks.columns.pageId')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.feedbacks.columns.category')}</th><th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.feedbacks.columns.rating')}</th>
              <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.feedbacks.columns.content')}</th><th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.feedbacks.columns.time')}</th>
              <th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.feedbacks.columns.actions')}</th>
            </tr></thead>
            <tbody>
              {feedbacks.map((f) => {
                const catConf = CATEGORY_CONFIG[f.category] || CATEGORY_CONFIG.other;
                return (<tr key={f.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setDetailFeedbackId(f.id)}>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">{f.reporterDisplayName || f.reporterName || t('dashboard.admin.feedbacks.columns.reporter')}</td>
                  <td className="px-4 py-3 text-sm font-mono text-xs max-w-[120px] truncate">{f.pageId.slice(0, 12)}...</td>
                  <td className="px-4 py-3 text-sm"><Badge variant={catConf.variant}>{catConf.label}</Badge></td>
                  <td className="px-4 py-3 text-sm">{renderStars(f.rating)}</td>
                  <td className="px-4 py-3 text-sm max-w-[250px] truncate">{f.content}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">{new Date(f.createdAt).toLocaleString('zh-CN')}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteId(f.id); }} disabled={deleting}>
                      {deleting && deleteId === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                    </Button>
                  </td>
                </tr>);
              })}
            </tbody>
          </table>
        </div>
      )}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} type="button" onClick={() => setPage(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${p === currentPage ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>{p}</button>
          ))}
        </div>
      )}
      <p className="text-sm text-muted-foreground">{t('dashboard.admin.feedbacks.showing', { count: feedbacks.length, total: pagination.total })}</p>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('dashboard.admin.feedbacks.deleteConfirm')}</DialogTitle><DialogDescription>{t('dashboard.admin.feedbacks.deleteConfirmDesc')}</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeedbackDetailDialog
        feedbackId={detailFeedbackId}
        isOpen={!!detailFeedbackId}
        onClose={() => setDetailFeedbackId(null)}
      />
    </div>
  );
}
