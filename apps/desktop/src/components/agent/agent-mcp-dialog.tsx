/**
 * Agent MCP Configuration Dialog
 *
 * Dialog for configuring MCP servers for an agent.
 * Two-tab layout: Built-in and Market.
 */
import { useState, useEffect, useCallback } from "react";
import { Server, Plus, Check, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { type AgentMcpEntry } from "@/lib/gateway/types/agent";
import { McpMarketList } from "./mcp-market-list";
import { McpServerConfigDialog } from "./mcp-server-config-dialog";
import type { OfficialServerDisplay } from "@/types/official-registry";

// Re-export the type for consumers
export type { AgentMcpEntry };

interface AgentMcpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedServers: AgentMcpEntry[];
  onServersChange: (servers: AgentMcpEntry[]) => void;
}

const BUILTIN_SERVERS: Array<{ name: string; description: string; type: "builtin" }> = [
  { name: "browse-mcp", description: "Viben Gateway MCP 代理服务", type: "builtin" },
  { name: "presentation", description: "演示模式工具", type: "builtin" },
];

export function AgentMcpDialog({
  open,
  onOpenChange,
  selectedServers,
  onServersChange,
}: AgentMcpDialogProps) {
  const [localSelected, setLocalSelected] = useState<AgentMcpEntry[]>(selectedServers);
  const [activeTab, setActiveTab] = useState("builtin");

  // Config dialog state for market additions
  const [configTarget, setConfigTarget] = useState<OfficialServerDisplay | null>(null);

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalSelected(selectedServers);
      setActiveTab("builtin");
      setConfigTarget(null);
    }
  }, [open, selectedServers]);

  const isSelected = useCallback(
    (name: string) => localSelected.some((s) => s.name === name),
    [localSelected]
  );

  const addBuiltinEntry = useCallback((server: { name: string; type: "builtin" }) => {
    setLocalSelected((prev) => {
      if (prev.some((s) => s.name === server.name)) return prev;
      return [...prev, { name: server.name, type: server.type }];
    });
  }, []);

  const removeEntry = useCallback((name: string) => {
    setLocalSelected((prev) => prev.filter((s) => s.name !== name));
  }, []);

  const handleMarketAdd = useCallback((server: OfficialServerDisplay) => {
    setConfigTarget(server);
  }, []);

  const handleConfigConfirm = useCallback((entry: AgentMcpEntry) => {
    setLocalSelected((prev) => {
      const filtered = prev.filter((s) => s.name !== entry.name);
      return [...filtered, entry];
    });
    setConfigTarget(null);
  }, []);

  const handleSave = () => {
    onServersChange(localSelected);
    onOpenChange(false);
  };

  const hasChanges = JSON.stringify(localSelected) !== JSON.stringify(selectedServers);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Server className="h-4 w-4 text-primary" />
            </div>
            配置 MCP 服务
          </DialogTitle>
        </DialogHeader>

        <div className="px-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger
                value="builtin"
                className={cn(
                  "px-3 py-2 text-xs",
                  activeTab === "builtin" && "border-primary text-foreground"
                )}
              >
                内置
              </TabsTrigger>
              <TabsTrigger
                value="market"
                className={cn(
                  "px-3 py-2 text-xs",
                  activeTab === "market" && "border-primary text-foreground"
                )}
              >
                市场
              </TabsTrigger>
            </TabsList>

            {/* Tab: Built-in */}
            <TabsContent value="builtin" className="mt-3">
              <ScrollArea className="max-h-[320px]">
                <div className="space-y-2 pb-2">
                  {BUILTIN_SERVERS.map((server) => {
                    const selected = isSelected(server.name);
                    return (
                      <div
                        key={server.name}
                        className="rounded-lg border bg-card p-3 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-medium truncate">
                              {server.name}
                            </h4>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {server.description}
                            </p>
                          </div>
                          {selected ? (
                            <Badge variant="secondary" className="shrink-0">
                              <Check className="h-3 w-3 mr-1" />
                              已添加
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addBuiltinEntry(server)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              添加
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Show currently selected entries */}
                  {localSelected.length > 0 && (
                    <div className="pt-3 border-t mt-3">
                      <p className="text-xs text-muted-foreground mb-2">
                        已选择 ({localSelected.length})
                      </p>
                      {localSelected.map((entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center justify-between gap-2 p-2 rounded-md border mb-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-medium truncate block">
                              {entry.name}
                            </span>
                            {entry.url && (
                              <span className="text-[10px] text-muted-foreground truncate block">
                                {entry.url}
                              </span>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 shrink-0 mr-1"
                          >
                            {entry.type.toUpperCase()}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeEntry(entry.name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Tab: Market */}
            <TabsContent value="market" className="mt-3">
              <McpMarketList onAdd={handleMarketAdd} />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-6 pt-4 border-t bg-muted/30 mt-4">
          <div className="flex w-full items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              保存
              {hasChanges && localSelected.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5">
                  {localSelected.length}
                </Badge>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Config sub-dialog for market servers */}
      <McpServerConfigDialog
        open={configTarget !== null}
        onOpenChange={(v) => {
          if (!v) setConfigTarget(null);
        }}
        serverName={configTarget?.name ?? ""}
        serverDescription={configTarget?.description ?? undefined}
        onConfirm={handleConfigConfirm}
      />
    </Dialog>
  );
}
