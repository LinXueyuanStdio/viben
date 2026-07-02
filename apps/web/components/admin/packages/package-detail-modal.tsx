'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ModerationBadge } from './moderation-badge';
import {
  Loader2,
  Package,
  Sparkles,
  User,
  Calendar,
  Download,
  Bookmark,
  MessageSquare,
  History,
  FileDigit,
  ShieldCheck,
  Link,
  Trash2,
} from 'lucide-react';
import { formatRelativeTime, formatDate } from '@/lib/utils';
import type { PackageDetails } from '@/lib/admin/packages';

interface ReleaseEntry {
  id: string;
  version: string;
  releaseNotes: string | null;
  downloadUrl: string | null;
  checksum: string | null;
  fileSize: number | null;
  createdAt: string;
}

interface PackageDetailModalProps {
  packageId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onFeature?: (id: string, featured: boolean) => void;
  onDeleted?: () => void;
}

export function PackageDetailModal({
  packageId,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onFeature,
  onDeleted,
}: PackageDetailModalProps) {
  const { t } = useTranslation();
  const [pkg, setPkg] = useState<PackageDetails | null>(null);
  const [releases, setReleases] = useState<ReleaseEntry[]>([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const fetchReleases = useCallback(async (entityType: string, entityId: string) => {
    setReleasesLoading(true);
    try {
      const res = await fetch(
        `/api/admin/packages/releases?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
      );
      if (!res.ok) {
        throw new Error('Failed to fetch releases');
      }
      const data = await res.json();
      setReleases(data.releases || []);
    } catch {
      setReleases([]);
    } finally {
      setReleasesLoading(false);
    }
  }, []);

  const fetchPackageDetails = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/packages/${id}`);
      if (!res.ok) {
        throw new Error(t('dashboard.admin.packages.detail.fetchError'));
      }
      const data = await res.json();
      const pkgData = data.package as PackageDetails;
      setPkg(pkgData);
      // Fetch releases after getting package details
      fetchReleases(pkgData.type, pkgData.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.packages.detail.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, fetchReleases]);

  useEffect(() => {
    if (isOpen && packageId) {
      fetchPackageDetails(packageId);
    } else {
      setPkg(null);
      setReleases([]);
      setError(null);
    }
  }, [isOpen, packageId, fetchPackageDetails]);

  const handleClose = () => {
    onClose();
  };

  const handleDelete = async () => {
    if (!pkg) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/packages/${pkg.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('dashboard.admin.packages.detail.deleteError'));
      }
      setShowDeleteDialog(false);
      toast.success(t('dashboard.admin.packages.detail.deleteSuccess', { name: pkg.name }));
      onDeleted?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('dashboard.admin.packages.detail.deleteError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const TypeIcon = pkg?.type === 'mcp' ? Package : Sparkles;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {pkg && (
              <>
                <TypeIcon className="h-5 w-5" />
                {pkg.name}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-destructive">{error}</div>
        )}

        {pkg && !loading && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Header Info */}
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {pkg.type === 'mcp' ? 'MCP' : t('dashboard.admin.packages.detail.skill')}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      v{pkg.version}
                    </span>
                    <ModerationBadge status={pkg.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />@{pkg.author.username}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(pkg.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Download className="h-4 w-4" />
                  {t('dashboard.admin.packages.detail.downloads', { count: pkg.downloadsCount })}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Bookmark className="h-4 w-4" />
                  {t('dashboard.admin.packages.detail.favorites', { count: pkg.bookmarksCount })}
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  {t('dashboard.admin.packages.detail.comments', { count: pkg.commentsCount })}
                </span>
              </div>

              <Separator />

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">{t('dashboard.admin.packages.detail.description')}</h4>
                <p className="text-sm text-muted-foreground">
                  {pkg.description || t('dashboard.admin.packages.detail.noDescription')}
                </p>
              </div>

              {/* Long Description / README */}
              {pkg.longDescription && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t('dashboard.admin.packages.detail.readme')}</h4>
                  <div className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
                    {pkg.longDescription}
                  </div>
                </div>
              )}

              {/* Tags */}
              {pkg.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t('dashboard.admin.packages.detail.tags')}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Type-specific Info */}
              {pkg.type === 'mcp' && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t('dashboard.admin.packages.detail.mcpDetails')}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">{t('dashboard.admin.packages.detail.transport')}:</span>{' '}
                      <span className="font-mono">{pkg.transport}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">{t('dashboard.admin.packages.detail.entryPoint')}:</span>{' '}
                      <span className="font-mono">{pkg.entryPoint}</span>
                    </div>
                  </div>
                </div>
              )}

              {pkg.type === 'skill' && pkg.skillType && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t('dashboard.admin.packages.detail.skillDetails')}</h4>
                  <div className="text-sm">
                    <span className="text-muted-foreground">{t('dashboard.admin.packages.detail.type')}:</span>{' '}
                    <span className="font-mono">{pkg.skillType}</span>
                  </div>
                  {pkg.triggerPatterns && pkg.triggerPatterns.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">{t('dashboard.admin.packages.detail.triggers')}:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {pkg.triggerPatterns.map((pattern, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            {pattern}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Review History */}
              {pkg.reviewHistory.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">{t('dashboard.admin.packages.detail.reviewHistory')}</h4>
                  <div className="space-y-3">
                    {pkg.reviewHistory.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">
                              {t(`dashboard.admin.actions.${entry.action}`, { defaultValue: entry.action })}
                            </span>
                            <span className="text-muted-foreground">
                              {t('dashboard.admin.packages.detail.byAdmin', { name: entry.adminName })}
                            </span>
                            <span className="text-muted-foreground">
                              {formatRelativeTime(entry.createdAt)}
                            </span>
                          </div>
                          {entry.reason && (
                            <p className="mt-1 text-muted-foreground">
                              {entry.reason}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Release History */}
              {releases.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    {t('dashboard.admin.packages.detail.releaseHistory', { defaultValue: '版本历史' })}
                  </h4>
                  <div className="space-y-3">
                    {releases.map((release, i) => (
                      <div
                        key={release.id}
                        className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3"
                      >
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              v{release.version}
                            </Badge>
                            <span className="text-muted-foreground">
                              {formatDate(release.createdAt)}
                            </span>
                          </div>
                          {release.releaseNotes && (
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {release.releaseNotes}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                            {release.fileSize != null && (
                              <span className="flex items-center gap-1 text-xs">
                                <FileDigit className="h-3 w-3" />
                                {release.fileSize >= 1048576
                                  ? `${(release.fileSize / 1048576).toFixed(1)} MB`
                                  : `${(release.fileSize / 1024).toFixed(1)} KB`}
                              </span>
                            )}
                            {release.checksum && (
                              <span className="flex items-center gap-1 text-xs font-mono">
                                <ShieldCheck className="h-3 w-3" />
                                {release.checksum.slice(0, 12)}...
                              </span>
                            )}
                            {release.downloadUrl && (
                              <a
                                href={release.downloadUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-primary hover:underline"
                              >
                                <Link className="h-3 w-3" />
                                {t('dashboard.admin.packages.detail.download', { defaultValue: '下载' })}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {releasesLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isDeleting}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {t('dashboard.admin.actions.delete')}
                </Button>
                <div className="flex gap-2">
                  {pkg.status === 'pending' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => onReject?.(pkg.id)}
                      >
                        {t('dashboard.admin.actions.reject')}
                      </Button>
                      <Button onClick={() => onApprove?.(pkg.id)}>{t('dashboard.admin.actions.approve')}</Button>
                    </>
                  )}
                  {pkg.status === 'approved' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => onReject?.(pkg.id)}
                      >
                        {t('dashboard.admin.packages.detail.revoke')}
                      </Button>
                      <Button onClick={() => onFeature?.(pkg.id, true)}>
                        {t('dashboard.admin.actions.feature')}
                      </Button>
                    </>
                  )}
                  {pkg.status === 'featured' && (
                    <Button
                      variant="outline"
                      onClick={() => onFeature?.(pkg.id, false)}
                    >
                      {t('dashboard.admin.actions.unfeature')}
                    </Button>
                  )}
                  {pkg.status === 'rejected' && (
                    <Button onClick={() => onApprove?.(pkg.id)}>
                      {t('dashboard.admin.packages.detail.reopenApprove')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('dashboard.admin.packages.detail.deleteConfirm')}</DialogTitle>
              <DialogDescription>
                {t('dashboard.admin.packages.detail.deleteConfirmDesc', { name: pkg?.name ?? '' })}
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
      </DialogContent>
    </Dialog>
  );
}
