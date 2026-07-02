'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pagination } from '@/components/shared/pagination';
import { Loader2, Eye, Check, X, EyeOff, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PageForReview {
  id: string;
  uid: string;
  userId: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  visibility: string;
  moderationStatus: string;
  publishedAt: string;
  lastPublishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  authorUsername: string | null;
}

interface UpdateEvent {
  version: number;
  eventType: string;
  importance: string;
  title: string;
  changeSummary: string | null;
  createdAt: string;
}

interface PageDetail extends PageForReview {
  html: string;
  tags: string[];
  categoryId: string | null;
  authorEmail: string | null;
  subscriberCount: number;
  updateEvents: UpdateEvent[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN');
}

export function PageReviewManagement() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pages, setPages] = useState<PageForReview[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'hidden' | 'all'>('pending');

  // Read page from URL searchParams
  const currentPage = Number(searchParams.get('page')) || 1;

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Moderate state
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingPageId, setRejectingPageId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);

  const moderationStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: t('dashboard.admin.pages.statusLabels.pending'), variant: 'default' },
    approved: { label: t('dashboard.admin.pages.statusLabels.approved'), variant: 'secondary' },
    rejected: { label: t('dashboard.admin.pages.statusLabels.rejected'), variant: 'destructive' },
    hidden: { label: t('dashboard.admin.pages.statusLabels.hidden'), variant: 'outline' },
  };

  const visibilityLabels: Record<string, string> = {
    public: t('dashboard.admin.pages.visibilityLabels.public'),
    unlisted: t('dashboard.admin.pages.visibilityLabels.unlisted'),
    private: t('dashboard.admin.pages.visibilityLabels.private'),
  };

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        moderation_status: statusFilter,
        page: String(currentPage),
        limit: '20',
      });
      const res = await fetch(`/api/admin/pages?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch pages');
      const data = await res.json();
      setPages(data.pages);
      setPagination(data.pagination || { page: 1, limit: 20, total: data.pages.length, totalPages: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.pages.loadError'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, currentPage, t]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleStatusFilterChange = (s: 'pending' | 'approved' | 'rejected' | 'hidden' | 'all') => {
    setStatusFilter(s);
    // Reset to page 1 when filter changes
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const fetchDetail = async (pageId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`);
      if (!res.ok) throw new Error('Failed to fetch page detail');
      const data = await res.json();
      setSelectedPage({ ...data.page, subscriberCount: data.subscriberCount, updateEvents: data.updateEvents });
      setDetailOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.pages.loadError'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleModerate = async (pageId: string, status: 'approved' | 'rejected' | 'hidden' | 'pending', reason?: string) => {
    setActingId(pageId);
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moderation_status: status,
          rejection_reason: reason || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${status} page`);
      }

      const successKeyMap: Record<string, string> = {
        approved: 'approveSuccess',
        rejected: 'rejectSuccess',
        hidden: 'hideSuccess',
        pending: 'reopenSuccess',
      };
      toast.success(t(`dashboard.admin.pages.${successKeyMap[status] || 'approveSuccess'}`));

      setDetailOpen(false);
      setRejectDialogOpen(false);
      fetchPages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dashboard.admin.pages.actionError'));
    } finally {
      setActingId(null);
    }
  };

  const handleDelete = async (pageId: string) => {
    setActingId(pageId);
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete page');
      }

      toast.success(t('dashboard.admin.pages.deleteSuccess'));

      setDetailOpen(false);
      setDeleteDialogOpen(false);
      setDeletingPageId(null);
      fetchPages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dashboard.admin.pages.actionError'));
    } finally {
      setActingId(null);
    }
  };

  const openRejectDialog = (pageId: string) => {
    setRejectingPageId(pageId);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const openDeleteDialog = (pageId: string) => {
    setDeletingPageId(pageId);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.pages.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.admin.pages.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'hidden', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleStatusFilterChange(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {s === 'all' ? t('dashboard.admin.pages.filterAll') : moderationStatusConfig[s]?.label || s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchPages} className="mt-2 text-sm text-primary hover:underline">
            {t('dashboard.admin.pages.retry')}
          </button>
        </div>
      ) : pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">{t('dashboard.admin.pages.emptyTitle')}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {statusFilter === 'pending' ? t('dashboard.admin.pages.allDone') : t('dashboard.admin.pages.noMatching')}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.pages.columns.title')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.pages.columns.author')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.pages.columns.visibility')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.pages.columns.moderationStatus')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.pages.columns.stats')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.pages.columns.publishedAt')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">{t('dashboard.admin.pages.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => {
                  const modConf = moderationStatusConfig[page.moderationStatus] || moderationStatusConfig.pending;
                  return (
                    <tr key={page.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium max-w-[200px] truncate">
                        {page.title}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {page.authorDisplayName || page.authorUsername || t('dashboard.admin.pages.unknown')}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {visibilityLabels[page.visibility] || page.visibility}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant={modConf.variant}>{modConf.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {`\u{1F441} ${page.viewCount} · ❤ ${page.likeCount} · \u{1F4AC} ${page.commentCount}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(page.lastPublishedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => fetchDetail(page.id)}
                            title={t('dashboard.admin.pages.detailTitle')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {page.moderationStatus === 'pending' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleModerate(page.id, 'approved')}
                                disabled={actingId === page.id}
                                title={t('dashboard.admin.pages.approve')}
                              >
                                {actingId === page.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4 text-green-500" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openRejectDialog(page.id)}
                                disabled={actingId === page.id}
                                title={t('dashboard.admin.pages.reject')}
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                          {page.moderationStatus === 'approved' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleModerate(page.id, 'hidden')}
                              disabled={actingId === page.id}
                              title={t('dashboard.admin.pages.hide')}
                            >
                              <EyeOff className="h-4 w-4" />
                            </Button>
                          )}
                          {page.moderationStatus === 'hidden' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleModerate(page.id, 'approved')}
                              disabled={actingId === page.id}
                              title={t('dashboard.admin.pages.unhide')}
                            >
                              {actingId === page.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                          )}
                          {page.moderationStatus === 'rejected' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleModerate(page.id, 'pending')}
                              disabled={actingId === page.id}
                              title={t('dashboard.admin.pages.reopen')}
                            >
                              <RotateCcw className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(page.id)}
                            disabled={actingId === page.id}
                            title={t('dashboard.admin.pages.deletePage')}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
              />
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {t('dashboard.admin.pages.showing', { count: pages.length, total: pagination.total })}
          </p>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedPage ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedPage.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('dashboard.admin.pages.detailLabels.author')}</span>
                    {selectedPage.authorDisplayName || selectedPage.authorUsername || t('dashboard.admin.pages.unknown')}
                    {selectedPage.authorEmail && (
                      <span className="text-muted-foreground ml-1">({selectedPage.authorEmail})</span>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('dashboard.admin.pages.detailLabels.visibility')}</span>
                    {visibilityLabels[selectedPage.visibility] || selectedPage.visibility}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('dashboard.admin.pages.detailLabels.moderationStatus')}</span>
                    <Badge variant={moderationStatusConfig[selectedPage.moderationStatus]?.variant || 'default'} className="ml-1">
                      {moderationStatusConfig[selectedPage.moderationStatus]?.label || selectedPage.moderationStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('dashboard.admin.pages.detailLabels.publishedAt')}</span>
                    {formatDateTime(selectedPage.publishedAt)}
                  </div>
                </div>
                {selectedPage.tags && selectedPage.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedPage.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                )}
                {selectedPage.description && (
                  <div>
                    <Label className="text-muted-foreground">{t('dashboard.admin.pages.detailLabels.description')}</Label>
                    <p className="mt-1 text-sm">{selectedPage.description}</p>
                  </div>
                )}
                {selectedPage.coverUrl && (
                  <div>
                    <Label className="text-muted-foreground">{t('dashboard.admin.pages.detailLabels.cover')}</Label>
                    <img
                      src={selectedPage.coverUrl}
                      alt={selectedPage.title}
                      className="mt-1 max-h-48 rounded-lg border object-cover"
                    />
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">{t('dashboard.admin.pages.detailLabels.stats')}</Label>
                  <p className="mt-1 text-sm">
                    {`\u{1F441} ${selectedPage.viewCount} · ❤ ${selectedPage.likeCount} · \u{1F4AC} ${selectedPage.commentCount} · \u{1F516} ${selectedPage.subscriberCount}`}
                  </p>
                </div>
                {selectedPage.html && (
                  <div>
                    <Label className="text-muted-foreground">{t('dashboard.admin.pages.detailLabels.preview')}</Label>
                    <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border p-4 text-sm bg-muted/30">
                      <div className="line-clamp-4 text-muted-foreground">
                        {selectedPage.html.replace(/<[^>]*>/g, '').slice(0, 500)}
                        {(selectedPage.html.replace(/<[^>]*>/g, '').length > 500) && '...'}
                      </div>
                    </div>
                  </div>
                )}
                {selectedPage.updateEvents && selectedPage.updateEvents.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">{t('dashboard.admin.pages.detailLabels.updateHistory')}</Label>
                    <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border divide-y">
                      {selectedPage.updateEvents.map((event, i) => {
                        const eventTypeLabels: Record<string, string> = {
                          published: t('dashboard.admin.pages.eventTypes.published'),
                          updated: t('dashboard.admin.pages.eventTypes.updated'),
                          republished: t('dashboard.admin.pages.eventTypes.republished'),
                          unpublished: t('dashboard.admin.pages.eventTypes.unpublished'),
                        };
                        const importanceVariant = event.importance === 'major' ? 'default' as const : 'secondary' as const;
                        return (
                          <div key={i} className="px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {eventTypeLabels[event.eventType] || event.eventType}
                              </Badge>
                              <Badge variant={importanceVariant} className="shrink-0 text-xs">
                                {event.importance === 'major' ? t('dashboard.admin.pages.eventImportance.major') : t('dashboard.admin.pages.eventImportance.normal')}
                              </Badge>
                              <span className="text-xs text-muted-foreground shrink-0">v{event.version}</span>
                              <span className="text-xs text-muted-foreground ml-auto shrink-0">{formatDateTime(event.createdAt)}</span>
                            </div>
                            {event.title && (
                              <p className="mt-1 font-medium truncate">{event.title}</p>
                            )}
                            {event.changeSummary && (
                              <p className="mt-0.5 text-muted-foreground line-clamp-2">{event.changeSummary}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                {selectedPage.moderationStatus === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => openRejectDialog(selectedPage.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      {t('dashboard.admin.pages.reject')}
                    </Button>
                    <Button
                      onClick={() => handleModerate(selectedPage.id, 'approved')}
                      disabled={actingId === selectedPage.id}
                    >
                      {actingId === selectedPage.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Check className="h-4 w-4 mr-1" />
                      )}
                      {t('dashboard.admin.pages.approve')}
                    </Button>
                  </>
                )}
                {selectedPage.moderationStatus === 'approved' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleModerate(selectedPage.id, 'hidden')}
                      disabled={actingId === selectedPage.id}
                    >
                      <EyeOff className="h-4 w-4 mr-1" />
                      {t('dashboard.admin.pages.hide')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openDeleteDialog(selectedPage.id)}
                      disabled={actingId === selectedPage.id}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t('dashboard.admin.pages.deletePage')}
                    </Button>
                  </>
                )}
                {selectedPage.moderationStatus === 'hidden' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleModerate(selectedPage.id, 'approved')}
                      disabled={actingId === selectedPage.id}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {t('dashboard.admin.pages.unhide')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openDeleteDialog(selectedPage.id)}
                      disabled={actingId === selectedPage.id}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t('dashboard.admin.pages.deletePage')}
                    </Button>
                  </>
                )}
                {selectedPage.moderationStatus === 'rejected' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => handleModerate(selectedPage.id, 'pending')}
                      disabled={actingId === selectedPage.id}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      {t('dashboard.admin.pages.reopen')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openDeleteDialog(selectedPage.id)}
                      disabled={actingId === selectedPage.id}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {t('dashboard.admin.pages.deletePage')}
                    </Button>
                  </>
                )}
                <Button variant="secondary" onClick={() => setDetailOpen(false)}>
                  {t('dashboard.admin.pages.closeDetail')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              {t('dashboard.admin.pages.loadDetailError')}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.pages.rejectTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('dashboard.admin.pages.rejectDescription')}
            </p>
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">{t('dashboard.admin.pages.rejectReasonLabel')}</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t('dashboard.admin.pages.rejectReasonPlaceholder')}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectingPageId) {
                  handleModerate(rejectingPageId, 'rejected', rejectionReason);
                }
              }}
              disabled={actingId === rejectingPageId}
            >
              {actingId === rejectingPageId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              {t('dashboard.admin.pages.confirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('dashboard.admin.pages.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('dashboard.admin.pages.deleteConfirmDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingPageId) {
                  handleDelete(deletingPageId);
                }
              }}
              disabled={actingId === deletingPageId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actingId === deletingPageId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : null}
              {t('dashboard.admin.pages.confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
