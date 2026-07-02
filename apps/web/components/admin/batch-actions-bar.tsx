'use client';

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, CheckSquare, XSquare } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface BatchAction {
  /** Unique key for this action */
  key: string;
  /** Button label */
  label: string;
  /** Button variant */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
  /** Whether this action requires a confirmation dialog */
  requireConfirm?: boolean;
  /** Confirmation dialog title */
  confirmTitle?: string;
  /** Confirmation dialog description */
  confirmDescription?: string;
  /** Action handler */
  onAction: () => Promise<void>;
}

export interface BatchActionsBarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Total number of items (for select all) */
  totalCount?: number;
  /** Called when select all is clicked */
  onSelectAll: () => void;
  /** Called when deselect all is clicked */
  onDeselectAll: () => void;
  /** Available batch actions */
  actions: BatchAction[];
  /** Whether a batch operation is in progress */
  loading?: boolean;
  /** Progress text (e.g., "正在处理 3/10...") */
  progressText?: string;
}

export function BatchActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  actions,
  loading = false,
  progressText,
}: BatchActionsBarProps) {
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  if (selectedCount === 0) return null;

  const handleAction = async (action: BatchAction) => {
    if (action.requireConfirm) {
      setConfirmingAction(action.key);
      return;
    }

    setActing(true);
    try {
      await action.onAction();
    } finally {
      setActing(false);
    }
  };

  const handleConfirm = async () => {
    const action = actions.find((a) => a.key === confirmingAction);
    if (!action) return;

    setActing(true);
    try {
      await action.onAction();
    } finally {
      setConfirmingAction(null);
      setActing(false);
    }
  };

  const isActing = acting || loading;

  return (
    <>
      <div
        className={cn(
          'sticky top-0 z-10 flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-sm',
          'animate-in fade-in slide-in-from-top-2'
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span>
            已选 <span className="text-primary font-bold">{selectedCount}</span>
            {totalCount !== undefined && (
              <span className="text-muted-foreground"> / {totalCount}</span>
            )}
            {' '}项
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSelectAll}
            disabled={isActing}
          >
            全选
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeselectAll}
            disabled={isActing}
          >
            <XSquare className="h-4 w-4 mr-1" />
            取消选择
          </Button>

          {actions.length > 0 && (
            <>
              <div className="mx-2 h-5 w-px bg-border" />
              {actions.map((action) => (
                <Button
                  key={action.key}
                  variant={action.variant ?? 'default'}
                  size="sm"
                  onClick={() => handleAction(action)}
                  disabled={isActing}
                >
                  {isActing && action.key === confirmingAction ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  {action.label}
                </Button>
              ))}
            </>
          )}

          {progressText && isActing && (
            <span className="text-sm text-muted-foreground ml-2">
              {progressText}
            </span>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmingAction && (() => {
        const action = actions.find((a) => a.key === confirmingAction);
        if (!action?.requireConfirm) return null;
        return (
          <AlertDialog open onOpenChange={() => !acting && setConfirmingAction(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{action.confirmTitle ?? '确认操作'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {action.confirmDescription ?? `确定要对选中的 ${selectedCount} 项执行此操作吗？此操作不可撤销。`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={acting}>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirm}
                  disabled={acting}
                  className={
                    action.variant === 'destructive'
                      ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                      : ''
                  }
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  确认
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
    </>
  );
}
