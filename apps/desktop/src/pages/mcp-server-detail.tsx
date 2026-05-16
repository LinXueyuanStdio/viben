/**
 * MCP Server Detail Page - File-based editor
 *
 * Two-column layout following skill-detail pattern:
 * - Left: File tree showing config file(s)
 * - Right: Overview + Code editor
 *
 * Route: /mcp-server/:serverName?workspace_path=...&executor_type=...
 */
import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Server,
  Loader2,
  Database,
  Terminal,
  Settings2,
  ExternalLink,
  Copy,
  Check,
  FileText,
  File,
} from "lucide-react";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useWorkspaceParam,
  useWorkspaceMcpServers,
  useConfigFileContent,
  useConfigFileWriter,
  useConfigFiles,
} from "@/hooks";
import { useDesktopRouting } from "@/hooks/use-desktop-routing";
import { useTranslation } from "react-i18next";
import { FileTree, CodeEditor } from "@/components/skill-files";
import {
  resolveHeaderSegments,
} from "@/navigation/page-index";
import { buildColdStartBreadcrumb, registry } from "@/navigation/navigate";
import type { SkillFileEntry } from "@/types";

// ============================================================================
// Info Card Component
// ============================================================================

interface InfoCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoCard({ icon, label, value }: InfoCardProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium text-sm">{value}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

type SelectedItem = { type: "overview" } | { type: "file"; entry: SkillFileEntry };

export function McpServerDetailPage() {
  const { t } = useTranslation();
  const { currentStack, openExecutorDetail } = useDesktopRouting();
  const [searchParams] = useSearchParams();
  const { serverName } = useParams<{ serverName: string }>();

  // Get workspace and executor from query params
  const workspacePathParam = searchParams.get("workspace_path");
  const executorType = searchParams.get("executor_type") || "CLAUDE_CODE";
  const { workspacePath, workspace } = useWorkspaceParam({});

  // Use workspace_path from query params if provided
  const effectiveWorkspacePath = workspacePathParam || workspacePath;

  // Load MCP servers
  const { servers, loading } = useWorkspaceMcpServers(
    effectiveWorkspacePath || null,
    executorType
  );

  // Find the specific server
  const server = servers.find((s) => s.name === serverName);

  // Compute config path based on executor type
  // For Claude Code, MCP config is in .claude/ or .mcp/
  const configDir = effectiveWorkspacePath
    ? `${effectiveWorkspacePath}/.claude`
    : null;
  const { files, loading: filesLoading, error: filesError, loadFiles } = useConfigFiles(configDir);
  const { content: fileContent, loading: fileLoading, error: fileError, readFile, clearContent } = useConfigFileContent();
  const { saveStatus, writeFile, resetStatus } = useConfigFileWriter();

  // UI state
  const [selected, setSelected] = useState<SelectedItem>({ type: "overview" });
  const [copied, setCopied] = useState(false);

  // Load files when config path changes
  useEffect(() => {
    if (configDir) {
      loadFiles(3);
    }
  }, [configDir, loadFiles]);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectOverview = () => {
    setSelected({ type: "overview" });
    clearContent();
    resetStatus();
  };

  const handleSelectFile = (entry: SkillFileEntry) => {
    setSelected({ type: "file", entry });
    resetStatus();
    if (!entry.is_directory) {
      readFile(entry.path);
    } else {
      clearContent();
    }
  };

  const handleSaveFile = async (content: string) => {
    if (selected.type === "file" && !selected.entry.is_directory) {
      await writeFile(selected.entry.path, content);
    }
  };

  const handleNavigateBack = () => {
    openExecutorDetail(
      executorType,
      effectiveWorkspacePath || undefined
    );
  };

  const headerSegments = resolveHeaderSegments({
    stack: currentStack,
    fallback:
      workspace && server
        ? buildColdStartBreadcrumb(
            registry.build("/mcp-server/:serverName", { serverName: server.name }) +
              `?workspace_path=${encodeURIComponent(effectiveWorkspacePath || "")}&executor_type=${encodeURIComponent(executorType)}`,
            { label: server.name, icon: { type: "lucide", value: "server" } }
          ).slice(1).map((item) => ({
            id: item.id,
            label: item.label,
            href: item.href ?? "#",
            icon: item.icon,
            meta: item.meta,
          }))
        : [],
  });

  const selectedFile = selected.type === "file" ? selected.entry : null;

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageWrapper>
    );
  }

  if (!server) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Server className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("settingsAgents.mcpNotFound", "MCP Server Not Found")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("settingsAgents.mcpNotFoundDesc", "The requested MCP server could not be found.")}
          </p>
          <Button onClick={handleNavigateBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Button>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      {/* Header */}
      {workspace ? (
        <WorkspaceHeader
          workspace={workspace}
          segments={headerSegments}
          showRefresh={false}
          showRemove={false}
        />
      ) : (
        <div className="p-4 border-b flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleNavigateBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Server className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="font-semibold">{server.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Database className="h-3 w-3 mr-1" />
                  {t("settingsAgents.mcp", "MCP")}
                </Badge>
                {server.transport && (
                  <Badge variant="secondary" className="text-xs">
                    {server.transport}
                  </Badge>
                )}
                {server.disabled && (
                  <Badge variant="destructive" className="text-xs">
                    {t("common.disabled")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - File Tree */}
        <div className="w-64 border-r flex flex-col bg-muted/30">
          <div className="p-3 border-b flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium truncate">{server.name}</span>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {/* Overview Entry */}
              <button
                onClick={handleSelectOverview}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left mb-1",
                  "hover:bg-accent transition-colors",
                  selected.type === "overview" && "bg-accent"
                )}
              >
                <FileText className="h-4 w-4 text-blue-500" />
                <span className="font-medium">{t("workspace.overview")}</span>
              </button>

              {/* Separator */}
              {configDir && <div className="border-t my-2" />}

              {/* File Tree */}
              {configDir && (
                filesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filesError ? (
                  <div className="p-2 text-sm text-muted-foreground">{filesError}</div>
                ) : (
                  <FileTree
                    files={files}
                    selectedPath={selectedFile?.path || null}
                    onSelectFile={handleSelectFile}
                  />
                )
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selected.type === "overview" ? (
            <McpServerOverview server={server} configDir={configDir} onCopy={handleCopy} copied={copied} />
          ) : selectedFile ? (
            <>
              <div className="p-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm font-mono truncate">{selectedFile.name}</span>
                </div>
                {!selectedFile.is_directory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 flex-shrink-0"
                    asChild
                  >
                    <a
                      href={`file://${selectedFile.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      {t("workspace.openInEditor")}
                    </a>
                  </Button>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                {selectedFile.is_directory ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p>{t("workspace.selectFile")}</p>
                  </div>
                ) : fileLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : fileError ? (
                  <div className="p-4 text-sm text-muted-foreground">{fileError}</div>
                ) : fileContent !== null ? (
                  <CodeEditor
                    value={fileContent}
                    filename={selectedFile.name}
                    height="100%"
                    onSave={handleSaveFile}
                    saveStatus={saveStatus}
                  />
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>{t("workspace.selectFileToView")}</p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}

// ============================================================================
// MCP Server Overview Component
// ============================================================================

interface McpServerOverviewProps {
  server: {
    name: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    transport?: string;
    headers?: Record<string, string>;
    disabled?: boolean;
  };
  configDir: string | null;
  onCopy: (text: string) => void;
  copied: boolean;
}

function McpServerOverview({ server, configDir, onCopy, copied }: McpServerOverviewProps) {
  const { t } = useTranslation();

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            <Server className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{server.name}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                {t("settingsAgents.mcpServer", "MCP Server")}
              </Badge>
              {server.transport && (
                <Badge variant="secondary" className="text-xs font-mono">
                  {server.transport}
                </Badge>
              )}
              {server.disabled && (
                <Badge variant="destructive" className="text-xs">
                  {t("common.disabled")}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <InfoCard
            icon={<Settings2 className="h-4 w-4" />}
            label={t("settingsAgents.transport", "Transport")}
            value={server.transport || "stdio"}
          />
          <InfoCard
            icon={<Terminal className="h-4 w-4" />}
            label={t("settingsAgents.command", "Command")}
            value={server.command || server.url || "-"}
          />
        </div>

        {/* Config Directory */}
        {configDir && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-medium">{t("workspace.configPath", "Config Directory")}</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">
                {configDir}
              </code>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => onCopy(configDir)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.copy")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={`file://${configDir}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                {t("workspace.openInFinder")}
              </a>
            </Button>
          </div>
        )}

        {/* Arguments */}
        {server.args && server.args.length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-medium">{t("settingsAgents.arguments", "Arguments")}</h3>
            <div className="space-y-1">
              {server.args.map((arg, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-md bg-muted/50 font-mono"
                >
                  <span className="text-muted-foreground w-6">{index}:</span>
                  <span className="truncate">{arg}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Environment Variables */}
        {server.env && Object.keys(server.env).length > 0 && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-medium">{t("settingsAgents.environment", "Environment Variables")}</h3>
            <div className="space-y-1">
              {Object.entries(server.env).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-start gap-2 text-xs px-3 py-2 rounded-md bg-muted/50"
                >
                  <span className="font-mono font-medium text-blue-600 dark:text-blue-400 shrink-0">
                    {key}
                  </span>
                  <span className="text-muted-foreground">=</span>
                  <span className="font-mono truncate">
                    {value.includes("***") ? "••••••••" : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* URL (for SSE transport) */}
        {server.url && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-medium">{t("settingsAgents.url", "URL")}</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">
                {server.url}
              </code>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => onCopy(server.url!)}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.copy")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 rounded-xl bg-muted/30 border">
          <p className="text-xs text-muted-foreground">
            {t("settingsAgents.mcpServerDesc", "MCP (Model Context Protocol) servers provide additional tools and capabilities to AI agents. This server is configured for the selected executor.")}
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
