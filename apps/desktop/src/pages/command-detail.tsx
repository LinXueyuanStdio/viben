/**
 * Command Detail Page
 *
 * Displays detailed information about a slash command including:
 * - Command name and namespace
 * - Description and usage
 * - Source location
 *
 * Route: /command/:commandId?workspace_path=...&executor_type=...
 */
import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Command,
  Loader2,
  Terminal,
  FolderOpen,
  Globe,
  Copy,
  Check,
  FileText,
  Code,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useWorkspaceParam,
  buildWorkspaceUrl,
} from "@/hooks";
import { useWorkspaceCommands } from "@/hooks/use-agent-configs";
import { useTranslation } from "react-i18next";

// ============================================================================
// Collapsible Section Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  badge,
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
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-6 pr-1 pb-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Main Component
// ============================================================================

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

  // Copy state
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNavigateBack = () => {
    const url = buildWorkspaceUrl(
      `/executor/${executorType}`,
      effectiveWorkspacePath || undefined
    );
    navigate(url);
  };

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

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border">
            <div className="h-14 w-14 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Command className="h-7 w-7 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold font-mono">/{command.id}</h1>
              {command.description && (
                <p className="text-muted-foreground mt-1">{command.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  <Terminal className="h-3 w-3 mr-1" />
                  {t("settingsAgents.slashCommand", "Slash Command")}
                </Badge>
                {command.namespace && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {command.namespace}
                  </Badge>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs gap-1">
                        {command.source === "workspace" ? (
                          <FolderOpen className="h-3 w-3" />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {command.source === "workspace"
                        ? t("settingsAgents.workspaceConfig")
                        : t("settingsAgents.globalConfig")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Usage Section */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              {t("settingsAgents.usage", "Usage")}
            </h4>

            <CollapsibleSection
              title={t("settingsAgents.howToUse", "How to Use")}
              icon={<Code className="h-4 w-4" />}
              defaultOpen
            >
              <div className="py-2 space-y-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm bg-muted px-3 py-2 rounded font-mono">
                    /{command.id}
                  </code>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => handleCopy(`/${command.id}`)}
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
                  {t("settingsAgents.commandUsageHint", "Type this command in the chat input to invoke it.")}
                </p>
              </div>
            </CollapsibleSection>
          </div>

          {/* Details Section */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              {t("workspace.details", "Details")}
            </h4>

            {/* Namespace */}
            {command.namespace && (
              <CollapsibleSection
                title={t("settingsAgents.namespace", "Namespace")}
                icon={<FolderOpen className="h-4 w-4" />}
                defaultOpen
              >
                <div className="py-2">
                  <code className="text-sm bg-muted px-3 py-2 rounded font-mono block">
                    {command.namespace}
                  </code>
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("settingsAgents.namespaceHint", "Commands are organized by namespace for better discoverability.")}
                  </p>
                </div>
              </CollapsibleSection>
            )}

            {/* Path */}
            {command.path && (
              <CollapsibleSection
                title={t("workspace.configPath", "Source Path")}
                icon={<FileText className="h-4 w-4" />}
              >
                <div className="py-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                      {command.path}
                    </code>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleCopy(command.path!)}
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
                </div>
              </CollapsibleSection>
            )}
          </div>

          {/* Content Section */}
          {command.content && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                {t("settingsAgents.commandContent", "Command Content")}
              </h4>

              <CollapsibleSection
                title={t("settingsAgents.promptTemplate", "Prompt Template")}
                icon={<FileText className="h-4 w-4" />}
                defaultOpen
              >
                <div className="py-2">
                  <div className="relative">
                    <pre className="text-xs bg-muted/50 p-4 rounded-lg font-mono whitespace-pre-wrap max-h-96 overflow-auto">
                      {command.content}
                    </pre>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7"
                            onClick={() => handleCopy(command.content!)}
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
                </div>
              </CollapsibleSection>
            </div>
          )}

          {/* Info Section */}
          <div className="p-4 rounded-xl bg-muted/30 border">
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.commandDesc", "Slash commands are shortcuts that expand into predefined prompts or actions. They help automate common tasks and ensure consistent interactions with AI agents.")}
            </p>
          </div>
        </div>
      </ScrollArea>
    </PageWrapper>
  );
}
