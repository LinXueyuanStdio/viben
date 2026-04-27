import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { open } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, ChevronDown, ChevronUp, Folder, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { CreationMethod } from "./step-choose-method";

export interface FolderStatus {
  hasGit: boolean;
  hasViben: boolean;
  folderName: string;
}

export interface ConfigureFormData {
  name: string;
  path: string;
  initGit: boolean;
  initViben: boolean;
  vibenOptions: {
    developerName: string;
    includeCursor: boolean;
    force: boolean;
  };
}

interface StepConfigureProps {
  method: CreationMethod;
  selectedPath: string | null;
  folderStatus: FolderStatus | null;
  onPathSelect: (path: string, status: FolderStatus) => void;
  onBack: () => void;
  onSubmit: (data: ConfigureFormData) => void;
  isSubmitting: boolean;
}

/**
 * Step 2: Configure workspace settings
 */
export function StepConfigure({
  method,
  selectedPath,
  folderStatus,
  onPathSelect,
  onBack,
  onSubmit,
  isSubmitting,
}: StepConfigureProps) {
  const { t } = useTranslation();

  // Form state
  const [name, setName] = useState(folderStatus?.folderName || "");
  const [parentPath, setParentPath] = useState(selectedPath || "");
  const [initGit, setInitGit] = useState(true);
  const [initViben, setInitViben] = useState(true);
  const [reinitialize, setReinitialize] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [developerName, setDeveloperName] = useState(t("workspace.stepConfigure.defaultDeveloperName", "developer"));
  const [includeCursor, setIncludeCursor] = useState(true);

  // Update name when folder status changes
  useEffect(() => {
    if (folderStatus?.folderName && method === "open-existing") {
      setName(folderStatus.folderName);
    }
  }, [folderStatus, method]);

  // Handle folder selection for existing folders
  const handleSelectFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("workspace.addModal.methodOpenExisting"),
    });

    if (selected && typeof selected === "string") {
      // Call parent to detect folder status
      onPathSelect(selected, {
        hasGit: false,
        hasViben: false,
        folderName: selected.split("/").pop() || "",
      });
    }
  };

  // Handle parent folder selection for new folders
  const handleSelectParentFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: t("workspace.addModal.fieldLocation"),
    });

    if (selected && typeof selected === "string") {
      setParentPath(selected);
    }
  };

  // Form validation
  const isValid = useMemo(() => {
    if (method === "open-existing") {
      return !!selectedPath && !!name.trim();
    }
    return !!parentPath && !!name.trim();
  }, [method, selectedPath, parentPath, name]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    const path = method === "open-existing" ? selectedPath! : parentPath;

    onSubmit({
      name: name.trim(),
      path,
      initGit: initGit && (method === "create-new" || !folderStatus?.hasGit),
      initViben: initViben && (method === "create-new" || !folderStatus?.hasViben || reinitialize),
      vibenOptions: {
        developerName: developerName.trim() || t("workspace.stepConfigure.defaultDeveloperName", "developer"),
        includeCursor,
        force: reinitialize,
      },
    });
  };

  // Computed full path for new folders
  const fullPath = method === "create-new" && parentPath && name
    ? `${parentPath}/${name.toLowerCase().replace(/\s+/g, "-")}`
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {method === "open-existing" ? (
        // Open existing folder form
        <>
          {/* Location (read-only) */}
          <div className="space-y-2">
            <Label>{t("workspace.addModal.fieldLocation")}</Label>
            {selectedPath ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 text-sm bg-muted rounded-md truncate">
                  {selectedPath}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {t("workspace.addModal.fieldLocationSelected")}
                </span>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleSelectFolder}
                className="w-full justify-start"
              >
                <Folder className="h-4 w-4 mr-2" />
                {t("workspace.addModal.methodOpenExisting")}
              </Button>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t("workspace.addModal.fieldName")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("placeholders.projectName")}
            />
          </div>

          {/* Viben exists warning */}
          {folderStatus?.hasViben && (
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    {t("workspace.addModal.vibenExists")}
                  </p>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="reinitialize"
                      checked={reinitialize}
                      onCheckedChange={(checked) => setReinitialize(checked === true)}
                    />
                    <label htmlFor="reinitialize" className="text-xs cursor-pointer">
                      {t("workspace.addModal.optionReinitialize")}
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Options */}
          <div className="space-y-3">
            {!folderStatus?.hasGit && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="initGit"
                  checked={initGit}
                  onCheckedChange={(checked) => setInitGit(checked === true)}
                />
                <label htmlFor="initGit" className="text-sm cursor-pointer">
                  {t("workspace.addModal.optionInitGit")}
                </label>
              </div>
            )}
            {!folderStatus?.hasViben && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="initViben"
                  checked={initViben}
                  onCheckedChange={(checked) => setInitViben(checked === true)}
                />
                <label htmlFor="initViben" className="text-sm cursor-pointer">
                  {t("workspace.addModal.optionInitViben")}
                </label>
              </div>
            )}
          </div>
        </>
      ) : (
        // Create new folder form
        <>
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{t("workspace.addModal.fieldName")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("placeholders.newProjectName")}
            />
            <p className="text-xs text-muted-foreground">
              {t("workspace.addModal.fieldNameHint")}
            </p>
          </div>

          {/* Parent location */}
          <div className="space-y-2">
            <Label>{t("workspace.addModal.fieldLocation")}</Label>
            <div className="flex gap-2">
              <Input
                value={parentPath}
                onChange={(e) => setParentPath(e.target.value)}
                placeholder={t("onboarding.projectPathPlaceholder")}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={handleSelectParentFolder}>
                {t("common.open")}
              </Button>
            </div>
            {fullPath && (
              <p className="text-xs text-muted-foreground">
                {t("workspace.addModal.fieldWillCreate", { path: fullPath })}
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="initGit"
                checked={initGit}
                onCheckedChange={(checked) => setInitGit(checked === true)}
              />
              <label htmlFor="initGit" className="text-sm cursor-pointer">
                {t("workspace.addModal.optionInitGit")}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="initViben"
                checked={initViben}
                onCheckedChange={(checked) => setInitViben(checked === true)}
              />
              <label htmlFor="initViben" className="text-sm cursor-pointer">
                {t("workspace.addModal.optionInitViben")}
              </label>
            </div>
          </div>
        </>
      )}

      {/* Advanced options */}
      {initViben && (method === "create-new" || !folderStatus?.hasViben || reinitialize) && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showAdvanced ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {t("workspace.addModal.advancedOptions")}
          </button>

          {showAdvanced && (
            <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
              {/* Developer name */}
              <div className="space-y-2">
                <Label htmlFor="developerName">{t("workspace.addModal.fieldDeveloperName")}</Label>
                <Input
                  id="developerName"
                  value={developerName}
                  onChange={(e) => setDeveloperName(e.target.value)}
                  placeholder={t("placeholders.developer")}
                />
              </div>

              {/* Include Cursor */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeCursor"
                  checked={includeCursor}
                  onCheckedChange={(checked) => setIncludeCursor(checked === true)}
                />
                <label htmlFor="includeCursor" className="text-sm cursor-pointer">
                  {t("workspace.addModal.optionIncludeCursor")}
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer buttons */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
          {t("common.back")}
        </Button>
        <Button type="submit" disabled={!isValid || isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {t("common.creating")}
            </>
          ) : (
            t("common.create")
          )}
        </Button>
      </div>
    </form>
  );
}
