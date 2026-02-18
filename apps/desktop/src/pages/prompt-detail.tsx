/**
 * Prompt Detail Page (Agent Config)
 *
 * Displays detailed information about an agent prompt/config including:
 * - Name, description, model
 * - System prompt content
 * - Associated settings
 *
 * Route: /prompt/:configId?workspace_path=...&executor_type=...
 */
import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquare,
  Loader2,
  FileText,
  Cpu,
  Settings2,
  Globe,
  FolderOpen,
  Copy,
  Check,
  Sparkles,
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
import { useWorkspaceAgentConfigs } from "@/hooks/use-agent-configs";
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

export function PromptDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { configId } = useParams<{ configId: string }>();

  // Get workspace and executor from query params
  const workspacePathParam = searchParams.get("workspace_path");
  const executorType = searchParams.get("executor_type") || "CLAUDE_CODE";
  const { workspacePath, workspace } = useWorkspaceParam({});

  // Use workspace_path from query params if provided
  const effectiveWorkspacePath = workspacePathParam || workspacePath;

  // Load agent configs (prompts)
  const { configs, loading } = useWorkspaceAgentConfigs(
    effectiveWorkspacePath || null,
    executorType
  );

  // Find the specific config
  const config = configs.find((c) => c.id === configId);

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

  if (!config) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("settingsAgents.promptNotFound", "Prompt Not Found")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("settingsAgents.promptNotFoundDesc", "The requested prompt configuration could not be found.")}
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
              label: config.name,
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
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h1 className="font-semibold">{config.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {t("settingsAgents.prompt", "Prompt")}
                </Badge>
                {config.model && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    {config.model}
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
            <div className="h-14 w-14 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
              <FileText className="h-7 w-7 text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{config.name}</h1>
              {config.description && (
                <p className="text-muted-foreground mt-1">{config.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {t("settingsAgents.prompt", "Prompt")}
                </Badge>
                {config.model && (
                  <Badge variant="secondary" className="text-xs font-mono">
                    <Cpu className="h-3 w-3 mr-1" />
                    {config.model}
                  </Badge>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs gap-1">
                        {config.source === "workspace" ? (
                          <FolderOpen className="h-3 w-3" />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {config.source === "workspace"
                        ? t("settingsAgents.workspaceConfig")
                        : t("settingsAgents.globalConfig")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>

          {/* Configuration Section */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              {t("workspace.configuration")}
            </h4>

            {/* Model */}
            {config.model && (
              <CollapsibleSection
                title={t("settingsAgents.model", "Model")}
                icon={<Cpu className="h-4 w-4" />}
                defaultOpen
              >
                <div className="py-2">
                  <code className="text-sm bg-muted px-3 py-2 rounded font-mono block">
                    {config.model}
                  </code>
                </div>
              </CollapsibleSection>
            )}

            {/* Temperature */}
            {config.temperature !== undefined && (
              <CollapsibleSection
                title={t("settingsAgents.temperature", "Temperature")}
                icon={<Settings2 className="h-4 w-4" />}
                badge={<Badge variant="secondary" className="text-xs">{config.temperature}</Badge>}
              >
                <div className="py-2">
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.temperatureHint")}
                  </p>
                </div>
              </CollapsibleSection>
            )}

            {/* Path */}
            {config.path && (
              <CollapsibleSection
                title={t("workspace.configPath", "Config Path")}
                icon={<FolderOpen className="h-4 w-4" />}
              >
                <div className="py-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                      {config.path}
                    </code>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleCopy(config.path!)}
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

          {/* System Prompt Section */}
          {config.system_prompt && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                {t("settingsAgents.systemPrompt")}
              </h4>

              <CollapsibleSection
                title={t("settingsAgents.promptContent", "Prompt Content")}
                icon={<MessageSquare className="h-4 w-4" />}
                defaultOpen
              >
                <div className="py-2">
                  <div className="relative">
                    <pre className="text-xs bg-muted/50 p-4 rounded-lg font-mono whitespace-pre-wrap max-h-96 overflow-auto">
                      {config.system_prompt}
                    </pre>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-7 w-7"
                            onClick={() => handleCopy(config.system_prompt!)}
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

          {/* Skills Section */}
          {config.skills && config.skills.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                {t("chat.skills")}
              </h4>

              <CollapsibleSection
                title={t("settingsAgents.associatedSkills", "Associated Skills")}
                icon={<Sparkles className="h-4 w-4" />}
                badge={<Badge variant="secondary" className="text-xs">{config.skills.length}</Badge>}
                defaultOpen
              >
                <div className="py-2 space-y-1">
                  {config.skills.map((skill) => (
                    <div
                      key={skill}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                    >
                      <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
                      <span className="truncate">{skill}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          )}

          {/* Info Section */}
          <div className="p-4 rounded-xl bg-muted/30 border">
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.promptDesc", "Prompts are pre-configured agent configurations that define system prompts, model settings, and associated skills. They can be used to quickly set up agents for specific tasks.")}
            </p>
          </div>
        </div>
      </ScrollArea>
    </PageWrapper>
  );
}
