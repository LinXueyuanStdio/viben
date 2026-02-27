/**
 * Agent Memory Dialog
 *
 * Dialog for viewing and editing agent memory files (MEMORY.md, logs).
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Save,
  RefreshCw,
  Loader2,
  FolderOpen,
  Brain,
  Calendar,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import { getGatewayClient } from "@/lib/gateway";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AgentMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
}

export function AgentMemoryDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
}: AgentMemoryDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = React.useState("memory");
  const [memoryContent, setMemoryContent] = React.useState("");
  const [originalMemoryContent, setOriginalMemoryContent] = React.useState("");
  const [todayLogContent, setTodayLogContent] = React.useState("");
  const [yesterdayLogContent, setYesterdayLogContent] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const isDirty = memoryContent !== originalMemoryContent;

  // Load memory files when dialog opens
  React.useEffect(() => {
    if (open) {
      loadMemoryFiles();
    }
  }, [open, agentId]);

  const getMemoryPath = () => {
    // Expand ~ to home directory
    return `~/.viben/agents/${agentId}/memory`;
  };

  const loadMemoryFiles = async () => {
    setLoading(true);
    try {
      const client = getGatewayClient();
      const memoryDir = getMemoryPath();

      // Read MEMORY.md
      try {
        const result = await client.readFile(`${memoryDir}/MEMORY.md`);
        setMemoryContent(result.content);
        setOriginalMemoryContent(result.content);
      } catch {
        setMemoryContent("");
        setOriginalMemoryContent("");
      }

      // Read today's log
      const today = new Date().toISOString().split("T")[0];
      try {
        const result = await client.readFile(`${memoryDir}/logs/${today}.md`);
        setTodayLogContent(result.content);
      } catch {
        setTodayLogContent("");
      }

      // Read yesterday's log
      const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      try {
        const result = await client.readFile(`${memoryDir}/logs/${yesterday}.md`);
        setYesterdayLogContent(result.content);
      } catch {
        setYesterdayLogContent("");
      }
    } catch (err) {
      console.error("Failed to load memory files:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMemory = async () => {
    setSaving(true);
    try {
      const client = getGatewayClient();
      const memoryDir = getMemoryPath();
      await client.writeFile(`${memoryDir}/MEMORY.md`, memoryContent);
      setOriginalMemoryContent(memoryContent);
    } catch (err) {
      console.error("Failed to save memory:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const client = getGatewayClient();
      const memoryDir = getMemoryPath();
      await client.revealFile(memoryDir);
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  };

  const handleCopyPath = async () => {
    const path = getMemoryPath();
    await navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCharCount = (content: string) => {
    return content.length.toLocaleString();
  };

  const getLineCount = (content: string) => {
    return content.split('\n').length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] p-0 gap-0 flex flex-col">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            {t("settingsAgents.memoryTitle")} - {agentName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">
              {getMemoryPath()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopyPath}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="px-6 shrink-0">
            <TabsList className="grid w-full grid-cols-3 h-9">
              <TabsTrigger value="memory" className="text-xs gap-1.5">
                <Brain className="h-3.5 w-3.5" />
                MEMORY.md
                {isDirty && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                    *
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="today" className="text-xs gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {t("settingsAgents.todayLog")}
              </TabsTrigger>
              <TabsTrigger value="yesterday" className="text-xs gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {t("settingsAgents.yesterdayLog")}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 px-6 py-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
              </div>
            ) : (
              <>
                <TabsContent value="memory" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{t("settingsAgents.editableMemory", { defaultValue: "Editable persistent memory" })}</span>
                    <span>{getCharCount(memoryContent)} chars • {getLineCount(memoryContent)} lines</span>
                  </div>
                  <Textarea
                    value={memoryContent}
                    onChange={(e) => setMemoryContent(e.target.value)}
                    placeholder={t("settingsAgents.memoryPlaceholder")}
                    className="flex-1 min-h-[300px] font-mono text-sm resize-none"
                  />
                </TabsContent>

                <TabsContent value="today" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{new Date().toLocaleDateString()}</span>
                    {todayLogContent && (
                      <span>{getCharCount(todayLogContent)} chars • {getLineCount(todayLogContent)} lines</span>
                    )}
                  </div>
                  <ScrollArea className="flex-1 min-h-[300px] rounded-md border bg-muted/30">
                    {todayLogContent ? (
                      <pre className="p-4 text-sm whitespace-pre-wrap font-mono">
                        {todayLogContent}
                      </pre>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <FileText className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">{t("settingsAgents.noLogToday")}</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="yesterday" className="h-full mt-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>{new Date(Date.now() - 86400000).toLocaleDateString()}</span>
                    {yesterdayLogContent && (
                      <span>{getCharCount(yesterdayLogContent)} chars • {getLineCount(yesterdayLogContent)} lines</span>
                    )}
                  </div>
                  <ScrollArea className="flex-1 min-h-[300px] rounded-md border bg-muted/30">
                    {yesterdayLogContent ? (
                      <pre className="p-4 text-sm whitespace-pre-wrap font-mono">
                        {yesterdayLogContent}
                      </pre>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <FileText className="h-10 w-10 mb-3 opacity-30" />
                        <p className="text-sm">{t("settingsAgents.noLogYesterday")}</p>
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>

        <DialogFooter className="p-6 pt-4 border-t bg-muted/30 shrink-0">
          <div className="flex w-full items-center justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleOpenFolder}>
                <FolderOpen className="h-4 w-4 mr-2" />
                {t("logs.openFolder")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadMemoryFiles}
                disabled={loading}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                {t("common.refresh")}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t("common.close")}
              </Button>
              {activeTab === "memory" && (
                <Button onClick={handleSaveMemory} disabled={saving || !isDirty}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {t("common.save")}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
