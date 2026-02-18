/**
 * Agent Detail Panel Component
 *
 * Displays detailed information about an agent with inline editing:
 * - Header with avatar, editable name/description, default badge
 * - Configuration section with config path
 * - Model settings with selector and temperature slider
 * - System prompt section with editing
 * - Capabilities section with MCP servers and skills
 * - Memory section
 * - Danger zone with set default and delete actions
 *
 * Used in workspace-agents page and workspace-chat right sidebar.
 */

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Settings2,
  Loader2,
  Database,
  Server,
  Sparkles,
  MessageSquare,
  Brain,
  Star,
  Trash2,
  Save,
  Pencil,
  Check,
  X,
  FolderOpen,
  Globe,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "./collapsible-section";
import { ExecutorCapabilities } from "./executor-capabilities";

// ============================================================================
// Types
// ============================================================================

export interface AgentDetailData {
  id: string;
  name: string;
  path?: string;
  description?: string;
  model?: string;
  provider?: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  mcp_servers?: string[];
  skills?: string[];
  created_at?: string;
  updated_at?: string;
  /** Executor type (e.g., "CLAUDE_CODE") for loading capabilities */
  executor_type?: string;
  /** Global config path */
  global_config_path?: string;
  /** Source of config: "global", "workspace", or "merged" */
  source?: "global" | "workspace" | "merged";
}

export interface ModelOption {
  id: string;
  name: string;
  /** Provider display name (provider_name from WorkspaceModel) */
  provider: string;
  /** Provider ID (provider_id from WorkspaceModel) */
  provider_id?: string;
  enabled?: boolean;
}

export interface AgentDetailPanelProps {
  /** Agent data to display */
  agent: AgentDetailData;
  /** Workspace path for loading capabilities */
  workspacePath?: string;
  /** Whether this is the default agent */
  isDefault?: boolean;
  /** Available models for selection */
  models?: ModelOption[];
  /** Called when agent is updated */
  onUpdate?: (id: string, updates: Record<string, unknown>) => Promise<unknown>;
  /** Called when set as default is requested */
  onSetDefault?: () => void;
  /** Called when delete is requested */
  onDelete?: () => void;
  /** Called when navigate to edit is requested */
  onNavigateToEdit?: () => void;
  /** Whether this is a workspace-scoped agent */
  isWorkspaceScoped?: boolean;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Whether to show the configuration button */
  showConfigButton?: boolean;
  /** Whether to show danger zone (set default / delete) */
  showDangerZone?: boolean;
  /** Custom class name */
  className?: string;
  /** Compact mode for sidebar display */
  compact?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AgentDetailPanel({
  agent,
  workspacePath = "",
  isDefault = false,
  models = [],
  onUpdate,
  onSetDefault,
  onDelete,
  onNavigateToEdit,
  isWorkspaceScoped = false,
  showHeader = true,
  showConfigButton = true,
  showDangerZone = true,
  className,
  compact = false,
}: AgentDetailPanelProps) {
  const { t } = useTranslation();

  // Get agent icon color based on executor type
  const getAgentColor = (executorType?: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      CLAUDE_CODE: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
      CODEX: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
      GEMINI_CLI: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
      AIDER: { bg: "bg-violet-500/10", text: "text-violet-600", border: "border-violet-500/30" },
    };
    return colors[executorType || ""] || { bg: "bg-primary/20", text: "text-primary", border: "border-primary/30" };
  };

  const agentColor = getAgentColor(agent.executor_type);

  // Helper to open path in system file explorer
  const openInExplorer = async (path: string) => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      const dir = path.replace(/\/[^/]+$/, "");
      await open(dir);
    } catch (err) {
      console.error("Failed to open in explorer:", err);
    }
  };

  // Inline editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editName, setEditName] = useState(agent.name);
  const [editDescription, setEditDescription] = useState(agent.description || "");
  const [editSystemPrompt, setEditSystemPrompt] = useState(agent.system_prompt || "");
  const [editTemperature, setEditTemperature] = useState(agent.temperature ?? 0.7);
  const [saving, setSaving] = useState(false);

  // Reset edit states when agent changes
  useEffect(() => {
    setEditName(agent.name);
    setEditDescription(agent.description || "");
    setEditSystemPrompt(agent.system_prompt || "");
    setEditTemperature(agent.temperature ?? 0.7);
    setEditingField(null);
  }, [agent.id, agent.name, agent.description, agent.system_prompt, agent.temperature]);

  const enabledModels = models.filter((m) => m.enabled !== false);
  const agentModel = models.find((m) => m.id === agent.model);

  const handleSave = async (field: string, value: unknown) => {
    if (!onUpdate) return;
    setSaving(true);
    try {
      await onUpdate(agent.id, { [field]: value });
      setEditingField(null);
    } catch (err) {
      console.error("Failed to update agent:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleModelChange = async (modelId: string) => {
    await handleSave("model", modelId);
  };

  return (
    <div className={cn("flex-1 flex flex-col overflow-hidden", className)}>
      {/* Header */}
      {showHeader && (
        <div className={cn("border-b bg-muted/10", compact ? "p-4" : "p-6")}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className={cn(compact ? "h-12 w-12" : "h-16 w-16")}>
                <AvatarFallback className={cn(agentColor.bg, agentColor.text, "text-xl font-semibold")}>
                  {agent.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                {/* Editable Name */}
                {editingField === "name" && onUpdate ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 text-lg font-semibold"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave("name", editName);
                        if (e.key === "Escape") setEditingField(null);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleSave("name", editName)}
                      disabled={saving}
                    >
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingField(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group flex-wrap">
                    <h2 className={cn("font-semibold", compact ? "text-lg" : "text-xl")}>
                      {agent.name}
                    </h2>
                    {isDefault && (
                      <span className="inline-flex items-center gap-1 text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full">
                        <Star className="h-3 w-3 fill-current" />
                        {t("common.default")}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      {t("settingsAgents.agents")}
                    </Badge>
                    {onUpdate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setEditingField("name")}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}
                {/* Executor type and source badges */}
                <div className="flex items-center gap-2 mt-1">
                  {agent.executor_type && (
                    <Badge variant="secondary" className="text-xs font-mono">
                      {agent.executor_type}
                    </Badge>
                  )}
                  {agent.source && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs gap-1">
                            {agent.source === "workspace" ? (
                              <FolderOpen className="h-3 w-3" />
                            ) : agent.source === "global" ? (
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
                          {agent.source === "workspace"
                            ? t("settingsAgents.workspaceConfig")
                            : agent.source === "global"
                              ? t("settingsAgents.globalConfig")
                              : t("settingsAgents.mergedConfig")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>

                {/* Editable Description */}
                {editingField === "description" && onUpdate ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="h-7 text-sm"
                      placeholder={t("settingsAgents.descriptionPlaceholder")}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSave("description", editDescription || null);
                        if (e.key === "Escape") setEditingField(null);
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleSave("description", editDescription || null)}
                      disabled={saving}
                    >
                      <Check className="h-3 w-3 text-green-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditingField(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group mt-1">
                    <p className="text-muted-foreground text-sm">
                      {agent.description || t("settingsAgents.descriptionPlaceholder")}
                    </p>
                    {onUpdate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => setEditingField("description")}
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {showConfigButton && onNavigateToEdit && (
              <Button onClick={onNavigateToEdit} size={compact ? "sm" : "default"}>
                <Settings2 className="h-4 w-4 mr-2" />
                {t("settingsAgents.configuration")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className={cn("space-y-1", compact ? "p-4" : "p-6")}>
          {/* Config Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {t("workspace.configuration")}
            </h4>

            {/* Workspace Config */}
            <CollapsibleSection
              title={t("settingsAgents.workspaceConfig")}
              icon={<FolderOpen className="h-4 w-4" />}
              defaultOpen={!!agent.path?.trim()}
            >
              <div className="py-2">
                {agent.path?.trim() ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                      {agent.path}
                    </code>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => openInExplorer(agent.path!)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.openInExplorer")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.noWorkspaceConfig")}
                  </p>
                )}
              </div>
            </CollapsibleSection>

            {/* Global Config */}
            <CollapsibleSection
              title={t("settingsAgents.globalConfig")}
              icon={<Globe className="h-4 w-4" />}
              defaultOpen={!!agent.global_config_path?.trim()}
            >
              <div className="py-2">
                {agent.global_config_path?.trim() ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded font-mono break-all">
                      {agent.global_config_path}
                    </code>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => openInExplorer(agent.global_config_path!)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("common.openInExplorer")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.noGlobalConfig")}
                  </p>
                )}
              </div>
            </CollapsibleSection>
          </div>

          {/* Model Section */}
          {models.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                {t("settingsAgents.modelSettings")}
              </h4>

              <CollapsibleSection
                title={t("workspace.createTaskDialog.model")}
                icon={<Sparkles className="h-4 w-4" />}
                badge={
                  agentModel && (
                    <Badge variant="secondary" className="text-xs">
                      {agentModel.name.split("/").pop() || agentModel.name}
                    </Badge>
                  )
                }
                defaultOpen
              >
                <div className="py-2">
                  <Select value={agent.model || ""} onValueChange={handleModelChange} disabled={!onUpdate}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder={t("settingsAgents.selectModel")}>
                        {agentModel ? (
                          <div className="flex items-center gap-2">
                            <span>{agentModel.name}</span>
                            <span className="text-xs text-muted-foreground">({agentModel.provider})</span>
                          </div>
                        ) : (
                          t("settingsAgents.selectModel")
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {enabledModels.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          {t("chat.noModels")}
                        </div>
                      ) : (
                        enabledModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            <div className="flex items-center gap-2">
                              <span>{model.name}</span>
                              <span className="text-xs text-muted-foreground">({model.provider})</span>
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {agent.provider && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Provider: {agent.provider}
                    </p>
                  )}
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title={t("settingsAgents.temperature")}
                icon={<Settings2 className="h-4 w-4" />}
                badge={
                  <Badge variant="secondary" className="text-xs">
                    {(agent.temperature ?? 0.7).toFixed(2)}
                  </Badge>
                }
              >
                <div className="py-2 space-y-3">
                  <Slider
                    value={[editingField === "temperature" ? editTemperature : (agent.temperature ?? 0.7)]}
                    min={0}
                    max={2}
                    step={0.01}
                    disabled={!onUpdate}
                    onValueChange={([val]) => {
                      setEditTemperature(val);
                      setEditingField("temperature");
                    }}
                    onValueCommit={([val]) => handleSave("temperature", val)}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("settingsAgents.temperatureHint")}
                  </p>
                </div>
              </CollapsibleSection>
            </div>
          )}

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
                {editingField === "system_prompt" && onUpdate ? (
                  <div className="space-y-3">
                    <Textarea
                      value={editSystemPrompt}
                      onChange={(e) => setEditSystemPrompt(e.target.value)}
                      placeholder={t("settingsAgents.systemPromptPlaceholder")}
                      className="min-h-[200px] font-mono text-sm"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingField(null)}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave("system_prompt", editSystemPrompt || null)}
                        disabled={saving}
                      >
                        {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                        <Save className="h-3 w-3 mr-1" />
                        {t("common.save")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="group">
                    {agent.system_prompt ? (
                      <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-lg max-h-48 overflow-auto">
                        {agent.system_prompt}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        {t("settingsAgents.systemPromptPlaceholder")}
                      </p>
                    )}
                    {onUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7"
                        onClick={() => setEditingField("system_prompt")}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        {t("common.edit")}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CollapsibleSection>
          </div>

          {/* Capabilities Section - use ExecutorCapabilities when executor_type is available */}
          {agent.executor_type ? (
            <ExecutorCapabilities
              executorType={agent.executor_type}
              workspacePath={workspacePath}
              className="mb-4"
            />
          ) : (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                {t("settingsAgents.capabilities")}
              </h4>

              <CollapsibleSection
                title={t("settingsAgents.mcpTitle", "MCP")}
                icon={<Database className="h-4 w-4" />}
                badge={
                  <Badge variant="secondary" className="text-xs">
                    {agent.mcp_servers?.length || 0}
                  </Badge>
                }
              >
                <div className="py-2">
                  {agent.mcp_servers && agent.mcp_servers.length > 0 ? (
                    <div className="space-y-1">
                      {agent.mcp_servers.map((server) => (
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
                    {agent.skills?.length || 0}
                  </Badge>
                }
              >
                <div className="py-2">
                  {agent.skills && agent.skills.length > 0 ? (
                    <div className="space-y-1">
                      {agent.skills.map((skill) => (
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
          )}

          {/* Memory Section */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
              {t("settingsAgents.memory")}
            </h4>

            <CollapsibleSection
              title={t("settingsAgents.memoryFileTitle", "MEMORY.md")}
              icon={<Brain className="h-4 w-4" />}
            >
              <p className="text-xs text-muted-foreground py-2">
                {t("settingsAgents.memoryDesc")}
              </p>
            </CollapsibleSection>
          </div>

          {/* Timestamps */}
          {(agent.created_at || agent.updated_at) && (
            <div className="pt-4 border-t text-xs text-muted-foreground space-y-1">
              {agent.created_at && (
                <p>
                  {t("common.created")}: {new Date(agent.created_at).toLocaleString()}
                </p>
              )}
              {agent.updated_at && (
                <p>
                  {t("workspace.updated")}: {new Date(agent.updated_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Danger Zone */}
          {showDangerZone && (onSetDefault || onDelete) && (
            <div className="pt-4 mt-4 border-t">
              <div className="flex items-center justify-between">
                {!isDefault && !isWorkspaceScoped && onSetDefault && (
                  <Button variant="outline" size="sm" onClick={onSetDefault}>
                    <Star className="h-4 w-4 mr-2" />
                    {t("agents.setDefault")}
                  </Button>
                )}
                {onDelete && (
                  <Button variant="destructive" size="sm" onClick={onDelete} className="ml-auto">
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("common.delete")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
