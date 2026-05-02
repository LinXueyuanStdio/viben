/**
 * Agent MCP Configuration Dialog
 *
 * Dialog for configuring MCP servers for an agent.
 * Allows selecting from existing MCP servers or creating new ones.
 */
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Server,
  Plus,
  Check,
  ExternalLink,
  AlertCircle,
  Search,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, setsEqual } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";

interface AgentMcpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedServerIds: string[];
  onServersChange: (serverIds: string[]) => void;
}

export function AgentMcpDialog({
  open,
  onOpenChange,
  selectedServerIds,
  onServersChange,
}: AgentMcpDialogProps) {
  const { t } = useTranslation();
  const { openPath } = useDesktopRouting();
  const mcpServers = useAppStore((state) => state.mcpServers);
  const [localSelected, setLocalSelected] = useState<string[]>(selectedServerIds);
  const [searchQuery, setSearchQuery] = useState("");

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalSelected(selectedServerIds);
      setSearchQuery("");
    }
  }, [open, selectedServerIds]);

  // Filter servers by search
  const filteredServers = useMemo(() => {
    if (!searchQuery.trim()) return mcpServers;
    const query = searchQuery.toLowerCase();
    return mcpServers.filter(
      (server) =>
        server.name.toLowerCase().includes(query) ||
        server.transport.toLowerCase().includes(query)
    );
  }, [mcpServers, searchQuery]);

  const handleToggleServer = (serverId: string) => {
    setLocalSelected((prev) =>
      prev.includes(serverId)
        ? prev.filter((id) => id !== serverId)
        : [...prev, serverId]
    );
  };

  const handleSelectAll = () => {
    if (localSelected.length === filteredServers.length) {
      setLocalSelected([]);
    } else {
      setLocalSelected(filteredServers.map((s) => s.id));
    }
  };

  const handleSave = () => {
    onServersChange(localSelected);
    onOpenChange(false);
  };

  const handleGoToSearchService = () => {
    onOpenChange(false);
    openPath("/mcp-services/search-service", {
      title: t("nav.searchService", "Search Service"),
      icon: { type: "lucide", value: "search" },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-500";
      case "stopped":
        return "bg-gray-400";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "running":
        return t("gateway.running");
      case "stopped":
        return t("gateway.stopped");
      default:
        return status;
    }
  };

  const hasChanges = !setsEqual(localSelected, selectedServerIds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Server className="h-4 w-4 text-primary" />
            </div>
            {t("settingsAgents.configureMcp")}
          </DialogTitle>
          <DialogDescription>
            {t("settingsAgents.configureMcpDesc")}
          </DialogDescription>
        </DialogHeader>

        {/* Search and Selection Info */}
        <div className="px-6 pb-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("common.search", { defaultValue: "Search..." })}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {mcpServers.length > 0 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 hover:text-foreground transition-colors"
              >
                <Checkbox
                  checked={localSelected.length === filteredServers.length && filteredServers.length > 0}
                  className="h-3.5 w-3.5"
                />
                <span>{t("common.selectAll", { defaultValue: "Select all" })}</span>
              </button>
              <span>
                {localSelected.length} / {mcpServers.length} {t("common.selected", { defaultValue: "selected" })}
              </span>
            </div>
          )}
        </div>

        {/* Server List */}
        <ScrollArea className="max-h-[280px] px-6">
          {mcpServers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
                <AlertCircle className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">
                {t("settingsAgents.noMcpServersAvailable")}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                {t("settingsAgents.noMcpServersHint", { defaultValue: "Create MCP servers to provide tools for your agent" })}
              </p>
              <Button variant="default" size="sm" onClick={handleGoToSearchService}>
                <Plus className="h-4 w-4 mr-2" />
                {t("settingsAgents.createNewServer")}
              </Button>
            </div>
          ) : filteredServers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t("common.noResults", { defaultValue: "No results found" })}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {filteredServers.map((server) => {
                const isSelected = localSelected.includes(server.id);
                return (
                  <button
                    key={server.id}
                    onClick={() => handleToggleServer(server.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left group",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {server.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {server.transport.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              getStatusColor(server.status)
                            )}
                          />
                          <span className="text-[10px] text-muted-foreground">
                            {getStatusLabel(server.status)}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">•</span>
                        <span className="text-[10px] text-muted-foreground">
                          {server.enabledSources.length} {t("searchService.sources")}
                        </span>
                        {server.port && (
                          <>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-muted-foreground">
                              :{server.port}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-6 pt-4 border-t bg-muted/30">
          <div className="flex w-full items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleGoToSearchService}>
              <ExternalLink className="h-4 w-4 mr-2" />
              {t("settingsAgents.goToSearchService")}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges}>
                {t("common.save")}
                {hasChanges && localSelected.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">
                    {localSelected.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
