'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ArrowLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/shared/pagination';

interface RankingSnapshot {
  id: string;
  rankingKey: string;
  entityType: string;
  timeWindow: string;
  scopeType: string;
  scopeId: string | null;
  algorithmVersion: string;
  status: 'building' | 'ready' | 'failed' | 'expired';
  generatedAt: string | null;
  validFrom: string;
  validUntil: string | null;
  sourceFrom: string | null;
  sourceUntil: string | null;
  itemCount: number;
  createdAt: string;
}

interface RankingItem {
  id: string;
  rank: number;
  entityType: string;
  entityId: string;
  score: number;
  rawScore: number;
  reason: string;
  title: string;
  description: string | null;
  userId: string | null;
  userSlug: string | null;
  authorName: string | null;
  authorAvatarUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  delta: string | null;
  scoreLabel: string | null;
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

const ENTITY_TYPE_LABELS: Record<string, string> = {
  published_page: 'Published Page',
  mcp_package: 'MCP Package',
  skill_package: 'Skill Package',
};

const TIME_WINDOW_LABELS: Record<string, string> = {
  '1d': '1 天',
  '7d': '7 天',
  '30d': '30 天',
  all: '全部',
};

export function RankingManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    building: { label: t('dashboard.admin.rankings.buildStatus.building'), variant: 'secondary' },
    ready: { label: t('dashboard.admin.rankings.buildStatus.ready'), variant: 'default' },
    failed: { label: t('dashboard.admin.rankings.buildStatus.failed'), variant: 'destructive' },
    expired: { label: t('dashboard.admin.rankings.buildStatus.expired'), variant: 'outline' },
  };

  const currentStatus = searchParams.get('status') || 'all';
  const currentPage = Number(searchParams.get('page')) || 1;

  const [snapshots, setSnapshots] = useState<RankingSnapshot[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<RankingSnapshot | null>(null);

  // Rebuild dialog state
  const [showRebuildDialog, setShowRebuildDialog] = useState(false);
  const [rebuildEntityType, setRebuildEntityType] = useState('published_page');
  const [rebuildTimeWindow, setRebuildTimeWindow] = useState('7d');

  // Detail view state
  const [selectedSnapshot, setSelectedSnapshot] = useState<RankingSnapshot | null>(null);
  const [items, setItems] = useState<RankingItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: currentStatus,
        page: String(currentPage),
        limit: '20',
      });
      const res = await fetch(`/api/admin/rankings?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch rankings');
      const data = await res.json();
      setSnapshots(data.snapshots);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.rankings.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentStatus, currentPage, t]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const fetchItems = async (snapshot: RankingSnapshot) => {
    setSelectedSnapshot(snapshot);
    setItemsLoading(true);
    try {
      const res = await fetch(`/api/admin/rankings/${snapshot.id}`);
      if (!res.ok) throw new Error('Failed to fetch ranking items');
      const data = await res.json();
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.rankings.loadError'));
    } finally {
      setItemsLoading(false);
    }
  };

  const updateStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status !== 'all') params.set('status', status);
    else params.delete('status');
    params.delete('page');
    router.push(`/admin/rankings?${params.toString()}`);
  };

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const res = await fetch('/api/admin/rankings/rebuild', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType: rebuildEntityType, timeWindow: rebuildTimeWindow }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to trigger rebuild');
      }
      const data = await res.json();
      toast.success(data.message || t('dashboard.admin.rankings.rebuildSuccess'));
      setShowRebuildDialog(false);
      fetchSnapshots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dashboard.admin.rankings.rebuildError'));
    } finally {
      setRebuilding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/rankings/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete snapshot');
      }
      toast.success(t('dashboard.admin.rankings.deleteSuccess'));
      if (selectedSnapshot?.id === deleteTarget.id) {
        setSelectedSnapshot(null);
        setItems([]);
      }
      fetchSnapshots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('dashboard.admin.rankings.deleteError'));
    } finally {
      setDeleteTarget(null);
      setDeleting(false);
    }
  };

  // Detail view
  if (selectedSnapshot) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedSnapshot(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('dashboard.admin.rankings.backToList')}
          </Button>
          <div className="flex-1">
            <h1 className="font-serif text-2xl font-bold">
              {t('dashboard.admin.rankings.detailTitle')} &mdash; {selectedSnapshot.rankingKey}
            </h1>
            <p className="text-muted-foreground">
              {t('dashboard.admin.rankings.timeWindow')}: {selectedSnapshot.timeWindow} &middot; {t('dashboard.admin.rankings.itemCount')}: {selectedSnapshot.itemCount} &middot;{' '}
              {t('dashboard.admin.rankings.generatedAt')}: {formatDateTime(selectedSnapshot.generatedAt)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteTarget(selectedSnapshot)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t('dashboard.admin.rankings.delete')}
          </Button>
        </div>

        {itemsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg text-muted-foreground">{t('dashboard.admin.rankings.noItems')}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium w-16">{t('dashboard.admin.rankings.detailColumns.rank')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.detailColumns.title')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.detailColumns.type')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.detailColumns.author')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.detailColumns.score')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.detailColumns.data')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.detailColumns.delta')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        item.rank <= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {item.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium max-w-[300px] truncate">
                      {item.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.entityType}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.authorName || item.userSlug || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono">
                      {item.score.toFixed(1)}
                      {item.scoreLabel && (
                        <span className="text-xs text-muted-foreground ml-1">
                          {item.scoreLabel}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <span title={`${item.viewCount ?? 0} views · ${item.likeCount ?? 0} likes · ${item.commentCount ?? 0} comments`}>
                        👁 {item.viewCount ?? 0} · ❤ {item.likeCount ?? 0} · 💬 {item.commentCount ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.delta ? (
                        <Badge variant={item.delta.startsWith('up') ? 'default' : 'secondary'}>
                          {item.delta}
                        </Badge>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('dashboard.admin.rankings.deleteConfirm')}</DialogTitle>
              <DialogDescription>
                {t('dashboard.admin.rankings.deleteConfirmDesc')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {t('common.cancel')}
              </Button>
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

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">{t('dashboard.admin.rankings.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.admin.rankings.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {(['all', 'ready', 'building', 'failed', 'expired'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateStatusFilter(s)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentStatus === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {s === 'all' ? t('dashboard.admin.rankings.filterAll') : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
          <Button onClick={() => setShowRebuildDialog(true)}>
            <RefreshCw className="h-4 w-4 mr-1" />
            {t('dashboard.admin.rankings.rebuild')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button onClick={fetchSnapshots} className="mt-2 text-sm text-primary hover:underline">
            {t('dashboard.admin.rankings.retry')}
          </button>
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">{t('dashboard.admin.rankings.emptyTitle')}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.columns.key')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.columns.entity')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.columns.window')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.columns.scope')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.columns.status')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.columns.items')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.columns.generated')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">{t('dashboard.admin.rankings.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((snap) => {
                  const statusConf = STATUS_CONFIG[snap.status] || STATUS_CONFIG.building;
                  return (
                    <tr key={snap.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-sm font-medium">{snap.rankingKey}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{snap.entityType}</td>
                      <td className="px-4 py-3 text-sm">{snap.timeWindow}</td>
                      <td className="px-4 py-3 text-sm">{snap.scopeType}</td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">{snap.itemCount}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(snap.generatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchItems(snap)}
                            disabled={snap.status === 'building'}
                          >
                            {t('dashboard.admin.rankings.viewItems')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(snap)}
                            title={t('dashboard.admin.rankings.delete')}
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

          {pagination.totalPages > 1 && <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} />}
        </>
      )}

      <p className="text-sm text-muted-foreground">
        {t('dashboard.admin.rankings.showingSnapshots', { count: snapshots.length, total: pagination.total, page: pagination.page, totalPages: pagination.totalPages })}
      </p>

      {/* Rebuild configuration dialog */}
      <Dialog open={showRebuildDialog} onOpenChange={setShowRebuildDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.rankings.rebuildConfig')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.admin.rankings.rebuildConfigDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('dashboard.admin.rankings.entityType')}
              </label>
              <Select value={rebuildEntityType} onValueChange={setRebuildEntityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="published_page">{ENTITY_TYPE_LABELS.published_page}</SelectItem>
                  <SelectItem value="mcp_package">{ENTITY_TYPE_LABELS.mcp_package}</SelectItem>
                  <SelectItem value="skill_package">{ENTITY_TYPE_LABELS.skill_package}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('dashboard.admin.rankings.timeWindow')}
              </label>
              <Select value={rebuildTimeWindow} onValueChange={setRebuildTimeWindow}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">{TIME_WINDOW_LABELS['1d']}</SelectItem>
                  <SelectItem value="7d">{TIME_WINDOW_LABELS['7d']}</SelectItem>
                  <SelectItem value="30d">{TIME_WINDOW_LABELS['30d']}</SelectItem>
                  <SelectItem value="all">{TIME_WINDOW_LABELS.all}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRebuildDialog(false)} disabled={rebuilding}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleRebuild} disabled={rebuilding}>
              {rebuilding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {rebuilding ? t('dashboard.admin.rankings.rebuilding') : t('dashboard.admin.rankings.rebuild')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.rankings.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.admin.rankings.deleteConfirmDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t('common.cancel')}
            </Button>
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
