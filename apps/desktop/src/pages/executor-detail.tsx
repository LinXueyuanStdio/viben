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
import * as React from "react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  FileText,
  Globe,
  FolderOpen,
  Trash2,
  Terminal,
  GripVertical,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  useWorkspaceParam,
  useExecutors,
  useAgentConversation,
} from "@/hooks";
import { getGatewayClient } from "@/lib/gateway";
import { MessageList, ChatInput, ExecutorCapabilities, type SlashCommand } from "@/components/chat";

// ============================================================================
// Panel Width Constants
// ============================================================================

const MIN_LEFT_PANEL_WIDTH = 200;
const MAX_LEFT_PANEL_WIDTH = 400;
const DEFAULT_LEFT_PANEL_WIDTH = 288; // w-72

const MIN_RIGHT_PANEL_WIDTH = 240;
const MAX_RIGHT_PANEL_WIDTH = 480;
const DEFAULT_RIGHT_PANEL_WIDTH = 320; // w-80

// ============================================================================
// Resize Handle Component
// ============================================================================

interface ResizeHandleProps {
  side: "left" | "right";
  onResize: (delta: number) => void;
  className?: string;
}

function ResizeHandle({ side, onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startXRef.current;
      startXRef.current = moveEvent.clientX;
      // For left panel, positive delta = expand; for right panel, negative delta = expand
      onResize(side === "left" ? delta : -delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className={cn(
        "group absolute top-0 bottom-0 w-1 cursor-col-resize z-10",
        "flex items-center justify-center",
        side === "left" ? "right-0" : "left-0",
        isDragging && "bg-primary/30",
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Hover/drag indicator line */}
      <div
        className={cn(
          "absolute inset-y-0 w-0.5 transition-colors",
          isDragging ? "bg-primary" : "bg-transparent group-hover:bg-border"
        )}
      />
      {/* Grip handle - vertically centered */}
      <div
        className={cn(
          "absolute flex items-center justify-center w-4 h-8 rounded-md transition-all",
          isDragging
            ? "bg-primary text-primary-foreground"
            : "bg-muted/80 text-muted-foreground opacity-0 group-hover:opacity-100"
        )}
      >
        <GripVertical className="h-4 w-4" />
      </div>
    </div>
  );
}

// ============================================================================
// Collapsible Section Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  badge,
  action,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={cn(
            "w-full flex items-center gap-2 py-2.5 px-1 text-sm hover:bg-muted/50 rounded-lg transition-colors",
            isOpen && "text-foreground",
            !isOpen && "text-muted-foreground"
          )}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="font-medium">{title}</span>
          {badge && <span className="ml-auto mr-2">{badge}</span>}
          {action && (
            <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
              {action}
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pr-1 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

// Get executor icon color based on type
function getExecutorColor(type: string) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    CLAUDE_CODE: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
    CODEX: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
    GEMINI_CLI: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
    AIDER: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-500/30" },
  };
  return colors[type] || { bg: "bg-muted", text: "text-foreground", border: "border-border" };
}

// ============================================================================
// Main Component
// ============================================================================

export function ExecutorDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { executorType, workspaceId } = useParams<{ executorType: string; workspaceId?: string }>();

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
            const { readTextFile } = await import("@tauri-apps/plugin-fs");
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
      executorType: executorTypeString,
      planMode: false,
      approvals: false,
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

  // Copy path state
  const [pathCopied, setPathCopied] = useState(false);

  // Get executor config folder path
  const executorFolderPath = useMemo(() => {
    if (executor?.config_path) {
      const parts = executor.config_path.split("/");
      parts.pop();
      return parts.join("/");
    }
    return workspacePath || "";
  }, [executor?.config_path, workspacePath]);

  // Copy path to clipboard
  const handleCopyPath = useCallback(async () => {
    if (!executorFolderPath) return;
    await navigator.clipboard.writeText(executorFolderPath);
    setPathCopied(true);
    setTimeout(() => setPathCopied(false), 2000);
  }, [executorFolderPath]);

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
      navigate(`/workspace/${workspace.id}/agents`);
    } else {
      navigate("/settings/executors");
    }
  }, [navigate, workspace]);

  // Slash commands for executor chat
  const slashCommands = useMemo<SlashCommand[]>(() => [
    {
      id: "clear",
      name: t("chat.slashCommands.clear", "clear"),
      description: t("chat.slashCommands.clearDesc", "Clear conversation history"),
      icon: <Trash2 className="h-4 w-4" />,
    },
  ], [t]);

  // Handle slash command execution
  const handleSlashCommand = useCallback((command: SlashCommand) => {
    if (command.id === "clear") {
      clearMessages();
    }
  }, [clearMessages]);

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
        <p>{t("settingsExecutors.notFound", "Executor not found")}</p>
        <Button variant="outline" className="mt-4" onClick={handleNavigateBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("common.back")}
        </Button>
      </div>
    );
  }

  // Get executor colors
  const executorColor = getExecutorColor(executor.type);

  // Determine config source
  const hasWorkspaceConfig = !!executor.config_path;
  const hasGlobalConfig = !!executor.global_config_path;
  const configSource = hasWorkspaceConfig && hasGlobalConfig
    ? "merged" as const
    : hasWorkspaceConfig
      ? "workspace" as const
      : "global" as const;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleNavigateBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className={cn(executorColor.bg, executorColor.text, "text-xs")}>
              {executor.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold">{executor.name}</h1>
              <Badge variant="secondary" className="text-xs font-mono">
                {executor.type}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs gap-1">
                      {configSource === "workspace" ? (
                        <FolderOpen className="h-3 w-3" />
                      ) : configSource === "global" ? (
                        <Globe className="h-3 w-3" />
                      ) : (
                        <>
                          <FolderOpen className="h-3 w-3" />
                          <span>+</span>
                          <Globe className="h-3 w-3" />
                        </>
                      )}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {configSource === "workspace"
                      ? t("settingsAgents.workspaceConfig")
                      : configSource === "global"
                        ? t("settingsAgents.globalConfig")
                        : t("settingsAgents.mergedConfig")}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {/* Path with copy button */}
            {executorFolderPath && (
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px] cursor-default">
                        {executorFolderPath.split("/").slice(-3).join("/")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[400px]">
                      <code className="text-xs break-all">{executorFolderPath}</code>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={handleCopyPath}
                      >
                        {pathCopied ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {pathCopied ? t("common.copied") : t("common.copyPath")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
          </div>
          <Badge variant="outline" className={cn("text-xs", executorColor.border, executorColor.text)}>
            <Terminal className="h-3 w-3 mr-1" />
            {t("settingsAgents.executors")}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* Open folder button */}
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

      {/* Three Column Layout */}
      <div className="flex-1 flex min-h-0">
        {/* ================================================================
            LEFT COLUMN: CLAUDE.md Content (System Prompt) - Resizable
            ================================================================ */}
        <div
          className="relative flex flex-col shrink-0"
          style={{ width: leftPanelWidth }}
        >
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">{t("settingsAgents.systemPrompt")}</h3>
            <p className="text-xs text-muted-foreground mt-1">CLAUDE.md</p>
          </div>
          <ResizeHandle side="left" onResize={handleLeftResize} />

          <ScrollArea className="flex-1">
            <div className="p-4">
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
        </div>

        {/* ================================================================
            MIDDLE COLUMN: Configuration & Capabilities
            ================================================================ */}
        <div className="flex-1 flex flex-col min-w-0 border-r">
          <div className="p-4 border-b">
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
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className={cn(executorColor.bg, executorColor.text, "text-xs")}>
                  {executor.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-sm">{executor.name}</h3>
                <p className="text-xs text-muted-foreground">{t("settingsAgents.previewDebug")}</p>
              </div>
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
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            pendingPlan={pendingPlan}
            pendingQuestions={pendingQuestions}
            onApprovePlan={approvePlan}
            onRejectPlan={rejectPlan}
            onAnswerQuestions={answerQuestions}
            className="flex-1"
          />

          {/* Chat Input */}
          <div className="border-t border-border bg-background">
            <ChatInput
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
              showTopToolbar
              showConfigBar
              showResizeHandle
              enableWritingMode
              hideAgentSelector
              hideModelSelector
              slashCommands={slashCommands}
              onSlashCommand={handleSlashCommand}
            />
            <p className="text-xs text-muted-foreground py-2 text-center">
              {t("settingsAgents.aiDisclaimer")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
