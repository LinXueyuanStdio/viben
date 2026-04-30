import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  BookmarkCheck,
  ChevronDown,
  Pin,
  PinOff,
  Clock,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Upload,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useSavedConfigsStore, type SavedInspectorConfig } from "@/stores/saved-configs-store";
import type { InspectorConfig } from "./config-manager";
import { SaveConfigDialog } from "./save-config-dialog";
import { formatRelativeTime } from "@/lib/utils";

interface SavedConfigsSelectorProps {
  currentConfig: InspectorConfig | null;
  currentUseProxy: boolean;
  onLoadConfig: (config: InspectorConfig, useProxy: boolean) => void;
}

export function SavedConfigsSelector({
  currentConfig,
  currentUseProxy,
  onLoadConfig,
}: SavedConfigsSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SavedInspectorConfig | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    configs,
    addConfig,
    updateConfig,
    deleteConfig,
    duplicateConfig,
    pinConfig,
    getSortedConfigs,
  } = useSavedConfigsStore();

  // Get sorted and filtered configs
  const sortedConfigs = useMemo(() => getSortedConfigs(), [configs, getSortedConfigs]);

  const filteredConfigs = useMemo(() => {
    if (!searchQuery.trim()) return sortedConfigs;
    const query = searchQuery.toLowerCase();
    return sortedConfigs.filter(
      (config) =>
        config.name.toLowerCase().includes(query) ||
        config.description?.toLowerCase().includes(query)
    );
  }, [sortedConfigs, searchQuery]);

  // Separate pinned and recent configs
  const pinnedConfigs = useMemo(
    () => filteredConfigs.filter((c) => c.isPinned),
    [filteredConfigs]
  );
  const recentConfigs = useMemo(
    () => filteredConfigs.filter((c) => !c.isPinned),
    [filteredConfigs]
  );

  // Format relative time
  const formatTime = useCallback((dateStr: string) => {
    try {
      return formatRelativeTime(dateStr);
    } catch {
      return dateStr;
    }
  }, []);

  // Handle save current config
  const handleSaveCurrentConfig = useCallback(
    (data: { name: string; description?: string; isPinned: boolean }) => {
      if (!currentConfig) return;
      addConfig({
        name: data.name,
        description: data.description,
        config: currentConfig,
        useProxy: currentUseProxy,
        isPinned: data.isPinned,
      });
    },
    [currentConfig, currentUseProxy, addConfig]
  );

  // Handle edit config
  const handleEditConfig = useCallback(
    (data: { name: string; description?: string; isPinned: boolean }) => {
      if (!editingConfig) return;
      updateConfig(editingConfig.id, {
        name: data.name,
        description: data.description,
        isPinned: data.isPinned,
      });
      setEditingConfig(null);
    },
    [editingConfig, updateConfig]
  );

  // Handle load config
  const handleLoadConfig = useCallback(
    (config: SavedInspectorConfig) => {
      onLoadConfig(config.config, config.useProxy);
      // Update the "updatedAt" to track recent usage
      updateConfig(config.id, {});
      setOpen(false);
    },
    [onLoadConfig, updateConfig]
  );

  // Handle duplicate
  const handleDuplicate = useCallback(
    (id: string) => {
      duplicateConfig(id);
    },
    [duplicateConfig]
  );

  // Handle delete
  const handleDelete = useCallback(() => {
    if (deleteConfirmId) {
      deleteConfig(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, deleteConfig]);

  // Handle pin toggle
  const handleTogglePin = useCallback(
    (id: string, currentPinned: boolean) => {
      pinConfig(id, !currentPinned);
    },
    [pinConfig]
  );

  // Render config item
  const renderConfigItem = (config: SavedInspectorConfig) => (
    <div
      key={config.id}
      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 group"
    >
      <button
        type="button"
        className="flex-1 text-left"
        onClick={() => handleLoadConfig(config)}
      >
        <div className="flex items-center gap-2">
          {config.isPinned && <Pin className="h-3 w-3 text-primary" />}
          <span className="font-medium text-sm truncate max-w-[180px]">
            {config.name}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
          <Clock className="h-3 w-3" />
          <span>{formatTime(config.updatedAt)}</span>
        </div>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleLoadConfig(config)}>
            <Upload className="h-4 w-4 mr-2" />
            {t("inspector.loadConfig", "Load")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setEditingConfig(config);
            }}
          >
            <Pencil className="h-4 w-4 mr-2" />
            {t("common.edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleDuplicate(config.id)}>
            <Copy className="h-4 w-4 mr-2" />
            {t("common.duplicate", "Duplicate")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => handleTogglePin(config.id, !!config.isPinned)}
          >
            {config.isPinned ? (
              <>
                <PinOff className="h-4 w-4 mr-2" />
                {t("inspector.unpinConfig", "Unpin")}
              </>
            ) : (
              <>
                <Pin className="h-4 w-4 mr-2" />
                {t("inspector.pinConfig", "Pin")}
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-red-600 focus:text-red-600"
            onClick={() => setDeleteConfirmId(config.id)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7">
            <BookmarkCheck className="h-3.5 w-3.5 mr-1" />
            {t("inspector.savedConfigs", "Saved Configs")}
            <ChevronDown className="h-3.5 w-3.5 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("inspector.searchConfigs", "Search configs...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {filteredConfigs.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery
                  ? t("inspector.noConfigsFound", "No configs found")
                  : t("inspector.noSavedConfigs", "No saved configs yet")}
              </div>
            ) : (
              <div className="p-2">
                {/* Pinned section */}
                {pinnedConfigs.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Pin className="h-3 w-3" />
                      {t("inspector.pinnedConfigs", "Pinned")}
                    </div>
                    {pinnedConfigs.map(renderConfigItem)}
                  </div>
                )}

                {/* Recent section */}
                {recentConfigs.length > 0 && (
                  <div>
                    {pinnedConfigs.length > 0 && (
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {t("inspector.recentConfigs", "Recent")}
                      </div>
                    )}
                    {recentConfigs.map(renderConfigItem)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              onClick={() => {
                setSaveDialogOpen(true);
                setOpen(false);
              }}
              disabled={!currentConfig}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("inspector.saveCurrentConfig", "Save Current Config")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Save dialog (create mode) */}
      <SaveConfigDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        onSave={handleSaveCurrentConfig}
      />

      {/* Edit dialog */}
      <SaveConfigDialog
        open={!!editingConfig}
        onOpenChange={(open) => {
          if (!open) setEditingConfig(null);
        }}
        editConfig={editingConfig || undefined}
        onSave={handleEditConfig}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("inspector.deleteConfigTitle", "Delete Configuration")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "inspector.deleteConfigDesc",
                "Are you sure you want to delete this saved configuration? This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
