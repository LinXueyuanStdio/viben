/**
 * ChatInput Config Bar Component
 *
 * Bottom configuration bar with agent, model, executor, tools, skills, context, and send buttons.
 */

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Cpu,
  Terminal,
  Wrench,
  Sparkles,
  FileText,
  Send,
  Square,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  cn,
  Button,
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@viben/ui";
import { ToolsConfigPopover } from "../tools-config-popover";
import { SkillsConfigPopover } from "../skills-config-popover";
import { ContextDetailsPopover } from "../context-details-popover";
import { formatTokens } from "../utils";
import type {
  AgentOption,
  ModelOption,
} from "./types";
import type { ToolConfig, SkillConfig, ContextTokenBreakdown, AgentTypeInfo, BaseCodingAgent } from "../types";

export interface ChatInputConfigBarProps {
  // Agent
  agents: AgentOption[];
  selectedAgentId: string | null;
  onAgentChange?: (agentId: string) => void;
  showAgentSelector: boolean;
  // Model
  models: ModelOption[];
  selectedModelId: string | null;
  onModelChange?: (modelId: string) => void;
  showModelSelector: boolean;
  // Executor
  executors: AgentTypeInfo[];
  selectedExecutor: BaseCodingAgent;
  onExecutorChange?: (executor: BaseCodingAgent) => void;
  showExecutorSelector: boolean;
  // Tools
  tools: ToolConfig[];
  onToggleTool?: (toolId: string, enabled: boolean) => void;
  enabledToolsCount: number;
  onToolsClick?: () => void;
  // Skills
  skills: SkillConfig[];
  onToggleSkill?: (skillId: string, enabled: boolean) => void;
  enabledSkillsCount: number;
  onSkillsClick?: () => void;
  // Context
  contextTokens: number;
  contextBreakdown?: ContextTokenBreakdown;
  onContextClick?: () => void;
  // Send
  onSend: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  canSubmit: boolean;
  // Style
  className?: string;
}

export function ChatInputConfigBar({
  agents,
  selectedAgentId,
  onAgentChange,
  showAgentSelector,
  models,
  selectedModelId,
  onModelChange,
  showModelSelector,
  executors,
  selectedExecutor,
  onExecutorChange,
  showExecutorSelector,
  tools,
  onToggleTool,
  enabledToolsCount,
  onToolsClick,
  skills,
  onToggleSkill,
  enabledSkillsCount,
  onSkillsClick,
  contextTokens,
  contextBreakdown,
  onContextClick,
  onSend,
  onCancel,
  isLoading,
  disabled,
  canSubmit,
  className,
}: ChatInputConfigBarProps) {
  const { t } = useTranslation();
  const [isToolsOpen, setIsToolsOpen] = React.useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = React.useState(false);
  const [isContextOpen, setIsContextOpen] = React.useState(false);

  // Calculate actual enabled counts from arrays if provided
  const actualToolsCount =
    tools.length > 0 ? tools.filter((t) => t.enabled).length : enabledToolsCount;
  const actualSkillsCount =
    skills.length > 0 ? skills.filter((s) => s.enabled).length : enabledSkillsCount;

  // Default context breakdown if not provided
  const defaultContextBreakdown: ContextTokenBreakdown = contextBreakdown || {
    assistantProfile: 0,
    skillSettings: 0,
    historySummary: 0,
    conversationMessages: contextTokens,
    totalContext: Math.max(contextTokens * 2, 8000),
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedModel = models.find((m) => m.id === selectedModelId);

  return (
    <div
      className={cn(
        "flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/30",
        className
      )}
    >
      <div className="flex items-center gap-1">
        {/* Agent Selector */}
        {showAgentSelector && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1.5 text-xs"
                disabled={isLoading || disabled}
              >
                <Bot className="h-3.5 w-3.5" />
                <span className="max-w-[80px] truncate">
                  {selectedAgent?.name || t("chat.selectAgent", "Agent")}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              {agents.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  {t("chat.noAgents", "No agents")}
                </div>
              ) : (
                agents.map((agent) => (
                  <Button
                    key={agent.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 h-8"
                    onClick={() => onAgentChange?.(agent.id)}
                  >
                    {agent.id === selectedAgentId && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span className={agent.id !== selectedAgentId ? "ml-5" : ""}>
                      {agent.name}
                    </span>
                  </Button>
                ))
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Model Selector */}
        {showModelSelector && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1.5 text-xs"
                disabled={isLoading || disabled}
              >
                <Cpu className="h-3.5 w-3.5" />
                <span className="max-w-[80px] truncate">
                  {selectedModel?.name || t("chat.selectModel", "Model")}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start">
              {models.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  {t("chat.noModels", "No models")}
                </div>
              ) : (
                models.map((model) => (
                  <Button
                    key={model.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 h-8"
                    onClick={() => onModelChange?.(model.id)}
                  >
                    {model.id === selectedModelId && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span className={model.id !== selectedModelId ? "ml-5" : ""}>
                      {model.name}
                      {model.provider && (
                        <span className="text-muted-foreground ml-1">
                          ({model.provider})
                        </span>
                      )}
                    </span>
                  </Button>
                ))
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Executor Selector */}
        {showExecutorSelector && executors.length > 0 && onExecutorChange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1.5 text-xs"
                disabled={isLoading || disabled}
              >
                <Terminal className="h-3.5 w-3.5" />
                <span className="max-w-[80px] truncate">
                  {executors.find((e) => e.id === selectedExecutor)?.name ||
                    t("chat.selectExecutor", "Executor")}
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start">
              {executors.map((executor) => (
                <Button
                  key={executor.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-8"
                  onClick={() => onExecutorChange(executor.id)}
                >
                  {executor.id === selectedExecutor && (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span className={executor.id !== selectedExecutor ? "ml-5" : ""}>
                    {executor.name}
                  </span>
                </Button>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {/* Tools - icon only with badge */}
        {tools.length > 0 && onToggleTool ? (
          <Popover open={isToolsOpen} onOpenChange={setIsToolsOpen}>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 relative"
                      disabled={isLoading || disabled}
                    >
                      <Wrench className="h-4 w-4" />
                      {actualToolsCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                        >
                          {actualToolsCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {t("chat.configureTools", "Configure tools")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent className="w-auto p-3" align="start">
              <ToolsConfigPopover tools={tools} onToggleTool={onToggleTool} />
            </PopoverContent>
          </Popover>
        ) : onToolsClick ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 relative"
                  disabled={isLoading || disabled}
                  onClick={onToolsClick}
                >
                  <Wrench className="h-4 w-4" />
                  {actualToolsCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                    >
                      {actualToolsCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t("chat.configureTools", "Configure tools")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}

        {/* Skills - icon only with badge */}
        {skills.length > 0 && onToggleSkill ? (
          <Popover open={isSkillsOpen} onOpenChange={setIsSkillsOpen}>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 relative"
                      disabled={isLoading || disabled}
                    >
                      <Sparkles className="h-4 w-4" />
                      {actualSkillsCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                        >
                          {actualSkillsCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  {t("chat.configureSkills", "Configure skills")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <PopoverContent className="w-auto p-3" align="start">
              <SkillsConfigPopover skills={skills} onToggleSkill={onToggleSkill} />
            </PopoverContent>
          </Popover>
        ) : onSkillsClick ? (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 relative"
                  disabled={isLoading || disabled}
                  onClick={onSkillsClick}
                >
                  <Sparkles className="h-4 w-4" />
                  {actualSkillsCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
                    >
                      {actualSkillsCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t("chat.configureSkills", "Configure skills")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}

        {/* Context Tokens - icon + number only */}
        <Popover open={isContextOpen} onOpenChange={setIsContextOpen}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 gap-1 text-xs"
                    disabled={isLoading || disabled}
                    onClick={onContextClick ? () => onContextClick() : undefined}
                  >
                    <FileText className="h-4 w-4" />
                    <span>{formatTokens(contextTokens)}</span>
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>
                {t("chat.contextDetails", "Context details")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <PopoverContent className="w-auto p-3" align="start">
            <ContextDetailsPopover breakdown={defaultContextBreakdown} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Send/Stop Button */}
      <div className="flex items-center gap-1">
        {isLoading ? (
          <Button
            size="sm"
            variant="destructive"
            className="h-8 w-8 p-0"
            onClick={onCancel}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-8 w-8 p-0"
            disabled={!canSubmit}
            onClick={onSend}
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
