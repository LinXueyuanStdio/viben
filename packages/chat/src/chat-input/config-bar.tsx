/**
 * ChatInput Config Bar Component
 *
 * Bottom configuration bar with agent, model, executor, tools, skills, context, and send buttons.
 */

import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Terminal,
  Wrench,
  Sparkles,
  FileText,
  Send,
  Square,
  ChevronDown,
  Check,
  Settings,
} from "lucide-react";
import {
  cn,
  Button,
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@viben/ui";
import { ToolsConfigPopover } from "../tools-config-popover";
import { SkillsConfigPopover } from "../skills-config-popover";
import { ContextDetailsPopover } from "../context-details-popover";
import { formatTokens } from "../utils";
import { getModelIcon } from "../model-icons";
import type {
  AgentOption,
  ModelOption,
  ExecutorOption,
} from "./types";
import type { ToolConfig, SkillConfig, ContextTokenBreakdown } from "../types";

export interface ChatInputConfigBarProps {
  // Agent
  agents: AgentOption[];
  selectedAgentId: string | null;
  onAgentChange?: (agentId: string) => void;
  /** Callback when agent settings button is clicked */
  onAgentSettings?: (agentId: string) => void;
  showAgentSelector: boolean;
  // Model
  models: ModelOption[];
  selectedModelId: string | null;
  onModelChange?: (modelId: string) => void;
  showModelSelector: boolean;
  // Executor
  executors: ExecutorOption[];
  selectedExecutor: string;
  onExecutorChange?: (executorId: string) => void;
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
  // Steering
  /** Allow sending messages while loading (shows both send and stop buttons) */
  allowSendWhileLoading?: boolean;
  // Custom content
  /** Extra content to render at the left side (after built-in selectors) */
  leftExtraContent?: React.ReactNode;
}

export function ChatInputConfigBar({
  agents,
  selectedAgentId,
  onAgentChange,
  onAgentSettings,
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
  allowSendWhileLoading,
  className,
  leftExtraContent,
}: ChatInputConfigBarProps) {
  const { t } = useTranslation();
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isContextOpen, setIsContextOpen] = useState(false);

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
        {/* 智能体 (Agent Selector) - shows agent name and configured model */}
        {showAgentSelector && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto min-h-8 px-2 py-1.5 gap-1.5 text-xs"
                disabled={isLoading || disabled}
              >
                <Bot className="h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[200px] truncate">
                  {selectedAgent?.name || t("chat.agent", "Agent")}
                  {selectedAgent?.model && (
                    <span className="text-muted-foreground ml-1">
                      ({selectedAgent.model})
                    </span>
                  )}
                </span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              {agents.length === 0 ? (
                <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                  {t("chat.noAgents", "No agents")}
                </div>
              ) : (
                <div className="space-y-1">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className={cn(
                        "group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                        agent.id === selectedAgentId
                          ? "bg-primary/10 border border-primary/20"
                          : "hover:bg-muted/60"
                      )}
                      onClick={() => onAgentChange?.(agent.id)}
                    >
                      {/* Agent icon */}
                      <div className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                        agent.id === selectedAgentId
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}>
                        <Bot className="h-4 w-4" />
                      </div>
                      {/* Agent info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {agent.id === selectedAgentId && (
                            <Check className="h-3 w-3 text-primary shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">
                            {agent.name}
                            {agent.model && (
                              <span className="text-muted-foreground font-normal ml-1">
                                ({agent.model})
                              </span>
                            )}
                          </span>
                        </div>
                        {agent.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {agent.description}
                          </p>
                        )}
                      </div>
                      {/* Settings button */}
                      {onAgentSettings && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAgentSettings(agent.id);
                          }}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* 模型 (Model Selector) */}
        {showModelSelector && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1.5 text-xs"
                disabled={isLoading || disabled}
              >
                <span className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                  {getModelIcon(selectedModelId || undefined, { size: 14 })}
                </span>
                <span className="max-w-[80px] truncate">
                  {selectedModel?.name || t("chat.model", "Model")}
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
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className={`h-4 w-4 shrink-0 flex items-center justify-center ${model.id !== selectedModelId ? "ml-5" : ""}`}>
                      {getModelIcon(model.id, { size: 14 })}
                    </span>
                    <span className="truncate">
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

        {/* 工具 (Tools) - with label */}
        {tools.length > 0 && onToggleTool ? (
          <Popover open={isToolsOpen} onOpenChange={setIsToolsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1.5 text-xs"
                disabled={isLoading || disabled}
              >
                <Wrench className="h-3.5 w-3.5" />
                <span>{t("chat.tools", "Tools")}</span>
                {actualToolsCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 px-1 text-[10px]"
                  >
                    {actualToolsCount}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <ToolsConfigPopover tools={tools} onToggleTool={onToggleTool} />
            </PopoverContent>
          </Popover>
        ) : onToolsClick ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1.5 text-xs"
            disabled={isLoading || disabled}
            onClick={onToolsClick}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>{t("chat.tools", "Tools")}</span>
            {actualToolsCount > 0 && (
              <Badge
                variant="secondary"
                className="h-4 min-w-4 px-1 text-[10px]"
              >
                {actualToolsCount}
              </Badge>
            )}
          </Button>
        ) : null}

        {/* 用量统计 (Context/Usage Stats) - icon only */}
        <Popover open={isContextOpen} onOpenChange={setIsContextOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 gap-1 text-xs"
              disabled={isLoading || disabled}
              onClick={onContextClick ? () => onContextClick() : undefined}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="text-muted-foreground">{formatTokens(contextTokens)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <ContextDetailsPopover breakdown={defaultContextBreakdown} />
          </PopoverContent>
        </Popover>

        {/* Executor Selector - hidden by default, only show when explicitly enabled */}
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
                    t("chat.executor", "Executor")}
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

        {/* Skills - hidden by default, only show when explicitly provided */}
        {skills.length > 0 && onToggleSkill ? (
          <Popover open={isSkillsOpen} onOpenChange={setIsSkillsOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 gap-1.5 text-xs"
                disabled={isLoading || disabled}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t("chat.skills", "Skills")}</span>
                {actualSkillsCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="h-4 min-w-4 px-1 text-[10px]"
                  >
                    {actualSkillsCount}
                  </Badge>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <SkillsConfigPopover skills={skills} onToggleSkill={onToggleSkill} />
            </PopoverContent>
          </Popover>
        ) : onSkillsClick ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 gap-1.5 text-xs"
            disabled={isLoading || disabled}
            onClick={onSkillsClick}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t("chat.skills", "Skills")}</span>
            {actualSkillsCount > 0 && (
              <Badge
                variant="secondary"
                className="h-4 min-w-4 px-1 text-[10px]"
              >
                {actualSkillsCount}
              </Badge>
            )}
          </Button>
        ) : null}

        {/* Extra content slot */}
        {leftExtraContent}
      </div>

      {/* Send/Stop Button */}
      <div className="flex items-center gap-1">
        {isLoading && (
          <Button
            size="sm"
            variant="destructive"
            className="h-8 w-8 p-0"
            onClick={onCancel}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        )}
        {(!isLoading || allowSendWhileLoading) && (
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
