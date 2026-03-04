import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { SavedInspectorConfig } from "@/stores/saved-configs-store";

interface SaveConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, edit mode; otherwise create mode */
  editConfig?: SavedInspectorConfig;
  onSave: (data: { name: string; description?: string; isPinned: boolean }) => void;
}

export function SaveConfigDialog({
  open,
  onOpenChange,
  editConfig,
  onSave,
}: SaveConfigDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!editConfig;

  // Reset form when dialog opens/closes or editConfig changes
  useEffect(() => {
    if (open) {
      if (editConfig) {
        setName(editConfig.name);
        setDescription(editConfig.description || "");
        setIsPinned(editConfig.isPinned || false);
      } else {
        setName("");
        setDescription("");
        setIsPinned(false);
      }
      setError(null);
    }
  }, [open, editConfig]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("inspector.configNameRequired", "Name is required"));
      return;
    }

    onSave({
      name: trimmedName,
      description: description.trim() || undefined,
      isPinned,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            {isEditMode
              ? t("inspector.editSavedConfig", "Edit Saved Config")
              : t("inspector.saveConfig", "Save Config")}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? t("inspector.editSavedConfigDesc", "Update the name and description of this saved configuration.")
              : t("inspector.saveConfigDesc", "Save the current configuration for quick access later.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="config-name">
              {t("inspector.configName", "Name")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="config-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder={t("inspector.configNamePlaceholder", "e.g., Production Server")}
              autoFocus
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="config-description">
              {t("inspector.configDescription", "Description")}
            </Label>
            <Textarea
              id="config-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("inspector.configDescriptionPlaceholder", "Optional description...")}
              rows={2}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="config-pinned"
              checked={isPinned}
              onCheckedChange={(checked) => setIsPinned(!!checked)}
            />
            <Label htmlFor="config-pinned" className="text-sm font-normal cursor-pointer">
              {t("inspector.pinConfig", "Pin this configuration")}
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {isEditMode ? t("common.save") : t("inspector.saveConfig", "Save Config")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
