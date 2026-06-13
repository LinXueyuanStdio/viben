/**
 * MCP Server Config Dialog
 *
 * Sub-dialog for configuring a single MCP server's connection parameters.
 */
import { useState, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AgentMcpEntry } from "@/lib/gateway/types/agent";

interface McpServerConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverName: string;
  serverDescription?: string;
  onConfirm: (entry: AgentMcpEntry) => void;
}

interface KeyValuePair {
  key: string;
  value: string;
}

type TransportType = "http" | "sse" | "stdio";

export function McpServerConfigDialog({
  open,
  onOpenChange,
  serverName,
  serverDescription,
  onConfirm,
}: McpServerConfigDialogProps) {
  const [transportType, setTransportType] = useState<TransportType>("http");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<KeyValuePair[]>([]);
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");

  const resetForm = useCallback(() => {
    setTransportType("http");
    setUrl("");
    setHeaders([]);
    setCommand("");
    setArgs("");
  }, []);

  const handleConfirm = () => {
    const entry: AgentMcpEntry = {
      name: serverName,
      type: transportType,
    };

    if (transportType === "stdio") {
      if (command.trim()) entry.command = command.trim();
      if (args.trim()) {
        entry.args = args
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean);
      }
    } else {
      if (url.trim()) entry.url = url.trim();
      const headersObj = kvPairsToRecord(headers);
      if (Object.keys(headersObj).length > 0) entry.headers = headersObj;
    }

    onConfirm(entry);
    resetForm();
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) {
      resetForm();
    }
    onOpenChange(value);
  };

  const addHeader = () => {
    setHeaders((prev) => [...prev, { key: "", value: "" }]);
  };

  const updateHeader = (index: number, field: "key" | "value", val: string) => {
    setHeaders((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: val } : p))
    );
  };

  const removeHeader = (index: number) => {
    setHeaders((prev) => prev.filter((_, i) => i !== index));
  };

  const isValid =
    transportType === "stdio" ? command.trim().length > 0 : url.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-base">
            配置 {serverName}
          </DialogTitle>
          {serverDescription && (
            <p className="text-xs text-muted-foreground mt-1">
              {serverDescription}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Transport type */}
          <div className="space-y-1.5">
            <Label className="text-xs">传输类型</Label>
            <Select
              value={transportType}
              onValueChange={(v) => setTransportType(v as TransportType)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">Streamable HTTP</SelectItem>
                <SelectItem value="sse">SSE</SelectItem>
                <SelectItem value="stdio">stdio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* HTTP / SSE fields */}
          {(transportType === "http" || transportType === "sse") && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">URL</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/mcp"
                  className="h-8 text-sm"
                />
              </div>

              {/* Headers key-value editor */}
              <div className="space-y-1.5">
                <Label className="text-xs">Headers</Label>
                {headers.map((pair, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      value={pair.key}
                      onChange={(e) => updateHeader(idx, "key", e.target.value)}
                      placeholder="Key"
                      className="h-7 text-xs flex-1"
                    />
                    <Input
                      value={pair.value}
                      onChange={(e) => updateHeader(idx, "value", e.target.value)}
                      placeholder="Value"
                      className="h-7 text-xs flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeHeader(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={addHeader}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  添加 Header
                </Button>
              </div>
            </>
          )}

          {/* stdio fields */}
          {transportType === "stdio" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Command</Label>
                <Input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="npx @example/mcp-server"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Arguments (逗号分隔)</Label>
                <Input
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder="--port, 3000"
                  className="h-8 text-sm"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            确认添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function kvPairsToRecord(pairs: KeyValuePair[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    if (pair.key.trim()) {
      result[pair.key.trim()] = pair.value;
    }
  }
  return result;
}
