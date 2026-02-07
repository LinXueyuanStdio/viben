/**
 * Settings Agents Page - Agent Overview with Detail Panel
 *
 * 全局工作空间智能体列表：
 * - 左侧：执行器列表 + 智能体列表
 * - 右侧：详情面板（只读）
 * - 点击"编排"按钮跳转到全局工作空间的编排页面
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Star,
  Loader2,
  AlertCircle,
  Bot,
  ArrowRight,
  Terminal,
  Sparkles,
  Search,
  Settings2,
  MoreHorizontal,
  Server,
  Database,
  MessageSquare,
  Command,
  FileText,
  Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useUnifiedAgents } from "@/hooks/use-unified-agents";
import {
  useLocalWorkspaces,
  useWorkspaceMcpServers,
  useWorkspaceSkills,
} from "@/hooks/use-workspaces";
import {
  useWorkspaceAgentConfigs,
  useWorkspaceCommands,
} from "@/hooks/use-agent-configs";
import type { UnifiedAgent } from "@/types/unified-agent";
import { ChevronDown, ChevronRight } from "lucide-react";

// ============================================================================
// Collapsible Section Component
// ============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function CollapsibleSection({
  title,
  icon,
  badge,
  children,
  defaultOpen = false,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b last:border-b-0">
      <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-1 hover:bg-muted/50 rounded-lg transition-colors">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-sm font-medium">{title}</span>
          {badge}
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pb-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettingsAgentsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Get the global workspace ID
  const { workspaces } = useLocalWorkspaces();
  const globalWorkspace = workspaces.find((w) => w.type === "global");

  // Unified agents - include both executors and agents
  const {
    executors,
    agents,
    defaultAgentId,
    loading,
    error,
  } = useUnifiedAgents({
    workspaceId: globalWorkspace?.id || null,
    includeAgents: true,
    includeExecutors: true,
  });

  // UI State
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemType, setSelectedItemType] = useState<"executor" | "agent">("agent");
  const [searchQuery, setSearchQuery] = useState("");

  // All items combined
  const allItems = useMemo(() => [...executors, ...agents], [executors, agents]);

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return { executors, agents };
    const query = searchQuery.toLowerCase();
    return {
      executors: executors.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query)
      ),
      agents: agents.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          a.description?.toLowerCase().includes(query)
      ),
    };
  }, [executors, agents, searchQuery]);

  // Selected item
  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null;
    return allItems.find((a) => a.id === selectedItemId) || null;
  }, [allItems, selectedItemId]);

  // Auto-select first item
  useEffect(() => {
    if (!selectedItemId && allItems.length > 0) {
      const first = allItems[0];
      setSelectedItemId(first.id);
      setSelectedItemType(first.role);
    }
  }, [allItems, selectedItemId]);

  // Navigate to orchestration page
  const handleNavigateToOrchestration = (item: UnifiedAgent) => {
    if (globalWorkspace) {
      navigate(`/workspace/${globalWorkspace.id}/agent/${item.id}`);
    } else if (item.role === "agent") {
      navigate(`/agents/${item.id}`);
    }
  };

  // Navigate to workspace agents page
  const handleGoToWorkspace = () => {
    if (globalWorkspace) {
      navigate(`/workspace/${globalWorkspace.id}/agents`);
    } else {
      navigate("/mcp-services/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold font-serif">{t("settingsAgents.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("settingsAgents.description")}
            </p>
          </div>
          <Button onClick={handleGoToWorkspace}>
            {t("settingsAgents.goToWorkspace")}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-6 mt-4 p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Main Content - Split Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: List */}
        <div className="w-80 border-r flex flex-col bg-muted/20">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("common.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            {allItems.length === 0 ? (
              <div className="p-6 text-center">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {t("settingsAgents.noAgents")}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleGoToWorkspace}
                  className="mt-2"
                >
                  {t("settingsAgents.goToWorkspace")}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {/* Executors Section */}
                {filteredItems.executors.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 flex items-center gap-2">
                      <Terminal className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("settingsAgents.executors")}
                      </span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                        {filteredItems.executors.length}
                      </Badge>
                    </div>
                    {filteredItems.executors.map((item) => (
                      <div
                        key={`executor-${item.id}`}
                        className={cn(
                          "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all",
                          selectedItemId === item.id && selectedItemType === "executor"
                            ? "bg-orange-500/10 border border-orange-500/30 shadow-sm"
                            : "hover:bg-muted/60 border border-transparent"
                        )}
                        onClick={() => {
                          setSelectedItemId(item.id);
                          setSelectedItemType("executor");
                        }}
                      >
                        <Avatar className="h-11 w-11 shrink-0 ring-2 ring-orange-500/20">
                          <AvatarFallback
                            className={cn(
                              "text-sm font-semibold",
                              selectedItemId === item.id && selectedItemType === "executor"
                                ? "bg-orange-500/20 text-orange-600"
                                : "bg-orange-500/10 text-orange-600/70"
                            )}
                          >
                            {item.name.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium truncate text-sm">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-orange-500/30 text-orange-600">
                              <Terminal className="h-2.5 w-2.5 mr-0.5" />
                              {item.executorType}
                            </Badge>
                          </div>
                        </div>
                        {/* Actions on hover */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleNavigateToOrchestration(item)}>
                              <Settings2 className="h-4 w-4 mr-2" />
                              {t("settingsAgents.configuration")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ))}
                  </>
                )}

                {/* Separator */}
                {filteredItems.executors.length > 0 && filteredItems.agents.length > 0 && (
                  <Separator className="my-2" />
                )}

                {/* Agents Section */}
                {filteredItems.agents.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 flex items-center gap-2">
                      <Sparkles className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {t("settingsAgents.agents")}
                      </span>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-auto">
                        {filteredItems.agents.length}
                      </Badge>
                    </div>
                    {filteredItems.agents.map((item) => {
                      const isDefault = item.id === defaultAgentId;

                      return (
                        <div
                          key={`agent-${item.id}`}
                          className={cn(
                            "group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all",
                            selectedItemId === item.id && selectedItemType === "agent"
                              ? "bg-primary/10 border border-primary/30 shadow-sm"
                              : "hover:bg-muted/60 border border-transparent"
                          )}
                          onClick={() => {
                            setSelectedItemId(item.id);
                            setSelectedItemType("agent");
                          }}
                        >
                          {/* Default indicator */}
                          {isDefault && (
                            <div className="absolute -top-1 -right-1 z-10">
                              <div className="bg-yellow-500 rounded-full p-0.5 shadow-sm">
                                <Star className="h-2.5 w-2.5 text-white fill-white" />
                              </div>
                            </div>
                          )}

                          <Avatar className="h-11 w-11 shrink-0 ring-2 ring-primary/20">
                            <AvatarFallback
                              className={cn(
                                "text-sm font-semibold",
                                selectedItemId === item.id && selectedItemType === "agent"
                                  ? "bg-primary/20 text-primary"
                                  : "bg-primary/10 text-primary/70"
                              )}
                            >
                              {item.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium truncate text-sm">{item.name}</span>
                            </div>
                            {item.description ? (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.description}
                              </p>
                            ) : (
                              <div className="flex items-center gap-1.5 mt-1">
                                {isDefault && (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                    {t("common.default")}
                                  </Badge>
                                )}
                                {item.model && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                    {item.model.split("/").pop() || item.model}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {item.description && (
                              <div className="flex items-center gap-1.5 mt-1">
                                {isDefault && (
                                  <Badge className="text-[9px] px-1.5 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                                    {t("common.default")}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                          {/* Actions on hover */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleNavigateToOrchestration(item)}>
                                <Settings2 className="h-4 w-4 mr-2" />
                                {t("settingsAgents.configuration")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedItem ? (
            <DetailPanel
              item={selectedItem}
              isDefault={selectedItem.id === defaultAgentId}
              workspaceId={globalWorkspace?.id || ""}
              onNavigateToOrchestration={() => handleNavigateToOrchestration(selectedItem)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Bot className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p>{t("settingsAgents.selectAgent")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Detail Panel Component
// ============================================================================

interface DetailPanelProps {
  item: UnifiedAgent;
  isDefault: boolean;
  workspaceId: string;
  onNavigateToOrchestration: () => void;
}

function DetailPanel({
  item,
  isDefault,
  workspaceId,
  onNavigateToOrchestration,
}: DetailPanelProps) {
  const { t } = useTranslation();
  const isExecutor = item.role === "executor";

  // Load data for executor
  const { servers: mcpServers, loading: mcpLoading } = useWorkspaceMcpServers(
    isExecutor ? workspaceId : null,
    isExecutor ? item.id : null
  );
  const { skills, loading: skillsLoading } = useWorkspaceSkills(
    isExecutor ? workspaceId : null,
    isExecutor ? item.id : null
  );
  const { configs: agentConfigs, loading: configsLoading } = useWorkspaceAgentConfigs(
    isExecutor ? workspaceId : null,
    isExecutor ? item.id : null
  );
  const { commands, loading: commandsLoading } = useWorkspaceCommands(
    isExecutor ? workspaceId : null,
    isExecutor ? item.id : null
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className={cn(
        "p-6 border-b",
        isExecutor ? "bg-orange-500/5" : "bg-muted/10"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className={cn(
                "text-xl font-semibold",
                isExecutor
                  ? "bg-orange-500/20 text-orange-600"
                  : "bg-primary/20 text-primary"
              )}>
                {item.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{item.name}</h2>
                {isDefault && (
                  <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full">
                    <Star className="h-3 w-3 fill-current" />
                    {t("common.default")}
                  </span>
                )}
                <Badge variant="outline" className={cn(
                  "text-xs",
                  isExecutor ? "border-orange-500/30 text-orange-600" : ""
                )}>
                  {isExecutor ? (
                    <>
                      <Terminal className="h-3 w-3 mr-1" />
                      {t("settingsAgents.executors")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      {t("settingsAgents.agents")}
                    </>
                  )}
                </Badge>
              </div>
              {item.description && (
                <p className="text-muted-foreground text-sm mt-1">
                  {item.description}
                </p>
              )}
              {isExecutor && item.executorType && (
                <p className="text-muted-foreground text-sm mt-1">
                  {item.executorType}
                </p>
              )}
            </div>
          </div>
          <Button onClick={onNavigateToOrchestration}>
            <Settings2 className="h-4 w-4 mr-2" />
            {t("settingsAgents.configuration")}
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-1">
          {isExecutor ? (
            // Executor detail
            <>
              {/* Config Section */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("workspace.configuration")}
                </h4>

                <CollapsibleSection
                  title={t("workspace.configPath")}
                  icon={<Terminal className="h-4 w-4" />}
                  defaultOpen
                >
                  <code className="block text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                    {item.configPath || "-"}
                  </code>
                </CollapsibleSection>
              </div>

              {/* Capabilities Section */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("settingsAgents.capabilities")}
                </h4>

                {/* MCP */}
                <CollapsibleSection
                  title="MCP"
                  icon={<Database className="h-4 w-4" />}
                  badge={
                    mcpLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Badge variant="secondary" className="text-xs">{mcpServers.length}</Badge>
                    )
                  }
                  defaultOpen
                >
                  <div className="py-2 space-y-1">
                    {mcpServers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("settingsAgents.noMcp")}
                      </p>
                    ) : (
                      mcpServers.map((server) => (
                        <div
                          key={server.name}
                          className={cn(
                            "flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50",
                            server.disabled && "opacity-60"
                          )}
                        >
                          <Server className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{server.name}</span>
                          {server.transport && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                              {server.transport}
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleSection>

                {/* Skills */}
                <CollapsibleSection
                  title={t("chat.skills")}
                  icon={<Sparkles className="h-4 w-4" />}
                  badge={
                    skillsLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Badge variant="secondary" className="text-xs">{skills.length}</Badge>
                    )
                  }
                >
                  <div className="py-2 space-y-1">
                    {skills.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("settingsAgents.noSkills")}
                      </p>
                    ) : (
                      skills.map((skill) => (
                        <div
                          key={skill.id}
                          className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                        >
                          <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{skill.name}</span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                            v{skill.version}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleSection>

                {/* Prompts */}
                <CollapsibleSection
                  title={t("settingsAgents.prompts")}
                  icon={<MessageSquare className="h-4 w-4" />}
                  badge={
                    configsLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Badge variant="secondary" className="text-xs">{agentConfigs.length}</Badge>
                    )
                  }
                >
                  <div className="py-2 space-y-1">
                    {agentConfigs.length === 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {t("settingsAgents.noPrompts")}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          {t("settingsAgents.noPromptsHint")}
                        </p>
                      </>
                    ) : (
                      agentConfigs.map((config) => (
                        <div
                          key={config.id}
                          className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                        >
                          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{config.name}</span>
                          {config.model && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto shrink-0">
                              {config.model}
                            </Badge>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleSection>

                {/* Commands */}
                <CollapsibleSection
                  title={t("settingsAgents.commands")}
                  icon={<Command className="h-4 w-4" />}
                  badge={
                    commandsLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Badge variant="secondary" className="text-xs">{commands.length}</Badge>
                    )
                  }
                >
                  <div className="py-2 space-y-1">
                    {commands.length === 0 ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {t("settingsAgents.noCommands")}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70">
                          {t("settingsAgents.noCommandsHint")}
                        </p>
                      </>
                    ) : (
                      commands.map((command) => (
                        <div
                          key={command.id}
                          className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                        >
                          <Command className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate font-mono">/{command.id}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                            {command.namespace}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CollapsibleSection>
              </div>

              {/* Info */}
              <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                <p className="text-xs text-muted-foreground">
                  {t("settingsAgents.executorsDesc")}
                </p>
              </div>
            </>
          ) : (
            // Agent detail
            <>
              {/* Model Section */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("settingsAgents.modelSettings")}
                </h4>

                <CollapsibleSection
                  title={t("workspace.createTaskDialog.model")}
                  icon={<Sparkles className="h-4 w-4" />}
                  badge={
                    item.model && (
                      <Badge variant="secondary" className="text-xs">
                        {item.model.split("/").pop() || item.model}
                      </Badge>
                    )
                  }
                  defaultOpen
                >
                  <div className="py-2">
                    {item.model ? (
                      <p className="text-sm">{item.model}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("common.notConfigured")}
                      </p>
                    )}
                    {item.provider && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Provider: {item.provider}
                      </p>
                    )}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title={t("settingsAgents.temperature")}
                  icon={<Settings2 className="h-4 w-4" />}
                  badge={
                    <Badge variant="secondary" className="text-xs">
                      {(item.temperature ?? 0.7).toFixed(2)}
                    </Badge>
                  }
                >
                  <div className="py-2">
                    <p className="text-xs text-muted-foreground">
                      {t("settingsAgents.temperatureHint")}
                    </p>
                  </div>
                </CollapsibleSection>
              </div>

              {/* System Prompt Section */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("settingsAgents.persona")}
                </h4>

                <CollapsibleSection
                  title={t("settingsAgents.systemPrompt")}
                  icon={<MessageSquare className="h-4 w-4" />}
                  defaultOpen
                >
                  <div className="py-2">
                    {item.systemPrompt ? (
                      <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-lg max-h-48 overflow-auto">
                        {item.systemPrompt}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        {t("settingsAgents.systemPromptPlaceholder")}
                      </p>
                    )}
                  </div>
                </CollapsibleSection>
              </div>

              {/* Capabilities Section */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("settingsAgents.capabilities")}
                </h4>

                <CollapsibleSection
                  title="MCP"
                  icon={<Database className="h-4 w-4" />}
                  badge={
                    <Badge variant="secondary" className="text-xs">
                      {item.mcpServers?.length || 0}
                    </Badge>
                  }
                >
                  <div className="py-2">
                    {item.mcpServers && item.mcpServers.length > 0 ? (
                      <div className="space-y-1">
                        {item.mcpServers.map((server) => (
                          <div
                            key={server}
                            className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                          >
                            <Server className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{server}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("settingsAgents.noMcp")}
                      </p>
                    )}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection
                  title={t("chat.skills")}
                  icon={<Sparkles className="h-4 w-4" />}
                  badge={
                    <Badge variant="secondary" className="text-xs">
                      {item.skills?.length || 0}
                    </Badge>
                  }
                >
                  <div className="py-2">
                    {item.skills && item.skills.length > 0 ? (
                      <div className="space-y-1">
                        {item.skills.map((skill) => (
                          <div
                            key={skill}
                            className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted/50"
                          >
                            <Sparkles className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{skill}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("settingsAgents.noSkills")}
                      </p>
                    )}
                  </div>
                </CollapsibleSection>
              </div>

              {/* Memory Section */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                  {t("settingsAgents.memory")}
                </h4>

                <CollapsibleSection
                  title="MEMORY.md"
                  icon={<Brain className="h-4 w-4" />}
                >
                  <p className="text-xs text-muted-foreground py-2">
                    {t("settingsAgents.memoryDesc")}
                  </p>
                </CollapsibleSection>
              </div>

              {/* Timestamps */}
              {(item.createdAt || item.updatedAt) && (
                <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
                  {item.createdAt && (
                    <p>
                      {t("common.created")}: {new Date(item.createdAt).toLocaleString()}
                    </p>
                  )}
                  {item.updatedAt && (
                    <p>
                      {t("workspace.updated")}: {new Date(item.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
