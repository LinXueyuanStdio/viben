'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Star, User, FileText, Calendar, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/utils';

interface FeedbackDetail {
  id: string;
  pageId: string;
  category: string;
  rating: number;
  content: string;
  createdAt: string;
  reporterId: string;
  reporterName: string | null;
  reporterDisplayName: string | null;
}

interface FeedbackDetailResponse {
  feedback: FeedbackDetail;
}

const CATEGORY_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  bug: { label: 'bug', variant: 'destructive' },
  suggestion: { label: 'suggestion', variant: 'default' },
  other: { label: 'other', variant: 'secondary' },
};

function renderStars(rating: number) {
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </span>
  );
}

interface FeedbackDetailDialogProps {
  feedbackId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackDetailDialog({ feedbackId, isOpen, onClose }: FeedbackDetailDialogProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<FeedbackDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFeedbackDetail = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/feedbacks/${id}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || t('dashboard.admin.feedbacks.loadError'));
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('dashboard.admin.feedbacks.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen && feedbackId) {
      fetchFeedbackDetail(feedbackId);
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, feedbackId, fetchFeedbackDetail]);

  const handleClose = () => {
    onClose();
  };

  const feedback = data?.feedback;
  const catConf = feedback ? (CATEGORY_CONFIG[feedback.category] || CATEGORY_CONFIG.other) : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{t('dashboard.admin.feedbacks.detailTitle')}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-destructive">{error}</div>
        )}

        {data && feedback && !loading && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4 pr-4">
              {/* Category and Rating */}
              <div className="flex items-center justify-between">
                {catConf && (
                  <Badge variant={catConf.variant}>
                    {t(`dashboard.admin.feedbacks.categories.${feedback.category}`)}
                  </Badge>
                )}
                {renderStars(feedback.rating)}
              </div>

              {/* Content */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="whitespace-pre-wrap text-sm">{feedback.content}</p>
              </div>

              <Separator />

              {/* Metadata */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t('dashboard.admin.feedbacks.columns.reporter')}:</span>
                  <span>{feedback.reporterDisplayName || feedback.reporterName || t('dashboard.admin.feedbacks.anonymous')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t('dashboard.admin.feedbacks.columns.pageId')}:</span>
                  <code className="text-xs bg-muted rounded px-1.5 py-0.5">{feedback.pageId}</code>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t('dashboard.admin.feedbacks.columns.time')}:</span>
                  <span>{formatDate(feedback.createdAt)}</span>
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
