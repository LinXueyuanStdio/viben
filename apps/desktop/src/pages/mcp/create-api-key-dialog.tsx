import { useState, useMemo, useEffect } from "react";
import { Plus, Search, Loader2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores";
import { BrowseSourceStoreDialog } from "./browse-source-store";

interface SourceItem {
  id: string;
  name: string;
  category: "builtin";
}

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (result: { id: string; name: string; key: string }) => void;
  createKey: (name: string, enabledSources?: string[]) => Promise<{ id: string; name: string; key: string } | null>;
}

export function CreateApiKeyDialog({ open, onOpenChange, onCreated, createKey }: CreateApiKeyDialogProps) {
  const { t } = useTranslation();
  const providers = useAppStore((s) => s.providers);
  const [storeOpen, setStoreOpen] = useState(false);
  const builtinProviders = useMemo(
    () => providers.filter((p) => !p.requiresApiKey || p.hasApiKey),
    [providers]
  );
  const [name, setName] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(true);
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setName("");
      setSelectedSources(new Set());
      setSelectAll(true);
      setSearchQuery("");
      setError(null);
    }
  }, [open]);

  const allSources = useMemo((): SourceItem[] => {
    return builtinProviders.map((p) => ({ id: p.id, name: p.name, category: "builtin" as const }));
  }, [builtinProviders]);

  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return allSources;
    const q = searchQuery.toLowerCase();
    return allSources.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [allSources, searchQuery]);

  const handleToggleSource = (sourceId: string) => {
    setSelectAll(false);
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectAll(false);
      setSelectedSources(new Set(allSources.map((s) => s.id)));
    } else {
      setSelectAll(true);
      setSelectedSources(new Set());
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);

    const enabledSources = selectAll ? undefined : Array.from(selectedSources);
    const result = await createKey(name.trim(), enabledSources);
    if (result) {
      onCreated(result);
      onOpenChange(false);
    } else {
      setError(t("browseMcp.createKeyFailed", "创建失败，请重试"));
    }
    setCreating(false);
  };

  const handleOpenStore = () => {
    setStoreOpen(true);
  };

  const effectiveCount = selectAll ? allSources.length : selectedSources.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("browseMcp.createApiKey", "创建 API Key")}</DialogTitle>
          <DialogDescription>
            {t("browseMcp.createApiKeyDesc", "为外部 Agent 创建 API Key 并配置可访问的数据源。")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name input */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              {t("browseMcp.keyName", "名称")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("browseMcp.keyNamePlaceholder", "例如: Claude Code、Cursor")}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>

          {/* Source list */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">
                {t("browseMcp.accessibleSources", "可访问的数据源")}
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1"
                onClick={handleOpenStore}
                title={t("browseMcp.openMarketplace", "打开搜索源商店")}
              >
                <Plus className="h-3.5 w-3.5" />
                <Package className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("common.search", "搜索...")}
                className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-sm"
              />
            </div>

            {/* Select all toggle */}
            <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm border-b mb-1">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="rounded border-border"
              />
              <span className="font-medium">
                {t("browseMcp.allSources", "全部数据源")}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                {allSources.length}
              </span>
            </label>

            {/* Source list with scroll */}
            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
              {filteredSources.map((source) => {
                const checked = selectAll || selectedSources.has(source.id);
                return (
                  <label
                    key={source.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleSource(source.id)}
                      disabled={selectAll}
                      className="rounded border-border"
                    />
                    <span>{source.name}</span>
                    {source.category === "builtin" && (
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {t("browseMcp.builtin", "内建")}
                      </span>
                    )}
                  </label>
                );
              })}
              {filteredSources.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {t("common.noResults", "无结果")}
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          {error && (
            <p className="text-xs text-destructive mb-2 w-full">{error}</p>
          )}
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-muted-foreground">
              {selectAll
                ? t("browseMcp.allSourcesAccess", "可访问全部数据源")
                : t("browseMcp.selectedSourcesCount", { count: effectiveCount })}
            </span>
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.create", "创建")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <BrowseSourceStoreDialog open={storeOpen} onOpenChange={setStoreOpen} />
    </Dialog>
  );
}
