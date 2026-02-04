'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { PackageReviewCard } from './package-review-card';
import { PackageDetailModal } from './package-detail-modal';
import { RejectionModal } from './rejection-modal';
import { Pagination } from '@/components/shared/pagination';
import { Loader2, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import type { PackageForReview, ListPackagesResult } from '@/lib/admin/packages';

interface PackageReviewListProps {
  type: 'all' | 'mcp' | 'skill';
  status?: string;
}

export function PackageReviewList({ type, status }: PackageReviewListProps) {
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load packages');
    } finally {
      setLoading(false);
    }
  }, [type, currentPage, currentSort, currentStatus]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

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
        throw new Error(data.error || 'Failed to approve package');
      }
      toast.success('Package approved');
      setDetailModalId(null);
      fetchPackages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve package');
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
        throw new Error(data.error || 'Failed to reject package');
      }
      toast.success('Package rejected');
      setRejectModalPackage(null);
      fetchPackages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject package');
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
        throw new Error(data.error || 'Failed to update feature status');
      }
      toast.success(featured ? 'Package featured' : 'Package unfeatured');
      setDetailModalId(null);
      fetchPackages();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update feature status');
    }
  };

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
          Try again
        </button>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium">No packages found</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentStatus === 'pending'
            ? 'No packages are waiting for review'
            : `No ${currentStatus} packages`}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Package Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {packages.map((pkg) => (
            <PackageReviewCard
              key={pkg.id}
              package={pkg}
              onViewDetails={handleViewDetails}
              onStatusChange={fetchPackages}
            />
          ))}
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
