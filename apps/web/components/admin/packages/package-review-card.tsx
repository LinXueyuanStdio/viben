'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ModerationBadge } from './moderation-badge';
import { RejectionModal } from './rejection-modal';
import {
  Package,
  Sparkles,
  ChevronDown,
  Check,
  X,
  Star,
  Eye,
  Trash2,
  Loader2,
} from 'lucide-react';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PackageForReview } from '@/lib/admin/packages';
import type { PackageStatus } from '@/lib/types/admin';

interface PackageReviewCardProps {
  package: PackageForReview;
  onViewDetails: (id: string) => void;
  onStatusChange?: () => void;
}

export function PackageReviewCard({
  package: pkg,
  onViewDetails,
  onStatusChange,
}: PackageReviewCardProps) {
  const { t } = useTranslation();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isFeaturing, setIsFeaturing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<PackageStatus>(pkg.status);

  const TypeIcon = pkg.type === 'mcp' ? Package : Sparkles;
  const typeLabel = pkg.type === 'mcp' ? 'MCP' : t('dashboard.admin.packages.card.skill');
  const typeColor =
    pkg.type === 'mcp'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/admin/packages/${pkg.id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('dashboard.admin.packages.card.approveError'));
      }
      setCurrentStatus('approved');
      toast.success(t('dashboard.admin.packages.card.approveSuccess', { name: pkg.name }));
      onStatusChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('dashboard.admin.packages.card.approveError'));
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (reason: string) => {
    setIsRejecting(true);
    try {
      const res = await fetch(`/api/admin/packages/${pkg.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('dashboard.admin.packages.card.rejectError'));
      }
      setCurrentStatus('rejected');
      toast.success(t('dashboard.admin.packages.card.rejectSuccess', { name: pkg.name }));
      onStatusChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('dashboard.admin.packages.card.rejectError'));
      throw error; // Re-throw so modal knows it failed
    } finally {
      setIsRejecting(false);
    }
  };

  const handleFeature = async (featured: boolean) => {
    setIsFeaturing(true);
    try {
      const res = await fetch(`/api/admin/packages/${pkg.id}/feature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('dashboard.admin.packages.card.featureError'));
      }
      setCurrentStatus(featured ? 'featured' : 'approved');
      toast.success(
        featured
          ? t('dashboard.admin.packages.card.featureSuccess', { name: pkg.name })
          : t('dashboard.admin.packages.card.unfeatureSuccess', { name: pkg.name })
      );
      onStatusChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('dashboard.admin.packages.card.featureError'));
    } finally {
      setIsFeaturing(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/packages/${pkg.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('dashboard.admin.packages.card.deleteError'));
      }
      setShowDeleteDialog(false);
      toast.success(t('dashboard.admin.packages.card.deleteSuccess', { name: pkg.name }));
      onStatusChange?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('dashboard.admin.packages.card.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const isLoading = isApproving || isRejecting || isFeaturing || isDeleting;

  return (
    <>
      <Card className="transition-all hover:shadow-md">
        <CardContent className="pt-6">
          {/* Header Row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={cn('border-transparent', typeColor)}
              >
                <TypeIcon className="mr-1 h-3 w-3" />
                {typeLabel}
              </Badge>
              <ModerationBadge status={currentStatus} />
            </div>
            <time className="text-xs text-muted-foreground">
              {t('dashboard.admin.packages.card.submitted', { time: formatRelativeTime(pkg.createdAt) })}
            </time>
          </div>

          {/* Package Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">{pkg.name}</h3>
              <span className="text-xs text-muted-foreground">v{pkg.version}</span>
            </div>

            <div className="flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={pkg.author.avatarUrl || undefined} />
                <AvatarFallback className="text-[10px]">
                  {pkg.author.username[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-muted-foreground">
                {t('dashboard.admin.packages.card.byAuthor', { author: pkg.author.username })}
              </span>
            </div>

            <p className="text-sm text-muted-foreground line-clamp-2">
              {pkg.description || t('dashboard.admin.packages.card.noDescription')}
            </p>

            {/* Tags */}
            {pkg.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {pkg.tags.slice(0, 4).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {tag}
                  </Badge>
                ))}
                {pkg.tags.length > 4 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0"
                  >
                    +{pkg.tags.length - 4}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="border-t pt-4 flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(pkg.id)}
            >
              <Eye className="mr-1.5 h-4 w-4" />
              {t('dashboard.admin.packages.card.viewDetails')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isLoading}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {t('dashboard.admin.actions.delete')}
            </Button>
          </div>

          <div className="flex gap-2">
            {/* Pending: Approve + Reject */}
            {currentStatus === 'pending' && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isLoading}
                    >
                      {isRejecting ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <X className="mr-1.5 h-4 w-4" />
                      )}
                      {t('dashboard.admin.actions.reject')}
                      <ChevronDown className="ml-1 h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setShowRejectModal(true)}>
                      {t('dashboard.admin.packages.card.rejectWithReason')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={isLoading}
                >
                  {isApproving ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-1.5 h-4 w-4" />
                  )}
                  {t('dashboard.admin.actions.approve')}
                </Button>
              </>
            )}

            {/* Approved: Feature + Revoke */}
            {currentStatus === 'approved' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRejectModal(true)}
                  disabled={isLoading}
                >
                  <X className="mr-1.5 h-4 w-4" />
                  {t('dashboard.admin.packages.card.revoke')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleFeature(true)}
                  disabled={isLoading}
                >
                  {isFeaturing ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Star className="mr-1.5 h-4 w-4" />
                  )}
                  {t('dashboard.admin.actions.feature')}
                </Button>
              </>
            )}

            {/* Featured: Unfeature */}
            {currentStatus === 'featured' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFeature(false)}
                disabled={isLoading}
              >
                {isFeaturing ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Star className="mr-1.5 h-4 w-4 fill-current" />
                )}
                {t('dashboard.admin.actions.unfeature')}
              </Button>
            )}

            {/* Rejected: Reopen */}
            {currentStatus === 'rejected' && (
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isLoading}
              >
                {isApproving ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-1.5 h-4 w-4" />
                )}
                {t('dashboard.admin.packages.card.reopen')}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      <RejectionModal
        packageName={pkg.name}
        authorName={pkg.author.username}
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={handleReject}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard.admin.packages.card.deleteConfirm')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.admin.packages.card.deleteConfirmDesc', { name: pkg.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  {t('dashboard.admin.actions.delete')}
                </>
              ) : (
                t('dashboard.admin.actions.delete')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
