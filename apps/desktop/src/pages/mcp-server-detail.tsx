/**
 * MCP Server Detail Page
 *
 * Displays detailed information about an MCP server including:
 * - Server name and transport type
 * - Configuration (command, args, env)
 * - Available tools
 *
 * Route: /mcp-server/:serverName?workspace_path=...&executor_type=...
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Server,
  Loader2,
  Database,
  Terminal,
  Settings2,
  Wrench,
  Globe,
  FolderOpen,
  ExternalLink,
  Copy,
  Check,
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
  useWorkspaceMcpServers,
} from "@/hooks";
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

export function McpServerDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
          segments={[
            {
              label: executorType,
              href: buildWorkspaceUrl(`/executor/${executorType}`, effectiveWorkspacePath || undefined),
            },
            {
              label: server.name,
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
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Server className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="font-semibold">{server.name}</h1>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  <Database className="h-3 w-3 mr-1" />
                  MCP
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

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-3xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border">
            <div className="h-14 w-14 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <Server className="h-7 w-7 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{server.name}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  <Database className="h-3 w-3 mr-1" />
                  MCP Server
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
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs gap-1">
                        {server.source === "workspace" ? (
                          <FolderOpen className="h-3 w-3" />
                        ) : (
                          <Globe className="h-3 w-3" />
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {server.source === "workspace"
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

            {/* Command */}
            {server.command && (
              <CollapsibleSection
                title={t("settingsAgents.command", "Command")}
                icon={<Terminal className="h-4 w-4" />}
                defaultOpen
              >
                <div className="py-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                      {server.command}
                    </code>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleCopy(server.command!)}
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

            {/* Args */}
            {server.args && server.args.length > 0 && (
              <CollapsibleSection
                title={t("settingsAgents.arguments", "Arguments")}
                icon={<Settings2 className="h-4 w-4" />}
                badge={<Badge variant="secondary" className="text-xs">{server.args.length}</Badge>}
                defaultOpen
              >
                <div className="py-2 space-y-1">
                  {server.args.map((arg, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50 font-mono"
                    >
                      <span className="text-muted-foreground w-6">{index}:</span>
                      <span className="truncate">{arg}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Environment Variables */}
            {server.env && Object.keys(server.env).length > 0 && (
              <CollapsibleSection
                title={t("settingsAgents.environment", "Environment")}
                icon={<Globe className="h-4 w-4" />}
                badge={<Badge variant="secondary" className="text-xs">{Object.keys(server.env).length}</Badge>}
              >
                <div className="py-2 space-y-1">
                  {Object.entries(server.env).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-start gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
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
              </CollapsibleSection>
            )}

            {/* URL (for SSE transport) */}
            {server.url && (
              <CollapsibleSection
                title={t("settingsAgents.url", "URL")}
                icon={<ExternalLink className="h-4 w-4" />}
                defaultOpen
              >
                <div className="py-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                      {server.url}
                    </code>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleCopy(server.url!)}
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

          {/* Tools Section */}
          {server.tools && server.tools.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                {t("settingsAgents.tools", "Tools")}
              </h4>

              <CollapsibleSection
                title={t("settingsAgents.availableTools", "Available Tools")}
                icon={<Wrench className="h-4 w-4" />}
                badge={<Badge variant="secondary" className="text-xs">{server.tools.length}</Badge>}
                defaultOpen
              >
                <div className="py-2 space-y-1">
                  {server.tools.map((tool) => (
                    <div
                      key={tool}
                      className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                    >
                      <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-mono truncate">{tool}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </div>
          )}

          {/* Info Section */}
          <div className="p-4 rounded-xl bg-muted/30 border">
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.mcpServerDesc", "MCP (Model Context Protocol) servers provide additional tools and capabilities to AI agents. This server is configured for the selected executor.")}
            </p>
          </div>
        </div>
      </ScrollArea>
    </PageWrapper>
  );
}
