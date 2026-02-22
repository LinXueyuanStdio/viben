/**
 * Command Detail Page - File-based editor
 *
 * Two-column layout following skill-detail pattern:
 * - Left: File tree showing command file(s)
 * - Right: Overview + Code editor
 *
 * Route: /command/:commandId?workspace_path=...&executor_type=...
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Command,
  Loader2,
  Terminal,
  FolderOpen,
  FileText,
  Code,
  Copy,
  Check,
  File,
  ExternalLink,
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
  buildWorkspaceUrl,
  useConfigFileContent,
  useConfigFileWriter,
  useConfigFiles,
  getParentDir,
} from "@/hooks";
import { useWorkspaceCommands } from "@/hooks/use-agent-configs";
import { useTranslation } from "react-i18next";
import { FileTree, CodeEditor } from "@/components/skill-files";
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
        <p className="font-medium text-sm font-mono">{value}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

type SelectedItem = { type: "overview" } | { type: "file"; entry: SkillFileEntry };

export function CommandDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { commandId } = useParams<{ commandId: string }>();

  // Get workspace and executor from query params
  const workspacePathParam = searchParams.get("workspace_path");
  const executorType = searchParams.get("executor_type") || "CLAUDE_CODE";
  const { workspacePath, workspace } = useWorkspaceParam({});

  // Use workspace_path from query params if provided
  const effectiveWorkspacePath = workspacePathParam || workspacePath;

  // Load commands
  const { commands, loading } = useWorkspaceCommands(
    effectiveWorkspacePath || null,
    executorType
  );

  // Find the specific command
  const command = commands.find((c) => c.id === commandId);

  // File operations
  const commandDir = command?.path ? getParentDir(command.path) : null;
  const { files, loading: filesLoading, error: filesError, loadFiles } = useConfigFiles(commandDir);
  const { content: fileContent, loading: fileLoading, error: fileError, readFile, clearContent } = useConfigFileContent();
  const { saveStatus, writeFile, resetStatus } = useConfigFileWriter();

  // UI state
  const [selected, setSelected] = useState<SelectedItem>({ type: "overview" });
  const [copied, setCopied] = useState(false);

  // Load files when command path changes
  useEffect(() => {
    if (commandDir) {
      loadFiles(3);
    }
  }, [commandDir, loadFiles]);

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
    const url = buildWorkspaceUrl(
      `/executor/${executorType}`,
      effectiveWorkspacePath || undefined
    );
    navigate(url);
  };

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

  if (!command) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Command className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("settingsAgents.commandNotFound", "Command Not Found")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("settingsAgents.commandNotFoundDesc", "The requested command could not be found.")}
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
          segments={[
            {
              label: executorType,
              href: buildWorkspaceUrl(`/executor/${executorType}`, effectiveWorkspacePath || undefined),
            },
            {
              label: `/${command.id}`,
              href: "#",
            },
          ]}
          showRefresh={false}
          showRemove={false}
        />
      ) : (
        <div className="p-4 border-b flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleNavigateBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Command className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="font-semibold font-mono">/{command.id}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Terminal className="h-3 w-3 mr-1" />
                  {t("settingsAgents.slashCommand", "Slash Command")}
                </Badge>
                {command.namespace && (
                  <Badge variant="secondary" className="text-xs">
                    {command.namespace}
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
            <Command className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">/{command.id}</span>
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
              {command.path && <div className="border-t my-2" />}

              {/* File Tree */}
              {command.path && (
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
            <CommandOverview command={command} onCopy={handleCopy} copied={copied} />
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
// Command Overview Component
// ============================================================================

interface CommandOverviewProps {
  command: {
    id: string;
    namespace: string;
    name: string;
    path: string;
    content: string;
  };
  onCopy: (text: string) => void;
  copied: boolean;
}

function CommandOverview({ command, onCopy, copied }: CommandOverviewProps) {
  const { t } = useTranslation();

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
            <Command className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold font-mono">/{command.id}</h1>
            <p className="text-muted-foreground mt-1">
              {t("settingsAgents.slashCommand", "Slash Command")}
            </p>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <InfoCard
            icon={<FolderOpen className="h-4 w-4" />}
            label={t("settingsAgents.namespace", "Namespace")}
            value={command.namespace || "-"}
          />
          <InfoCard
            icon={<Code className="h-4 w-4" />}
            label={t("settingsAgents.usage", "Usage")}
            value={`/${command.id}`}
          />
        </div>

        {/* Path */}
        {command.path && (
          <div className="mb-6 space-y-2">
            <h3 className="text-sm font-medium">{t("workspace.configPath", "Config Path")}</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">
                {command.path}
              </code>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => onCopy(command.path)}
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
              <a href={`file://${getParentDir(command.path)}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                {t("workspace.openInFinder")}
              </a>
            </Button>
          </div>
        )}

        {/* Content Preview */}
        {command.content && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t("settingsAgents.commandContent", "Command Content")}</h3>
            <div className="relative">
              <pre className="text-xs bg-muted/50 p-4 rounded-lg font-mono whitespace-pre-wrap max-h-64 overflow-auto">
                {command.content.slice(0, 500)}
                {command.content.length > 500 && "..."}
              </pre>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => onCopy(command.content)}
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("common.copy")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.editInFilesTab", "Select a file from the sidebar to edit the full content.")}
            </p>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 rounded-xl bg-muted/30 border">
          <p className="text-xs text-muted-foreground">
            {t("settingsAgents.commandDesc", "Slash commands are shortcuts that expand into predefined prompts or actions. They help automate common tasks and ensure consistent interactions with AI agents.")}
          </p>
        </div>
      </div>
    </ScrollArea>
  );
}
