/**
 * PagePermissionsDialog Component
 *
 * Dialog for managing page permissions (read/write access).
 * Per spec, pages can have read and/or write permissions.
 */

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Shield, Eye, Edit2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { PageConfig, PagePermission } from "@/lib/gateway/types/page";

// =============================================================================
// Types
// =============================================================================

export interface PagePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: PageConfig | null;
  workspacePath: string;
  /** Callback to save permissions */
  onSave?: (slug: string, permissions: PagePermission[]) => Promise<void>;
}

// =============================================================================
// Main Component
// =============================================================================

export function PagePermissionsDialog({
  open,
  onOpenChange,
  page,
  workspacePath: _workspacePath,
  onSave,
}: PagePermissionsDialogProps) {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);

  // Permission state
  const [canRead, setCanRead] = useState(true);
  const [canWrite, setCanWrite] = useState(false);

  // Initialize from page config
  useEffect(() => {
    if (page) {
      setCanRead(page.permission.includes("read"));
      setCanWrite(page.permission.includes("write"));
    }
  }, [page]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!page || !onSave) return;

    const permissions: PagePermission[] = [];
    if (canRead) permissions.push("read");
    if (canWrite) permissions.push("write");

    setIsSaving(true);
    try {
      await onSave(page.slug, permissions);
      toast.success(t("page.permissionsSaved", "Permissions saved"));
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to save permissions:", err);
      toast.error(t("page.permissionsSaveFailed", "Failed to save permissions"));
    } finally {
      setIsSaving(false);
    }
  }, [page, canRead, canWrite, onSave, t, onOpenChange]);

  if (!page) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("page.permissions", "Permissions")}
          </DialogTitle>
          <DialogDescription>
            {t("page.permissionsDescription", "Manage access permissions for \"{{name}}\"", { name: page.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Read Permission */}
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border p-4 transition-colors",
              canRead ? "border-primary/50 bg-primary/5" : "border-border"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  canRead ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                <Eye className="h-5 w-5" />
              </div>
              <div>
                <Label htmlFor="perm-read" className="text-sm font-medium">
                  {t("page.permissionRead", "Read")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("page.permissionReadDescription", "Allow viewing page content")}
                </p>
              </div>
            </div>
            <Switch
              id="perm-read"
              checked={canRead}
              onCheckedChange={setCanRead}
            />
          </div>

          {/* Write Permission */}
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border p-4 transition-colors",
              canWrite ? "border-primary/50 bg-primary/5" : "border-border"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  canWrite ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}
              >
                <Edit2 className="h-5 w-5" />
              </div>
              <div>
                <Label htmlFor="perm-write" className="text-sm font-medium">
                  {t("page.permissionWrite", "Write")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("page.permissionWriteDescription", "Allow modifying page content")}
                </p>
              </div>
            </div>
            <Switch
              id="perm-write"
              checked={canWrite}
              onCheckedChange={setCanWrite}
            />
          </div>

          {/* Note about AI agents */}
          <p className="text-xs text-muted-foreground">
            {t("page.permissionsNote", "These permissions control what AI agents can do with this page.")}
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !onSave}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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

export default PagePermissionsDialog;
