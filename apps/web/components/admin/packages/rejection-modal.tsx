'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface RejectionModalProps {
  packageName: string;
  authorName: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function RejectionModal({
  packageName,
  authorName,
  isOpen,
  onClose,
  onConfirm,
}: RejectionModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const COMMON_REASONS = [
    t('dashboard.admin.packages.rejection.reasons.incompleteDoc'),
    t('dashboard.admin.packages.rejection.reasons.securityConcerns'),
    t('dashboard.admin.packages.rejection.reasons.duplicate'),
    t('dashboard.admin.packages.rejection.reasons.violatesGuidelines'),
  ];

  const handleConfirm = async () => {
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(reason);
      setReason('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      onClose();
    }
  };

  const selectCommonReason = (commonReason: string) => {
    setReason((prev) => {
      if (prev.trim()) {
        return `${prev}\n${commonReason}`;
      }
      return commonReason;
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('dashboard.admin.packages.rejection.title')}</DialogTitle>
          <DialogDescription>
            {t('dashboard.admin.packages.rejection.description', { packageName, authorName })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('dashboard.admin.packages.rejection.quickReasons')}</Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_REASONS.map((commonReason) => (
                <Button
                  key={commonReason}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => selectCommonReason(commonReason)}
                >
                  {commonReason}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rejection-reason">{t('dashboard.admin.packages.rejection.reasonLabel')}</Label>
            <Textarea
              id="rejection-reason"
              placeholder={t('dashboard.admin.packages.rejection.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('dashboard.admin.packages.rejection.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
