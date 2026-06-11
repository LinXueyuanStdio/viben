/**
 * EditPageDialog Component
 *
 * Dialog for editing existing page config (name, description, icon, cover, page_width, show_toc).
 * Slug and page type are read-only (structural, cannot be changed).
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useUpdatePageConfig } from "@/hooks/use-pages";
import { toast } from "@/hooks/use-toast";
import { IconPicker, IconDisplay } from "@/components/ui/icon-picker";
import type { IconData } from "@/components/ui/icon-picker";
import type { PageConfig } from "@/hooks/use-pages";
import type { PageWidth } from "@/lib/gateway/types/page";

// =============================================================================
// Types
// =============================================================================

export interface EditPageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  page: PageConfig | null;
  workspacePath: string;
}

// =============================================================================
// Main Component
// =============================================================================

export function EditPageDialog({
  open,
  onOpenChange,
  page,
  workspacePath,
}: EditPageDialogProps) {
  const { t } = useTranslation();
  const updatePageConfigMutation = useUpdatePageConfig();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState<IconData | null>(null);
  const [cover, setCover] = useState("");
  const [pageWidth, setPageWidth] = useState<PageWidth>("default");
  const [showToc, setShowToc] = useState(false);

  // Initialize form from page when dialog opens
  useEffect(() => {
    if (open && page) {
      setName(page.name);
      setDescription(page.description ?? "");
      setIcon(page.icon ?? { type: "lucide", value: "file-text" });
      setCover(page.cover ?? "");
      setPageWidth(page.page_width ?? "default");
      setShowToc(page.show_toc ?? false);
    }
  }, [open, page]);

  // Validate form
  const isValid = useMemo(() => {
    return !!name.trim();
  }, [name]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!isValid || !page) return;

    try {
      await updatePageConfigMutation.mutateAsync({
        workspace_path: workspacePath,
        uid: page.uid,
        name: name.trim(),
        description: description.trim() || null,
        icon: icon ? { type: icon.type, value: icon.value } : null,
        cover: cover.trim() || null,
        page_width: pageWidth,
        show_toc: showToc,
      });
      toast.success(t("page.updateSuccess", "Page updated successfully"));
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to update page config:", err);
      toast.error(t("page.updateFailed", "Failed to update page"));
    }
  }, [
    isValid,
    page,
    workspacePath,
    name,
    description,
    icon,
    cover,
    pageWidth,
    showToc,
    updatePageConfigMutation,
    t,
    onOpenChange,
  ]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  if (!page) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[450px]"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4" />
            {t("page.editPage", "Edit Page")}
          </DialogTitle>
          <DialogDescription>
            {t("page.editPageDescription", "Modify page name, description, and icon")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name + Icon */}
          <div className="space-y-2">
            <Label htmlFor="edit-page-name">{t("page.name", "Name")}</Label>
            <div className="flex items-center gap-2">
              {/* Icon Picker */}
              <IconPicker
                value={icon}
                onChange={setIcon}
                workspacePath={workspacePath}
                trigger={
                  <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border hover:bg-muted/50 transition-colors"
                  >
                    <IconDisplay icon={icon} size="md" workspacePath={workspacePath} />
                  </button>
                }
              />
              <Input
                id="edit-page-name"
                placeholder={t("page.namePlaceholder", "My Page")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                className="flex-1"
              />
            </div>
          </div>

          {/* UID (read-only) */}
          <div className="space-y-2">
            <Label>{t("page.uid", "UID")}</Label>
            <Input
              value={page.uid}
              disabled
              className="font-mono text-sm opacity-60"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-page-description">
              {t("page.description", "Description")}
              <span className="ml-1 text-muted-foreground">({t("common.optional", "Optional")})</span>
            </Label>
            <Textarea
              id="edit-page-description"
              placeholder={t("page.descriptionPlaceholder", "A brief description of this page")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <Separator />

          {/* Cover URL */}
          <div className="space-y-2">
            <Label htmlFor="edit-page-cover">
              {t("page.cover", "Cover")}
              <span className="ml-1 text-muted-foreground">({t("common.optional", "Optional")})</span>
            </Label>
            <Input
              id="edit-page-cover"
              placeholder={t("page.coverPlaceholder", "https://example.com/cover.jpg")}
              value={cover}
              onChange={(e) => setCover(e.target.value)}
            />
          </div>

          {/* Page Width */}
          <div className="space-y-2">
            <Label>{t("page.pageWidth", "Page Width")}</Label>
            <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
              {(["default", "wide", "full"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPageWidth(w)}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    pageWidth === w
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {w === "default"
                    ? t("page.pageWidthDefault", "Default")
                    : w === "wide"
                      ? t("page.pageWidthWide", "Wide")
                      : t("page.pageWidthFull", "Full")}
                </button>
              ))}
            </div>
          </div>

          {/* Show TOC */}
          <div className="flex items-center justify-between">
            <Label htmlFor="edit-page-show-toc" className="cursor-pointer">
              {t("page.showToc", "Show Table of Contents")}
            </Label>
            <Switch
              id="edit-page-show-toc"
              checked={showToc}
              onCheckedChange={setShowToc}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updatePageConfigMutation.isPending}
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || updatePageConfigMutation.isPending}
          >
            {updatePageConfigMutation.isPending ? (
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

export default EditPageDialog;
