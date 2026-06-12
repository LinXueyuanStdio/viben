import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Settings, AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Label, cn } from "@viben/ui";

interface QueueSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMaxParallel: number;
  onSave: (maxParallel: number) => void | Promise<void>;
  isSaving?: boolean;
}

export function QueueSettingsModal({
  open,
  onOpenChange,
  currentMaxParallel,
  onSave,
  isSaving = false,
}: QueueSettingsModalProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(currentMaxParallel);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset value when modal opens
  useEffect(() => {
    if (open) {
      setValue(currentMaxParallel);
      setError(null);
      setIsSubmitting(false);
    }
  }, [open, currentMaxParallel]);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value, 10);
    setValue(newValue);

    // Validate
    if (isNaN(newValue)) {
      setError(t("workspace.queueSettingsDialog.errorNaN", "Please enter a valid number"));
    } else if (newValue < 1) {
      setError(t("workspace.queueSettingsDialog.errorMin", "Minimum value is 1"));
    } else if (newValue > 10) {
      setError(t("workspace.queueSettingsDialog.errorMax", "Maximum value is 10"));
    } else {
      setError(null);
    }
  };

  const handleSave = async () => {
    if (!error && !isNaN(value)) {
      setIsSubmitting(true);
      try {
        await onSave(value);
        onOpenChange(false);
      } catch (err) {
        // Error handling - show error message
        const message = err instanceof Error ? err.message : t("workspace.queueSettingsDialog.saveFailed", "Failed to save settings");
        setError(message);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !error && !isSubmitting && !isSaving) {
      handleSave();
    }
  };

  const isLoading = isSubmitting || isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-info" />
            {t("workspace.queueSettingsDialog.title", "Queue Settings")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "workspace.queueSettingsDialog.description",
              "Configure how many tasks can run in parallel."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="max-parallel">
              {t("workspace.queueSettingsDialog.maxParallel", "Max Parallel Tasks")}
            </Label>
            <Input
              id="max-parallel"
              type="number"
              min={1}
              max={10}
              value={value}
              onChange={handleValueChange}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className={cn(
                "w-full",
                error && "border-destructive focus-visible:ring-destructive"
              )}
              aria-invalid={!!error}
              aria-describedby={error ? "max-parallel-error" : undefined}
            />
            {error && (
              <p
                id="max-parallel-error"
                className="text-sm text-destructive flex items-center gap-1.5"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                {error}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t(
                "workspace.queueSettingsDialog.hint",
                "Tasks will automatically move from Queue to In Progress when capacity is available."
              )}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={handleSave} disabled={!!error || isNaN(value) || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("common.saving", "Saving...")}
              </>
            ) : (
              t("common.save", "Save")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
