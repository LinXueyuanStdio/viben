'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'next/navigation';
import { PackageReviewCard } from './package-review-card';
import { PackageDetailModal } from './package-detail-modal';
import { RejectionModal } from './rejection-modal';
import { Pagination } from '@/components/shared/pagination';
import { BatchActionsBar } from '@/components/admin/batch-actions-bar';
import type { BatchAction } from '@/components/admin/batch-actions-bar';
import { Loader2, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import type { PackageForReview, ListPackagesResult } from '@/lib/admin/packages';
import { cn } from '@/lib/utils';

interface PackageReviewListProps {
  type: 'all' | 'mcp' | 'skill';
  status?: string;
}

export function PackageReviewList({ type, status }: PackageReviewListProps) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();

  const [packages, setPackages] = useState<PackageForReview[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [detailModalId, setDetailModalId] = useState<string | null>(null);
  const [rejectModalPackage, setRejectModalPackage] = useState<PackageForReview | null>(null);

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const currentPage = Number(searchParams.get('page')) || 1;
  const currentSort = searchParams.get('sort') || 'oldest';
  const currentStatus = status || searchParams.get('status') || 'pending';

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: '20',
        sort: currentSort,
        status: currentStatus,
      });

      if (type !== 'all') {
        params.set('type', type);
      }

      const res = await fetch(`/api/admin/packages?${params.toString()}`);

      if (!res.ok) {
        throw new Error('Failed to fetch packages');
      }

      const data: ListPackagesResult = await res.json();
      setPackages(data.packages);
      setPagination(data.pagination);
      // Clear selection on page change
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, [type, currentPage, currentSort, currentStatus]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

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
    setSelectedIds(new Set(packages.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleViewDetails = (id: string) => {
    setDetailModalId(id);
  };

  const handleApproveFromModal = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/packages/${id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('dashboard.admin.packages.list.approveError'));
      }
      toast.success(t('dashboard.admin.packages.list.packageApproved'));
      setDetailModalId(null);
      fetchPackages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('dashboard.admin.packages.list.approveError'));
    }
  };

  const handleRejectFromModal = (id: string) => {
    const pkg = packages.find((p) => p.id === id);
    if (pkg) {
      setDetailModalId(null);
      setRejectModalPackage(pkg);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectModalPackage) return;

    try {
      const res = await fetch(`/api/admin/packages/${rejectModalPackage.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('dashboard.admin.packages.list.rejectError'));
      }
      toast.success(t('dashboard.admin.packages.list.packageRejected'));
      setRejectModalPackage(null);
      fetchPackages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('dashboard.admin.packages.list.rejectError'));
      throw error;
    }
  };

  const handleFeatureFromModal = async (id: string, featured: boolean) => {
    try {
      const res = await fetch(`/api/admin/packages/${id}/feature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('dashboard.admin.packages.list.featureError'));
      }
      toast.success(featured ? t('dashboard.admin.packages.list.packageFeatured') : t('dashboard.admin.packages.list.packageUnfeatured'));
      setDetailModalId(null);
      fetchPackages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('dashboard.admin.packages.list.featureError'));
    }
  };

  // Batch actions
  const batchActions: BatchAction[] = [
    {
      key: 'approve',
      label: '批量审批',
      variant: 'default',
      onAction: async () => {
        setBatchLoading(true);
        try {
          const ids = [...selectedIds];
          const res = await fetch('/api/admin/packages/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve', ids }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Batch approve failed');
          toast.success(`已审批 ${data.affected} 个包`);
          deselectAll();
          fetchPackages();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '批量审批失败');
        } finally {
          setBatchLoading(false);
        }
      },
    },
    {
      key: 'reject',
      label: '批量拒绝',
      variant: 'destructive',
      requireConfirm: true,
      confirmTitle: '批量拒绝包',
      confirmDescription: `确定要拒绝选中的 ${selectedIds.size} 个包吗？此操作不可撤销。`,
      onAction: async () => {
        setBatchLoading(true);
        try {
          const ids = [...selectedIds];
          const res = await fetch('/api/admin/packages/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'reject', ids, reason: '批量拒绝' }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Batch reject failed');
          toast.success(`已拒绝 ${data.affected} 个包`);
          deselectAll();
          fetchPackages();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '批量拒绝失败');
        } finally {
          setBatchLoading(false);
        }
      },
    },
    {
      key: 'delete',
      label: '批量删除',
      variant: 'destructive',
      requireConfirm: true,
      confirmTitle: '批量删除包',
      confirmDescription: `确定要删除选中的 ${selectedIds.size} 个包吗？此操作将永久删除且不可撤销。`,
      onAction: async () => {
        setBatchLoading(true);
        try {
          const ids = [...selectedIds];
          const res = await fetch('/api/admin/packages/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', ids }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Batch delete failed');
          toast.success(`已删除 ${data.affected} 个包`);
          deselectAll();
          fetchPackages();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '批量删除失败');
        } finally {
          setBatchLoading(false);
        }
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-destructive">{error}</p>
        <button
          onClick={fetchPackages}
          className="mt-2 text-sm text-primary hover:underline"
        >
          {t('dashboard.admin.packages.list.tryAgain')}
        </button>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">{t('dashboard.admin.packages.list.noPackages')}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentStatus === 'pending'
            ? t('dashboard.admin.packages.list.noPendingPackages')
            : t('dashboard.admin.packages.list.noStatusPackages', { status: t(`dashboard.admin.packages.status.${currentStatus}`) })}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Batch Actions Bar */}
        <BatchActionsBar
          selectedCount={selectedIds.size}
          totalCount={packages.length}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
          actions={batchActions}
          loading={batchLoading}
        />

        {/* Package Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {packages.map((pkg) => {
            const isSelected = selectedIds.has(pkg.id);
            return (
              <div key={pkg.id} className="relative group">
                {/* Selection checkbox overlay */}
                <div
                  className={cn(
                    'absolute top-2 left-2 z-10 flex items-center justify-center',
                    'w-6 h-6 rounded border-2 transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-primary border-primary'
                      : 'border-muted-foreground/30 bg-background/80 opacity-0 group-hover:opacity-100',
                    selectedIds.size > 0 && !isSelected && 'opacity-70'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(pkg.id);
                  }}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSelect(pkg.id);
                    }
                  }}
                >
                  {isSelected && (
                    <svg
                      className="h-4 w-4 text-primary-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div
                  className={cn(
                    'transition-all duration-200',
                    isSelected && 'ring-2 ring-primary rounded-lg'
                  )}
                >
                  <PackageReviewCard
                    package={pkg}
                    onViewDetails={handleViewDetails}
                    onStatusChange={fetchPackages}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
            />
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <PackageDetailModal
        packageId={detailModalId}
        isOpen={!!detailModalId}
        onClose={() => setDetailModalId(null)}
        onApprove={handleApproveFromModal}
        onReject={handleRejectFromModal}
        onFeature={handleFeatureFromModal}
        onDeleted={() => {
          setDetailModalId(null);
          fetchPackages();
        }}
      />

      {/* Reject Modal (from detail modal) */}
      {rejectModalPackage && (
        <RejectionModal
          packageName={rejectModalPackage.name}
          authorName={rejectModalPackage.author.username}
          isOpen={!!rejectModalPackage}
          onClose={() => setRejectModalPackage(null)}
          onConfirm={handleRejectConfirm}
        />
      )}
    </>
  );
}
