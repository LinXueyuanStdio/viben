import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  setApprovalHandler,
  clearApprovalHandler,
  UserCancelledException,
} from "@/lib/action-system";
import type { PendingApproval } from "@/lib/action-system";

/**
 * Global approval dialog for GUI actions that require user confirmation.
 * Mount once at app root level.
 */
export function ActionApprovalDialog() {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<PendingApproval[]>([]);
  const queueRef = useRef<PendingApproval[]>([]);
  queueRef.current = queue;
  const pending = queue[0] ?? null;

  useEffect(() => {
    setApprovalHandler((p) => setQueue((current) => [...current, p]));
    return () => {
      // Reject any pending approval on unmount to avoid dangling promises
      for (const approval of queueRef.current) {
        approval.reject(new UserCancelledException("Dialog unmounted"));
      }
      clearApprovalHandler();
    };
  }, []);

  const handleConfirm = () => {
    if (pending) {
      pending.resolve(true);
      setQueue((current) => current.slice(1));
    }
  };

  const handleCancel = () => {
    if (pending) {
      pending.reject(new UserCancelledException());
      setQueue((current) => current.slice(1));
    }
  };

  return (
    <AlertDialog open={!!pending} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pending?.options?.title || t("actionSystem.approvalTitle", "Action Approval")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.message}
            {pending?.options?.description && (
              <span className="block mt-2 text-muted-foreground">
                {pending.options.description}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {pending?.options?.cancelLabel || t("common.cancel", "Cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            {pending?.options?.confirmLabel || t("common.confirm", "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
