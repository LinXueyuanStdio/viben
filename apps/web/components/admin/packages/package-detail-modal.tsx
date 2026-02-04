'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Heart,
  MessageSquare,
} from 'lucide-react';
import { formatRelativeTime, formatDate } from '@/lib/utils';
import type { PackageDetails } from '@/lib/admin/packages';

interface PackageDetailModalProps {
  packageId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onFeature?: (id: string, featured: boolean) => void;
}

export function PackageDetailModal({
  packageId,
  isOpen,
  onClose,
  onApprove,
  onReject,
  onFeature,
}: PackageDetailModalProps) {
  const [pkg, setPkg] = useState<PackageDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && packageId) {
      fetchPackageDetails(packageId);
    } else {
      setPkg(null);
      setError(null);
    }
  }, [isOpen, packageId]);

  async function fetchPackageDetails(id: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/packages/${id}`);
      if (!res.ok) {
        throw new Error('Failed to fetch package details');
      }
      const data = await res.json();
      setPkg(data.package);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load package');
    } finally {
      setLoading(false);
    }
  }

  const handleClose = () => {
    onClose();
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
                      {pkg.type === 'mcp' ? 'MCP' : 'Skill'}
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
                  {pkg.downloadsCount.toLocaleString()} downloads
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Heart className="h-4 w-4" />
                  {pkg.favoritesCount.toLocaleString()} favorites
                </span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  {pkg.commentsCount.toLocaleString()} comments
                </span>
              </div>

              <Separator />

              {/* Description */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Description</h4>
                <p className="text-sm text-muted-foreground">
                  {pkg.description || 'No description provided'}
                </p>
              </div>

              {/* Long Description / README */}
              {pkg.longDescription && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">README</h4>
                  <div className="rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
                    {pkg.longDescription}
                  </div>
                </div>
              )}

              {/* Tags */}
              {pkg.tags.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Tags</h4>
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
                  <h4 className="text-sm font-medium">MCP Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Transport:</span>{' '}
                      <span className="font-mono">{pkg.transport}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entry Point:</span>{' '}
                      <span className="font-mono">{pkg.entryPoint}</span>
                    </div>
                  </div>
                </div>
              )}

              {pkg.type === 'skill' && pkg.skillType && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Skill Details</h4>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Type:</span>{' '}
                    <span className="font-mono">{pkg.skillType}</span>
                  </div>
                  {pkg.triggerPatterns && pkg.triggerPatterns.length > 0 && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Triggers:</span>
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
                  <h4 className="text-sm font-medium">Review History</h4>
                  <div className="space-y-3">
                    {pkg.reviewHistory.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">
                              {entry.action}
                            </span>
                            <span className="text-muted-foreground">
                              by {entry.adminName}
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

              <Separator />

              {/* Actions */}
              <div className="flex justify-end gap-2">
                {pkg.status === 'pending' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => onReject?.(pkg.id)}
                    >
                      Reject
                    </Button>
                    <Button onClick={() => onApprove?.(pkg.id)}>Approve</Button>
                  </>
                )}
                {pkg.status === 'approved' && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => onReject?.(pkg.id)}
                    >
                      Revoke
                    </Button>
                    <Button onClick={() => onFeature?.(pkg.id, true)}>
                      Feature
                    </Button>
                  </>
                )}
                {pkg.status === 'featured' && (
                  <Button
                    variant="outline"
                    onClick={() => onFeature?.(pkg.id, false)}
                  >
                    Unfeature
                  </Button>
                )}
                {pkg.status === 'rejected' && (
                  <Button onClick={() => onApprove?.(pkg.id)}>
                    Reopen & Approve
                  </Button>
                )}
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
