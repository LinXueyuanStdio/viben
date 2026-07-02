'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { formatRelativeTime } from '@/lib/utils';
import { BatchActionsBar } from '@/components/admin/batch-actions-bar';
import type { BatchAction } from '@/components/admin/batch-actions-bar';
import { cn } from '@/lib/utils';

interface Report {
  id: string;
  entityType: string;
  entityId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  reporterId: string;
  reporterName: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_CONFIG: Record<
  string,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { variant: 'default' },
  resolved: { variant: 'secondary' },
  dismissed: { variant: 'outline' },
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  pending: 'dashboard.adminReports.statusPending',
  resolved: 'dashboard.adminReports.statusResolved',
  dismissed: 'dashboard.adminReports.statusDismissed',
};

/**
 * Map entity type to admin page URL for "View Content" link.
 */
function getEntityViewUrl(entityType: string, entityId: string): string | null {
  switch (entityType) {
    case 'mcp':
    case 'skill':
      return `/published/${entityId}`;
    case 'comment':
      return `/admin/comments`;
    case 'collection':
      return `/collections/${entityId}`;
    case 'user':
      return `/profile/${entityId}`;
    case 'published_page':
      return `/published/${entityId}`;
    default:
      return null;
  }
}

export function ReportManagement() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [reports, setReports] = useState<Report[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const currentStatus = searchParams.get('status') || 'pending';
  const currentPage = Number(searchParams.get('page')) || 1;

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        status: currentStatus,
      });

      const res = await fetch(`/api/admin/reports?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch reports');
      }

      const data = await res.json();
      setReports(data.reports);
      setPagination(data.pagination);
      setSelectedIds(new Set());
    } catch {
      setError(t('dashboard.adminReports.loadError'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, currentStatus, t]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const updateStatusFilter = (status: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === 'pending') {
      params.delete('status');
    } else {
      params.set('status', status);
    }
    params.delete('page');
    router.push(`/admin/reports?${params.toString()}`);
  };

  const handleAction = async (id: string, action: 'resolve' | 'dismiss') => {
    setActingId(id);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} report`);
      }

      const successKeyMap: Record<string, string> = {
        resolve: 'resolveSuccess',
        dismiss: 'dismissSuccess',
      };
      toast.success(t(`dashboard.adminReports.${successKeyMap[action]}`));

      fetchReports();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${action} report`);
    } finally {
      setActingId(null);
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
    setSelectedIds(new Set(reports.map((r) => r.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // Batch actions
  const batchActions: BatchAction[] = [
    {
      key: 'resolve',
      label: '批量标记已解决',
      variant: 'default',
      requireConfirm: true,
      confirmTitle: '批量标记已解决',
      confirmDescription: `确定要将选中的 ${selectedIds.size} 个举报标记为已解决吗？`,
      onAction: async () => {
        setBatchLoading(true);
        try {
          const ids = [...selectedIds];
          const res = await fetch('/api/admin/reports/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'resolve', ids }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Batch resolve failed');
          toast.success(`已标记 ${data.affected} 个举报为已解决`);
          deselectAll();
          fetchReports();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '批量操作失败');
        } finally {
          setBatchLoading(false);
        }
      },
    },
    {
      key: 'dismiss',
      label: '批量忽略',
      variant: 'ghost',
      requireConfirm: true,
      confirmTitle: '批量忽略举报',
      confirmDescription: `确定要忽略选中的 ${selectedIds.size} 个举报吗？`,
      onAction: async () => {
        setBatchLoading(true);
        try {
          const ids = [...selectedIds];
          const res = await fetch('/api/admin/reports/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'dismiss', ids }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Batch dismiss failed');
          toast.success(`已忽略 ${data.affected} 个举报`);
          deselectAll();
          fetchReports();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '批量操作失败');
        } finally {
          setBatchLoading(false);
        }
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold">
            {t('dashboard.adminReports.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('dashboard.adminReports.subtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          {(['pending', 'resolved', 'dismissed', 'all'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => updateStatusFilter(status)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                currentStatus === status || (status === 'pending' && !searchParams.get('status'))
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {status === 'all'
                ? t('dashboard.adminReports.statusAll')
                : t(STATUS_LABEL_KEYS[status])}
            </button>
          ))}
        </div>
      </div>

      {/* Batch Actions Bar */}
      <BatchActionsBar
        selectedCount={selectedIds.size}
        totalCount={reports.length}
        onSelectAll={selectAll}
        onDeselectAll={deselectAll}
        actions={batchActions}
        loading={batchLoading}
      />

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">{error}</p>
          <button
            type="button"
            onClick={fetchReports}
            className="mt-2 text-sm text-primary hover:underline"
          >
            {t('dashboard.adminReports.retry')}
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg text-muted-foreground">
            {t('dashboard.adminReports.empty')}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {currentStatus === 'pending'
              ? t('dashboard.adminReports.emptyPending')
              : t('dashboard.adminReports.emptyFilter')}
          </p>
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
                    checked={selectedIds.size === reports.length && reports.length > 0}
                    onChange={() => {
                      if (selectedIds.size === reports.length) {
                        deselectAll();
                      } else {
                        selectAll();
                      }
                    }}
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  {t('dashboard.adminReports.reporter')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  {t('dashboard.adminReports.entityType')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  {t('dashboard.adminReports.entityId')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  {t('dashboard.adminReports.reason')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  {t('dashboard.adminReports.description')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  {t('dashboard.adminReports.status')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  {t('dashboard.adminReports.time')}
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium">
                  {t('dashboard.adminReports.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => {
                const statusConf = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;
                const statusLabel = t(
                  STATUS_LABEL_KEYS[report.status] || STATUS_LABEL_KEYS.pending
                );
                const entityViewUrl = getEntityViewUrl(report.entityType, report.entityId);
                const isSelected = selectedIds.has(report.id);

                return (
                  <tr
                    key={report.id}
                    className={cn(
                      'border-b last:border-0 hover:bg-muted/30',
                      isSelected && 'bg-primary/5'
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-muted-foreground/30 cursor-pointer accent-primary"
                        checked={isSelected}
                        onChange={() => toggleSelect(report.id)}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {report.reporterName || t('dashboard.adminReports.unknownReporter')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {t(`dashboard.admin.entityTypes.${report.entityType}`)}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-xs max-w-[120px] truncate">
                      {report.entityId.slice(0, 12)}...
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {t(`dashboard.adminReports.reasons.${report.reason}`)}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-[200px] truncate">
                      {report.description || t('dashboard.adminReports.noDescription')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Badge variant={statusConf.variant}>{statusLabel}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(report.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {entityViewUrl && (
                          <Link
                            href={entityViewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t('dashboard.adminReports.viewEntity')}
                          >
                            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                          </Link>
                        )}
                        {report.status === 'pending' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAction(report.id, 'resolve')}
                              disabled={actingId === report.id}
                            >
                              {actingId === report.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                t('dashboard.adminReports.resolve')
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAction(report.id, 'dismiss')}
                              disabled={actingId === report.id}
                            >
                              {t('dashboard.adminReports.dismiss')}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set('page', String(page));
            return (
              <button
                key={page}
                type="button"
                onClick={() => router.push(`/admin/reports?${params.toString()}`)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  page === currentPage
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <p className="text-sm text-muted-foreground">
        {t('dashboard.adminReports.showing', {
          count: reports.length,
          total: pagination.total,
        })}
      </p>
    </div>
  );
}
