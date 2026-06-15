/**
 * Agent MCP Configuration Dialog
 *
 * Dialog for configuring MCP servers for an agent.
 * Two-tab layout: Built-in and Market.
 * Unified "selected" section above tabs for clarity.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { Server, Plus, Check, Trash2, Loader2 } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type AgentMcpEntry } from "@/lib/gateway/types/agent";
import { McpMarketList } from "./mcp-market-list";
import { McpServerConfigDialog } from "./mcp-server-config-dialog";
import { useServiceKeys } from "@/hooks/use-service-keys";
import { getGatewayUrl } from "@/lib/gateway/config";
import type { OfficialServerDisplay } from "@/types/official-registry";

// Re-export the type for consumers
export type { AgentMcpEntry };

interface AgentMcpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedServers: AgentMcpEntry[];
  onServersChange: (servers: AgentMcpEntry[]) => void;
}

const BROWSE_MCP_PATH = "/api/mcp-server/browse";
const GUI_ACTION_MCP_PATH = "/api/mcp-server/gui-action";

interface BuiltinServerDef {
  name: string;
  description: string;
  needsApiKey?: boolean;
}

const BUILTIN_SERVERS: BuiltinServerDef[] = [
  { name: "browse-mcp", description: "搜索与浏览服务，支持多种数据源（需要 API Key）", needsApiKey: true },
  { name: "client-mcp", description: "端侧 GUI Action 工具，允许 Agent 操作桌面端界面" },
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

  // Browse MCP: API key selection
  const { keys, loading: keysLoading, getKeyById } = useServiceKeys();
  const [browseMcpKeyId, setBrowseMcpKeyId] = useState("");
  const [browseMcpKeyLoading, setBrowseMcpKeyLoading] = useState(false);

  // Sync local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalSelected(selectedServers);
      setActiveTab("builtin");
      setConfigTarget(null);
      setBrowseMcpKeyId("");
    }
  }, [open, selectedServers]);

  const isSelected = useCallback(
    (name: string) => localSelected.some((s) => s.name === name),
    [localSelected]
  );

  const selectedServerNames = useMemo(
    () => localSelected.map((s) => s.name),
    [localSelected]
  );

  const addBrowseMcpEntry = useCallback(async () => {
    if (!browseMcpKeyId) return;
    setBrowseMcpKeyLoading(true);
    try {
      const keyData = await getKeyById(browseMcpKeyId);
      if (!keyData?.key) return;
      const gatewayUrl = getGatewayUrl();
      const browseMcpUrl = `${gatewayUrl}${BROWSE_MCP_PATH}`;
      const entry: AgentMcpEntry = {
        name: "browse-mcp",
        type: "http",
        url: browseMcpUrl,
        headers: { Authorization: `Bearer ${keyData.key}` },
      };
      setLocalSelected((prev) => {
        const filtered = prev.filter((s) => s.name !== "browse-mcp");
        return [...filtered, entry];
      });
    } finally {
      setBrowseMcpKeyLoading(false);
    }
  }, [browseMcpKeyId, getKeyById]);

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

  const hasChanges = useMemo(() => {
    if (localSelected.length !== selectedServers.length) return true;
    const origMap = new Map(selectedServers.map((s) => [s.name, s]));
    return localSelected.some((s) => {
      const orig = origMap.get(s.name);
      return !orig || JSON.stringify(s) !== JSON.stringify(orig);
    });
  }, [localSelected, selectedServers]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Server className="h-4 w-4 text-primary" />
            </div>
            配置 MCP 服务
            {localSelected.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {localSelected.length} 已选
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>选择内置服务或从市场添加 MCP 服务器</DialogDescription>
        </DialogHeader>

        {/* Unified selected servers section (above tabs) */}
        {localSelected.length > 0 && (
          <div className="px-6 pb-3 border-b">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                已选择
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {localSelected.map((entry) => (
                <div
                  key={entry.name}
                  className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 group"
                >
                  <span className="text-xs font-medium truncate max-w-[160px]">
                    {entry.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 shrink-0"
                  >
                    {entry.type.toUpperCase()}
                  </Badge>
                  <button
                    type="button"
                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                    onClick={() => removeEntry(entry.name)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-6 flex-1 min-h-0 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mt-3">
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
            <TabsContent value="builtin" className="mt-3 flex-1 min-h-0 overflow-hidden">
              <div className="max-h-[320px] overflow-y-auto">
                <div className="space-y-2 pb-2">
                  {BUILTIN_SERVERS.map((server) => {
                    const selected = isSelected(server.name);
                    return (
                      <div
                        key={server.name}
                        className={cn(
                          "rounded-lg border p-3 space-y-2 transition-colors",
                          selected
                            ? "border-primary/50 bg-primary/5"
                            : "bg-card hover:border-muted-foreground/30"
                        )}
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
                          ) : !server.needsApiKey ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const gatewayUrl = getGatewayUrl();
                                const entry: AgentMcpEntry = {
                                  name: server.name,
                                  type: "http",
                                  url: `${gatewayUrl}${GUI_ACTION_MCP_PATH}`,
                                };
                                setLocalSelected((prev) => {
                                  if (prev.some((s) => s.name === server.name)) return prev;
                                  return [...prev, entry];
                                });
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              添加
                            </Button>
                          ) : null}
                        </div>
                        {/* Browse MCP: API Key selector */}
                        {server.needsApiKey && !selected && (
                          <div className="space-y-2 pt-1">
                            <Label className="text-xs text-muted-foreground">
                              选择 API Key
                            </Label>
                            {keysLoading ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                加载中...
                              </div>
                            ) : keys.length === 0 ? (
                              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                请先在 MCP 服务页面创建 API Key
                              </p>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Select
                                  value={browseMcpKeyId}
                                  onValueChange={setBrowseMcpKeyId}
                                >
                                  <SelectTrigger className="h-8 text-sm flex-1">
                                    <SelectValue placeholder="选择 API Key" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {keys.map((key) => (
                                      <SelectItem key={key.id} value={key.id}>
                                        {key.name} ({key.key_prefix})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={addBrowseMcpEntry}
                                  disabled={!browseMcpKeyId || browseMcpKeyLoading}
                                >
                                  {browseMcpKeyLoading ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                  ) : (
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                  )}
                                  添加
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* Tab: Market */}
            <TabsContent value="market" className="mt-3 flex-1 min-h-0 overflow-hidden">
              <McpMarketList
                onAdd={handleMarketAdd}
                selectedServerNames={selectedServerNames}
              />
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
        serverData={configTarget ?? undefined}
        onConfirm={handleConfigConfirm}
      />
    </Dialog>
  );
}
