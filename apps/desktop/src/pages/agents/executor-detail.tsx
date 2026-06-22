/**
 * Executor Detail Page - Read-only executor configuration viewer
 *
 * Three-column layout for viewing executor configurations:
 * - Left: CLAUDE.md content (System Prompt)
 * - Middle: Configuration & Capabilities (MCP, Skills, Prompts, Commands)
 * - Right: Chat Preview & Debug
 *
 * Route: /executor/:executorType?workspace_path=...
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  FileText,
  Globe,
  FolderOpen,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import {
  useWorkspaceParam,
  useExecutors,
} from "@/hooks";
import { useAgentConversation } from "@/pages/conversation/hooks/use-agent-conversation";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import {
  resolveHeaderSegments,
} from "@/navigation/page-index";
import { buildColdStartBreadcrumb, registry } from "@/navigation/navigate";
import { getGatewayClient } from "@/lib/gateway";
import { getExecutorIcon } from "@/lib/model-icons";
import { DesktopMessageList, DesktopChatInput, ExecutorCapabilities } from "@/pages/conversation/components";
import { SubagentSheet } from "@viben/chat";
import type { SlashCommand, AgentMessage as ChatAgentMessage } from "@viben/chat";
import { OpenClawConfigSection } from "@/components/agent/openclaw-config-section";
import { ResizeHandle, CollapsibleSection } from "./components";
import { getExecutorColor } from "./utils";
import {
  MIN_LEFT_PANEL_WIDTH,
  MAX_LEFT_PANEL_WIDTH,
  DEFAULT_LEFT_PANEL_WIDTH,
  MIN_RIGHT_PANEL_WIDTH,
  MAX_RIGHT_PANEL_WIDTH,
  DEFAULT_RIGHT_PANEL_WIDTH,
} from "./types";

// ============================================================================
// Main Component
// ============================================================================

export function ExecutorDetailPage() {
  const { t } = useTranslation();
  const { executorType, workspaceId } = useParams<{ executorType: string; workspaceId?: string }>();
  const { currentStack, openSettings, openWorkspaceSection } = useDesktopRouting();

  // Get workspace from query params (new routing) or path params (legacy routing)
  const { workspacePath, workspace } = useWorkspaceParam({ workspaceId });

  // Load executors for this workspace
  const {
    executors,
    loading: executorsLoading,
  } = useExecutors({ workspacePath: workspacePath || undefined });

  // Find the executor by type
  const executor = useMemo(() => {
    if (!executorType) return null;
    const found = executors.find((e) => e.type === executorType);
    if (!found) return null;

    // Transform to expected format
    return {
      id: found.type,
      name: found.name,
      type: found.type,
      config_path: found.workspace_config_path || "",
      global_config_path: found.global_config_path,
      mcp_config_file: null,
      skills_config_file: null,
    };
  }, [executors, executorType]);

  // State for CLAUDE.md content
  const [claudeMdContent, setClaudeMdContent] = useState<string>("");
  const [claudeMdLoading, setClaudeMdLoading] = useState(true);
  const [claudeMdError, setClaudeMdError] = useState<string | null>(null);

  // OpenClaw config state (for testing connection; per-agent config is saved via agent settings)
  const [openclawConfig, setOpenclawConfig] = useState<Record<string, unknown>>({
    gateway: { host: "127.0.0.1", port: 18789 },
  });

  // Load CLAUDE.md content
  useEffect(() => {
    async function loadClaudeMd() {
      if (!workspacePath) {
        setClaudeMdLoading(false);
        return;
      }

      setClaudeMdLoading(true);
      setClaudeMdError(null);

      try {
        // Try different possible locations for CLAUDE.md
        const possiblePaths = [
          `${workspacePath}/CLAUDE.md`,
          `${workspacePath}/.claude/CLAUDE.md`,
          `${workspacePath}/claude.md`,
        ];

        let content = "";
        for (const path of possiblePaths) {
          try {
            content = await readTextFile(path);
            if (content) break;
          } catch {
            // File doesn't exist, try next path
          }
        }

        setClaudeMdContent(content);
      } catch (err) {
        setClaudeMdError(err instanceof Error ? err.message : String(err));
      } finally {
        setClaudeMdLoading(false);
      }
    }

    loadClaudeMd();
  }, [workspacePath]);

  // Chat functionality
  const executorTypeString = useMemo((): string => {
    if (executorType === "CLAUDE_CODE") return "CLAUDE_CODE";
    if (executorType === "CODEX") return "CODEX";
    return "CLAUDE_CODE";
  }, [executorType]);

  const {
    messages,
    phase,
    isStreaming,
    pendingPlan,
    pendingQuestions,
    sendMessage,
    approvePlan,
    rejectPlan,
    answerQuestions,
    cancel,
    clearMessages,
  } = useAgentConversation(workspacePath || "", {
    agentConfig: {
      executor_type: executorTypeString,
      permission_mode: "default",
    },
  });

  // Panel width state for resizable panels
  const [leftPanelWidth, setLeftPanelWidth] = useState(DEFAULT_LEFT_PANEL_WIDTH);
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH);

  // Resize handlers
  const handleLeftResize = useCallback((delta: number) => {
    setLeftPanelWidth((prev) =>
      Math.max(MIN_LEFT_PANEL_WIDTH, Math.min(MAX_LEFT_PANEL_WIDTH, prev + delta))
    );
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightPanelWidth((prev) =>
      Math.max(MIN_RIGHT_PANEL_WIDTH, Math.min(MAX_RIGHT_PANEL_WIDTH, prev + delta))
    );
  }, []);

  // Get executor config folder path
  const executorFolderPath = useMemo(() => {
    if (executor?.config_path) {
      const parts = executor.config_path.split("/");
      parts.pop();
      return parts.join("/");
    }
    return workspacePath || "";
  }, [executor?.config_path, workspacePath]);

  // Open folder in file manager
  const handleOpenFolder = useCallback(async () => {
    if (!executorFolderPath) return;
    try {
      const client = getGatewayClient();
      await client.revealFile(executorFolderPath);
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  }, [executorFolderPath]);

  // Navigation back
  const handleNavigateBack = useCallback(() => {
    if (workspace) {
      openWorkspaceSection(workspace.id, "agent");
    } else {
      openSettings("executors");
    }
  }, [openSettings, openWorkspaceSection, workspace]);

  // Slash commands for executor chat
  const slashCommands = useMemo<SlashCommand[]>(() => [
    {
      name: "clear",
      description: t("chat.slashCommands.clearDesc", "Clear conversation history"),
      input: null,
    },
  ], [t]);

  // Handle slash command execution
  const handleSlashCommand = useCallback((command: SlashCommand) => {
    if (command.name === "clear") {
      clearMessages();
    }
  }, [clearMessages]);

  // Subagent sheet state (uses @viben/chat's AgentMessage type for SubagentSheet compatibility)
  const [sheetData, setSheetData] = useState<{
    title: string;
    subagentType?: string;
    messages: ChatAgentMessage[];
  } | null>(null);

  // Loading state
  if (executorsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Executor not found
  if (!executor) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-3 opacity-50" />
        <p>{t("settingsExecutors.notFound")}</p>
        <Button variant="outline" className="mt-4" onClick={handleNavigateBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
      </div>
    );
  }

  // Get executor colors
  const executorColor = getExecutorColor(executor.type);

  const headerSegments = resolveHeaderSegments({
    stack: currentStack,
    fallback:
      workspace && executor
        ? buildColdStartBreadcrumb(
            registry.build("/workspace/:workspaceId/executor/:executorType", {
              workspaceId: workspace.id,
              executorType: executor.type,
            }),
            { label: executor.name, icon: { type: "lucide", value: "terminal" } }
          ).slice(1).map((item) => ({
            id: item.id,
            label: item.label,
            href: item.href ?? "#",
            icon: item.icon,
            meta: item.meta,
          }))
        : [],
  });

  // Determine config source
  return (
    <>
    {/* Subagent Sheet (side panel) */}
    <SubagentSheet
      open={!!sheetData}
      onClose={() => setSheetData(null)}
      title={sheetData?.title || ""}
      subagentType={sheetData?.subagentType}
      messages={sheetData?.messages || []}
      onExpandSubagent={(title, subagentType, msgs) =>
        setSheetData({ title, subagentType, messages: msgs })
      }
    />
    <PageWrapper className="h-full flex flex-col">
      {/* Breadcrumb Header */}
      {workspace ? (
        <WorkspaceHeader
          workspace={workspace}
          segments={headerSegments}
          showRefresh={false}
          showRemove={false}
          rightContent={
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleOpenFolder}
                    disabled={!executorFolderPath}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("settingsAgents.openFolder")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          }
        />
      ) : (
        <div className="flex items-center justify-between p-4 border-b bg-muted/10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleNavigateBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarFallback className={cn(executorColor.bg, executorColor.text, "flex items-center justify-center")}>
                {getExecutorIcon(executor.type, { size: 20 })}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">{executor.name}</h1>
              <Badge variant="secondary" className="text-xs font-mono">
                {executor.type}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleOpenFolder}
                    disabled={!executorFolderPath}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t("settingsAgents.openFolder")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}

      {/* Three Column Layout */}
      <div className="flex-1 flex min-h-0">
        {/* ================================================================
            LEFT COLUMN: CLAUDE.md Content (System Prompt) - Resizable
            ================================================================ */}
        <div
          className="relative flex flex-col shrink-0"
          style={{ width: leftPanelWidth }}
        >
          <div className="h-10 flex items-center p-4 border-b">
            <h3 className="font-semibold text-sm">{t("settingsAgents.systemPrompt")}<span className="text-xs text-muted-foreground ml-1">CLAUDE.md</span></h3>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {claudeMdLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : claudeMdError ? (
                <div className="text-xs text-destructive">
                  {claudeMdError}
                </div>
              ) : claudeMdContent ? (
                <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground bg-muted/30 p-3 rounded-lg">
                  {claudeMdContent}
                </pre>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.noClaudeMd")}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {t("settingsAgents.noClaudeMdHint")}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>

          <ResizeHandle side="left" onResize={handleLeftResize} />
        </div>

        {/* ================================================================
            MIDDLE COLUMN: Configuration & Capabilities
            ================================================================ */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          <div className="h-10 flex items-center p-4 border-b">
            <h3 className="font-semibold text-sm">{t("settingsAgents.capabilities")}</h3>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-1">
              {/* Config Section */}
              {(executor.config_path?.trim() || executor.global_config_path?.trim()) && (
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    {t("workspace.configuration")}
                  </h4>

                  {/* Workspace Config */}
                  {executor.config_path?.trim() && (
                    <CollapsibleSection
                      title={t("settingsAgents.workspaceConfig")}
                      icon={<FolderOpen className="h-4 w-4" />}
                      defaultOpen
                    >
                      <div className="py-2">
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                            {executor.config_path}
                          </code>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={handleOpenFolder}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("common.openInExplorer")}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* Global Config */}
                  {executor.global_config_path?.trim() && (
                    <CollapsibleSection
                      title={t("settingsAgents.globalConfig")}
                      icon={<Globe className="h-4 w-4" />}
                      defaultOpen={!executor.config_path?.trim()}
                    >
                      <div className="py-2">
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                            {executor.global_config_path}
                          </code>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 shrink-0"
                                  onClick={async () => {
                                    try {
                                      const dir = executor.global_config_path!.replace(/\/[^/]+$/, "");
                                      const client = getGatewayClient();
                                      await client.revealFile(dir);
                                    } catch (err) {
                                      console.error("Failed to open folder:", err);
                                    }
                                  }}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("common.openInExplorer")}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}
                </div>
              )}

              {/* OpenClaw Connection Config */}
              {executorType === "OPENCLAW" && (
                <div className="mb-4">
                  <OpenClawConfigSection
                    config={openclawConfig}
                    onConfigChange={setOpenclawConfig}
                  />
                </div>
              )}

              {/* Capabilities Section - using reusable component */}
              <ExecutorCapabilities
                executorType={executorType || ""}
                workspacePath={workspacePath || ""}
                className="mb-4"
                sectionHeaderText={t("settingsAgents.tools")}
              />

              {/* Info Section */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("common.overview")}
                </h4>

                <div className="p-3 rounded-xl bg-muted/50 border">
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.executorsDesc")}
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* ================================================================
            RIGHT COLUMN: Chat Preview - Resizable
            ================================================================ */}
        <div
          className="relative flex flex-col bg-muted/30 shrink-0"
          style={{ width: rightPanelWidth }}
        >
          <ResizeHandle side="right" onResize={handleRightResize} />
          {/* Header with actions */}
          <div className="h-10 p-4 border-b flex items-center justify-between">
            <div className="flex items-center">
              <Avatar className="h-4 w-4">
                <AvatarFallback className={cn(executorColor.bg, executorColor.text, "flex items-center justify-center")}>
                  {getExecutorIcon(executor.type, { size: 20 })}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-sm">
                {executor.name}
                <span className="ml-4 text-xs text-muted-foreground">{t("settingsAgents.previewDebug")}</span>
              </h3>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={clearMessages}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("settingsAgents.clearChat")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Chat Messages */}
          <DesktopMessageList
            messages={messages}
            isStreaming={isStreaming}
            pendingPlan={pendingPlan}
            pendingQuestions={pendingQuestions}
            onApprovePlan={approvePlan}
            onRejectPlan={rejectPlan}
            onAnswerQuestions={answerQuestions}
            className="flex-1 min-w-0 overflow-hidden"
            maxMessageWidth="820px"
            onExpandSubagent={(title, subagentType, msgs) =>
              setSheetData({ title, subagentType, messages: msgs })
            }
          />

          {/* Chat Input */}
          <div className="border-t border-border bg-background">
            <DesktopChatInput
              onSend={sendMessage}
              onCancel={cancel}
              isLoading={isStreaming}
              disabled={phase === "awaiting_approval" || phase === "awaiting_input"}
              placeholder={
                phase === "awaiting_approval"
                  ? t("chat.waitingForApproval")
                  : phase === "awaiting_input"
                    ? t("chat.waitingForInput")
                    : t("settingsAgents.sendMessage")
              }
              autoFocus
              showResizeHandle
              slashCommands={slashCommands}
              onSlashCommand={handleSlashCommand}
            />
          </div>
        </div>
      </div>
    </PageWrapper>
    </>
  );
}
