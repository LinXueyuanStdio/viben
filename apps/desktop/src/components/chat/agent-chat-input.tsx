import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  Send,
  Square,
  Paperclip,
  Settings2,
  Type,
  Eraser,
  Code,
  LayoutGrid,
  Link,
  Eye,
  EyeOff,
  Maximize2,
  ChevronDown,
  Search,
  Globe,
  HelpCircle,
  Sparkles,
  Brain,
  Settings,
  X,
  Loader2,
  FileText,
  Bot,
  GitBranch,
  SlidersHorizontal,
  ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { MessageAttachment } from "@/types";

// ============================================================================
// Types
// ============================================================================

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  providerIcon?: React.ReactNode;
  capabilities: {
    vision?: boolean;
    files?: boolean;
    tools?: boolean;
    web?: boolean;
  };
  contextWindow: string;
  isNew?: boolean;
}

interface TokenUsage {
  assistantProfile: number;
  skillSettings: number;
  historySummary: number;
  conversationMessages: number;
  used: number;
  remaining: number;
  total: number;
}

interface ModelParameters {
  frequencyPenalty: number;
  frequencyPenaltyEnabled: boolean;
  presencePenalty: number;
  presencePenaltyEnabled: boolean;
  temperature: number;
  temperatureEnabled: boolean;
  topP: number;
  topPEnabled: boolean;
  maxTokensEnabled: boolean;
  maxTokens: number;
  compressionEnabled: boolean;
}

interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface BranchInfo {
  name: string;
  isDefault?: boolean;
}

interface AgentChatInputProps {
  onSend: (content: string, attachments?: MessageAttachment[]) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  // Agent-related props
  agents?: AgentInfo[];
  selectedAgent?: AgentInfo;
  onAgentChange?: (agent: AgentInfo) => void;
  // Model-related props
  models?: ModelInfo[];
  selectedModel?: ModelInfo;
  onModelChange?: (model: ModelInfo) => void;
  // Branch-related props
  branches?: BranchInfo[];
  selectedBranch?: BranchInfo;
  onBranchChange?: (branch: BranchInfo) => void;
  // Parameters
  parameters?: ModelParameters;
  onParametersChange?: (params: ModelParameters) => void;
  // Token usage
  tokenUsage?: TokenUsage;
  // Variant - 'default' for full toolbar, 'task' for task creation style
  variant?: "default" | "task";
}

// ============================================================================
// Default Data
// ============================================================================

const DEFAULT_MODELS: ModelInfo[] = [
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "LobeHub",
    capabilities: { vision: true, files: true, tools: true, web: true },
    contextWindow: "200K",
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "LobeHub",
    capabilities: { vision: true, files: true, tools: true, web: true },
    contextWindow: "200K",
    isNew: true,
  },
  {
    id: "claude-opus-4-5",
    name: "Claude Opus 4.5",
    provider: "LobeHub",
    capabilities: { vision: true, files: true, tools: true, web: true },
    contextWindow: "200K",
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "LobeHub",
    capabilities: { vision: true, files: true, tools: true, web: true },
    contextWindow: "200K",
  },
  {
    id: "gemini-3-pro",
    name: "Gemini 3 Pro Preview",
    provider: "LobeHub",
    capabilities: { vision: true, files: true, tools: true, web: true },
    contextWindow: "1M",
  },
];

const DEFAULT_TOKEN_USAGE: TokenUsage = {
  assistantProfile: 0,
  skillSettings: 3131,
  historySummary: 0,
  conversationMessages: 12,
  used: 3143,
  remaining: 396857,
  total: 400000,
};

const DEFAULT_PARAMETERS: ModelParameters = {
  frequencyPenalty: 0,
  frequencyPenaltyEnabled: true,
  presencePenalty: 0,
  presencePenaltyEnabled: true,
  temperature: 1.0,
  temperatureEnabled: true,
  topP: 1.0,
  topPEnabled: true,
  maxTokensEnabled: false,
  maxTokens: 4096,
  compressionEnabled: true,
};

const DEFAULT_AGENTS: AgentInfo[] = [
  { id: "claude-code", name: "CLAUDE_CODE", description: "代码开发智能体" },
  { id: "researcher", name: "RESEARCHER", description: "研究分析智能体" },
  { id: "writer", name: "WRITER", description: "文档写作智能体" },
  { id: "reviewer", name: "REVIEWER", description: "代码审查智能体" },
];

const DEFAULT_BRANCHES: BranchInfo[] = [
  { name: "main", isDefault: true },
  { name: "develop" },
  { name: "feature/new-ui" },
];

// ============================================================================
// Helper Components
// ============================================================================

// Toolbar Icon Button
function ToolbarButton({
  icon: Icon,
  tooltip,
  onClick,
  active,
  disabled,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tooltip?: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        "text-muted-foreground hover:bg-accent hover:text-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active && "bg-accent text-foreground",
        className
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

// Model Selector Popover
function ModelSelector({
  open,
  onOpenChange,
  models,
  selectedModel,
  onModelChange,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  models: ModelInfo[];
  selectedModel?: ModelInfo;
  onModelChange?: (model: ModelInfo) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [search, setSearch] = React.useState("");
  const contentRef = React.useRef<HTMLDivElement>(null);

  const filteredModels = models.filter((model) =>
    model.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group models by provider
  const groupedModels = filteredModels.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    },
    {} as Record<string, ModelInfo[]>
  );

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className="absolute bottom-full left-0 z-50 mb-2 w-[400px] rounded-lg border bg-popover p-2 shadow-lg animate-in fade-in-0 zoom-in-95"
    >
      {/* Search */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜索模型..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
          <button className="rounded p-1 hover:bg-accent">
            <Settings className="h-4 w-4 text-muted-foreground" />
          </button>
          <button className="rounded p-1 hover:bg-accent">
            <Brain className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Model List */}
      <div className="max-h-[400px] overflow-y-auto">
        {Object.entries(groupedModels).map(([provider, providerModels]) => (
          <div key={provider} className="mb-2">
            <div className="mb-1 flex items-center gap-2 px-2 py-1 text-sm font-medium text-muted-foreground">
              <span className="text-lg">🤖</span>
              <span>{provider}</span>
            </div>
            {providerModels.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onModelChange?.(model);
                  onOpenChange(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors",
                  "hover:bg-accent",
                  selectedModel?.id === model.id && "bg-accent"
                )}
              >
                <div className="flex items-center gap-2">
                  <ModelIcon provider={model.provider} />
                  <span>{model.name}</span>
                  {model.isNew && (
                    <span className="rounded bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                      新
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  {model.capabilities.vision && <Eye className="h-3.5 w-3.5" />}
                  {model.capabilities.files && (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  {model.capabilities.tools && (
                    <Settings className="h-3.5 w-3.5" />
                  )}
                  {model.capabilities.web && <Globe className="h-3.5 w-3.5" />}
                  <span className="ml-2 text-xs">{model.contextWindow}</span>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Manage Providers */}
      <div className="mt-2 border-t pt-2">
        <button className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>管理提供商</span>
          </div>
          <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
        </button>
      </div>
    </div>
  );
}

// Model Icon based on provider
function ModelIcon({ provider }: { provider: string }) {
  // Simple colored circle for now - could be replaced with actual provider logos
  const colors: Record<string, string> = {
    LobeHub: "bg-gradient-to-r from-pink-500 to-rose-500",
    Anthropic: "bg-gradient-to-r from-orange-400 to-pink-500",
    Google: "bg-gradient-to-r from-blue-400 to-cyan-400",
    OpenAI: "bg-gradient-to-r from-green-400 to-teal-400",
  };

  return (
    <div
      className={cn(
        "h-5 w-5 rounded-full",
        colors[provider] || "bg-gradient-to-r from-gray-400 to-gray-500"
      )}
    />
  );
}

// Parameters Popover
function ParametersPopover({
  open,
  onOpenChange,
  parameters,
  onParametersChange,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parameters: ModelParameters;
  onParametersChange?: (params: ModelParameters) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange, triggerRef]);

  if (!open) return null;

  const updateParam = <K extends keyof ModelParameters>(
    key: K,
    value: ModelParameters[K]
  ) => {
    onParametersChange?.({ ...parameters, [key]: value });
  };

  return (
    <div
      ref={contentRef}
      className="absolute bottom-full right-0 z-50 mb-2 w-[400px] rounded-lg border bg-popover p-4 shadow-lg animate-in fade-in-0 zoom-in-95"
    >
      {/* Frequency Penalty */}
      <ParameterSlider
        label="词汇丰富度"
        paramName="frequency_penalty"
        tooltip="减少重复使用相同词汇的倾向"
        enabled={parameters.frequencyPenaltyEnabled}
        onEnabledChange={(v) => updateParam("frequencyPenaltyEnabled", v)}
        value={parameters.frequencyPenalty}
        onValueChange={(v) => updateParam("frequencyPenalty", v)}
        min={-2}
        max={2}
        step={0.1}
        leftIcon={<FileText className="h-3.5 w-3.5" />}
        rightIcon={<LayoutGrid className="h-3.5 w-3.5" />}
      />

      {/* Presence Penalty */}
      <ParameterSlider
        label="表述发散度"
        paramName="presence_penalty"
        tooltip="增加话题多样性的倾向"
        enabled={parameters.presencePenaltyEnabled}
        onEnabledChange={(v) => updateParam("presencePenaltyEnabled", v)}
        value={parameters.presencePenalty}
        onValueChange={(v) => updateParam("presencePenalty", v)}
        min={-2}
        max={2}
        step={0.1}
        leftIcon={<span className="text-xs">⇄</span>}
        rightIcon={<Settings className="h-3.5 w-3.5" />}
      />

      {/* Temperature */}
      <ParameterSlider
        label="创意活跃度"
        paramName="temperature"
        tooltip="控制输出的随机性和创造性"
        enabled={parameters.temperatureEnabled}
        onEnabledChange={(v) => updateParam("temperatureEnabled", v)}
        value={parameters.temperature}
        onValueChange={(v) => updateParam("temperature", v)}
        min={0}
        max={2}
        step={0.1}
        leftIcon={<Sparkles className="h-3.5 w-3.5" />}
        rightIcon={<Sparkles className="h-3.5 w-3.5" />}
      />

      {/* Top P */}
      <ParameterSlider
        label="思维开放度"
        paramName="top_p"
        tooltip="核采样参数，控制候选词汇范围"
        enabled={parameters.topPEnabled}
        onEnabledChange={(v) => updateParam("topPEnabled", v)}
        value={parameters.topP}
        onValueChange={(v) => updateParam("topP", v)}
        min={0}
        max={1}
        step={0.1}
        leftIcon={<Brain className="h-3.5 w-3.5" />}
        rightIcon={<Settings className="h-3.5 w-3.5" />}
      />

      {/* Max Tokens Toggle */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">开启单次回复限制</span>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>限制单次回复的最大令牌数</TooltipContent>
          </Tooltip>
        </div>
        <Switch
          checked={parameters.maxTokensEnabled}
          onCheckedChange={(v) => updateParam("maxTokensEnabled", v)}
        />
      </div>
      <div className="mb-4 ml-2">
        <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          max_tokens
        </span>
      </div>

      {/* Compression Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">开启自动上下文压缩</span>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>自动压缩上下文以节省令牌</TooltipContent>
          </Tooltip>
        </div>
        <Switch
          checked={parameters.compressionEnabled}
          onCheckedChange={(v) => updateParam("compressionEnabled", v)}
        />
      </div>
      <div className="ml-2 mt-1">
        <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          compression
        </span>
      </div>
    </div>
  );
}

// Parameter Slider Component
function ParameterSlider({
  label,
  paramName,
  tooltip,
  enabled,
  onEnabledChange,
  value,
  onValueChange,
  min,
  max,
  step,
  leftIcon,
  rightIcon,
}: {
  label: string;
  paramName: string;
  tooltip: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm">{label}</span>
        <Tooltip>
          <TooltipTrigger>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <div className="flex flex-1 items-center gap-2">
          <div className="text-muted-foreground">{leftIcon}</div>
          <Slider
            value={[value]}
            onValueChange={(v) => onValueChange(v[0])}
            min={min}
            max={max}
            step={step}
            disabled={!enabled}
            className="flex-1"
          />
          <div className="text-muted-foreground">{rightIcon}</div>
        </div>
        <input
          type="number"
          value={value.toFixed(1)}
          onChange={(e) => onValueChange(parseFloat(e.target.value))}
          disabled={!enabled}
          className="w-16 rounded-md border bg-muted px-2 py-1 text-center text-sm disabled:opacity-50"
          step={step}
          min={min}
          max={max}
        />
      </div>
      <div className="ml-7 mt-1">
        <span className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {paramName}
        </span>
      </div>
    </div>
  );
}

// Token Usage Popover
function TokenUsagePopover({
  open,
  onOpenChange,
  tokenUsage,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokenUsage: TokenUsage;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange, triggerRef]);

  if (!open) return null;

  const usagePercent = (tokenUsage.used / tokenUsage.total) * 100;

  const items = [
    {
      label: "助理档案",
      value: tokenUsage.assistantProfile,
      color: "bg-blue-500",
    },
    {
      label: "技能设定",
      value: tokenUsage.skillSettings,
      color: "bg-cyan-500",
    },
    {
      label: "历史总结",
      value: tokenUsage.historySummary,
      color: "bg-yellow-500",
    },
    {
      label: "会话消息",
      value: tokenUsage.conversationMessages,
      color: "bg-orange-500",
    },
  ];

  return (
    <div
      ref={contentRef}
      className="absolute bottom-full right-0 z-50 mb-2 w-[280px] rounded-lg border bg-popover p-4 shadow-lg animate-in fade-in-0 zoom-in-95"
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">上下文明细</span>
        <span className="rounded bg-muted px-2 py-0.5 text-xs">TOKEN</span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${usagePercent}%` }}
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full", item.color)} />
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
            <span className="text-sm">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Divider and totals */}
      <div className="my-3 h-px bg-border" />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm text-muted-foreground">已使用</span>
          </div>
          <span className="text-sm">{tokenUsage.used.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-gray-400" />
            <span className="text-sm text-muted-foreground">剩余可用</span>
          </div>
          <span className="text-sm">
            {tokenUsage.remaining.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="mt-3 border-t pt-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">总可用</span>
          <span className="text-sm font-medium">
            {tokenUsage.total.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// Agent Selector Popover
function AgentSelectorPopover({
  open,
  onOpenChange,
  agents,
  selectedAgent,
  onAgentChange,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: AgentInfo[];
  selectedAgent?: AgentInfo;
  onAgentChange?: (agent: AgentInfo) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[200px] rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
    >
      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => {
            onAgentChange?.(agent);
            onOpenChange(false);
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
            "hover:bg-accent",
            selectedAgent?.id === agent.id && "bg-accent"
          )}
        >
          <Bot className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1">
            <div className="font-medium">{agent.name}</div>
            {agent.description && (
              <div className="text-xs text-muted-foreground">{agent.description}</div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// Branch Selector Popover
function BranchSelectorPopover({
  open,
  onOpenChange,
  branches,
  selectedBranch,
  onBranchChange,
  triggerRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: BranchInfo[];
  selectedBranch?: BranchInfo;
  onBranchChange?: (branch: BranchInfo) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onOpenChange(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onOpenChange, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[180px] rounded-lg border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
    >
      {branches.map((branch) => (
        <button
          key={branch.name}
          onClick={() => {
            onBranchChange?.(branch);
            onOpenChange(false);
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
            "hover:bg-accent",
            selectedBranch?.name === branch.name && "bg-accent"
          )}
        >
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span>{branch.name}</span>
          {branch.isDefault && (
            <span className="ml-auto text-xs text-muted-foreground">默认</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Dropdown Selector Button - reusable component for task variant
function SelectorButton({
  icon: Icon,
  label,
  onClick,
  isOpen,
  buttonRef,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  isOpen?: boolean;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
  className?: string;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-left transition-colors",
        "hover:bg-muted/50",
        isOpen && "ring-1 ring-ring",
        className
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 truncate text-sm">{label}</span>
      <ChevronDown className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentChatInput({
  onSend,
  onCancel,
  isLoading,
  disabled,
  placeholder,
  className,
  autoFocus = false,
  agents = DEFAULT_AGENTS,
  selectedAgent,
  onAgentChange,
  models = DEFAULT_MODELS,
  selectedModel,
  onModelChange,
  branches = DEFAULT_BRANCHES,
  selectedBranch,
  onBranchChange,
  parameters = DEFAULT_PARAMETERS,
  onParametersChange,
  tokenUsage = DEFAULT_TOKEN_USAGE,
  variant = "default",
}: AgentChatInputProps) {
  useTranslation(); // Load translations context
  const [content, setContent] = React.useState("");
  const [attachments, setAttachments] = React.useState<MessageAttachment[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isComposingRef = React.useRef(false);

  // Popover states
  const [modelSelectorOpen, setModelSelectorOpen] = React.useState(false);
  const [parametersOpen, setParametersOpen] = React.useState(false);
  const [tokenUsageOpen, setTokenUsageOpen] = React.useState(false);
  const [agentSelectorOpen, setAgentSelectorOpen] = React.useState(false);
  const [branchSelectorOpen, setBranchSelectorOpen] = React.useState(false);

  // Refs for popover triggers
  const modelTriggerRef = React.useRef<HTMLDivElement>(null);
  const paramsTriggerRef = React.useRef<HTMLButtonElement>(null);
  const tokenTriggerRef = React.useRef<HTMLButtonElement>(null);
  const agentTriggerRef = React.useRef<HTMLButtonElement>(null);
  const branchTriggerRef = React.useRef<HTMLButtonElement>(null);

  const currentModel = selectedModel || models[0];
  const currentAgent = selectedAgent || agents[0];
  const currentBranch = selectedBranch || branches.find((b) => b.isDefault) || branches[0];
  const [localParams, setLocalParams] = React.useState(parameters);

  // Auto focus on mount
  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 200);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 200 ? "auto" : "hidden";
  }, [content]);

  const canSubmit =
    (content.trim() || attachments.length > 0) &&
    !disabled &&
    !attachments.some((a) => a.isLoading);

  const handleSend = async () => {
    if (!canSubmit || isLoading) return;

    const text = content.trim();
    const messageAttachments = attachments.length > 0 ? attachments : undefined;

    setContent("");
    setAttachments([]);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    onSend(text, messageAttachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isComposingRef.current) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleParamsChange = (params: ModelParameters) => {
    setLocalParams(params);
    onParametersChange?.(params);
  };

  return (
    <TooltipProvider>
      <div className={cn("relative w-full", className)}>
        {/* Main Input Container */}
        <div className="rounded-2xl border border-border/50 bg-background p-3 shadow-lg">
        {/* Attachment Preview */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="group relative flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 px-3 py-2"
              >
                {attachment.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : attachment.type === "image" && attachment.data ? (
                  <img
                    src={attachment.data}
                    alt={attachment.name}
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <span className="max-w-[120px] truncate text-sm text-foreground">
                  {attachment.name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) =>
                      prev.filter((a) => a.id !== attachment.id)
                    )
                  }
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            setTimeout(() => {
              isComposingRef.current = false;
            }, 10);
          }}
          placeholder={
            placeholder ||
            `从任何想法开始... 按 ⌘ ↵ 换行...`
          }
          className="w-full resize-none border-0 bg-transparent px-1 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
          style={{
            minHeight: "24px",
            maxHeight: "200px",
            overflowY: "hidden",
          }}
          rows={1}
          disabled={isLoading || disabled}
        />

        {/* Bottom Toolbar */}
        <div className="mt-3 flex items-center justify-between">
          {/* Left Toolbar */}
          <div className="flex items-center">
            {/* Model Selector */}
            <div ref={modelTriggerRef} className="relative">
              <button
                type="button"
                onClick={() => setModelSelectorOpen(!modelSelectorOpen)}
                className="flex h-8 items-center gap-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-1 text-white"
              >
                <div className="flex h-6 w-6 items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
              </button>
              <ModelSelector
                open={modelSelectorOpen}
                onOpenChange={setModelSelectorOpen}
                models={models}
                selectedModel={currentModel}
                onModelChange={onModelChange}
                triggerRef={modelTriggerRef}
              />
            </div>

            <ToolbarButton icon={Link} tooltip="链接上下文" />
            <ToolbarButton icon={EyeOff} tooltip="隐藏预览" />

            <div className="mx-2 h-5 w-px bg-border" />

            <ToolbarButton icon={Paperclip} tooltip="附件" />
            <ToolbarButton icon={LayoutGrid} tooltip="组件" />

            <div className="mx-2 h-5 w-px bg-border" />

            <ToolbarButton icon={Type} tooltip="文本格式" />

            {/* Parameters Button */}
            <button
              ref={paramsTriggerRef}
              type="button"
              onClick={() => setParametersOpen(!parametersOpen)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                "text-muted-foreground hover:bg-accent hover:text-foreground",
                parametersOpen && "bg-accent text-foreground"
              )}
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <ParametersPopover
              open={parametersOpen}
              onOpenChange={setParametersOpen}
              parameters={localParams}
              onParametersChange={handleParamsChange}
              triggerRef={paramsTriggerRef}
            />

            <ToolbarButton icon={Eraser} tooltip="清除" />
            <ToolbarButton icon={Code} tooltip="代码" />

            {/* Token Usage Button */}
            <button
              ref={tokenTriggerRef}
              type="button"
              onClick={() => setTokenUsageOpen(!tokenUsageOpen)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border border-border transition-colors",
                "text-muted-foreground hover:bg-accent hover:text-foreground",
                tokenUsageOpen && "bg-accent text-foreground"
              )}
            >
              <div className="h-4 w-4 rounded-full border-2 border-current" />
            </button>
            <TokenUsagePopover
              open={tokenUsageOpen}
              onOpenChange={setTokenUsageOpen}
              tokenUsage={tokenUsage}
              triggerRef={tokenTriggerRef}
            />
          </div>

          {/* Right Toolbar */}
          <div className="flex items-center gap-1">
            <ToolbarButton icon={Maximize2} tooltip="全屏" />

            {/* Send/Stop Button */}
            {isLoading ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
              >
                <Square className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSubmit}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-all",
                  "text-muted-foreground hover:bg-accent hover:text-foreground",
                  !canSubmit && "cursor-not-allowed opacity-50"
                )}
              >
                <Send className="h-4 w-4 -rotate-90" />
              </button>
            )}

            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Selectors Row - Agent, Model, Branch */}
        {variant === "task" && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {/* Agent Selector */}
            <div className="relative">
              <SelectorButton
                icon={Bot}
                label={currentAgent.name}
                onClick={() => setAgentSelectorOpen(!agentSelectorOpen)}
                isOpen={agentSelectorOpen}
                buttonRef={agentTriggerRef}
              />
              <AgentSelectorPopover
                open={agentSelectorOpen}
                onOpenChange={setAgentSelectorOpen}
                agents={agents}
                selectedAgent={currentAgent}
                onAgentChange={onAgentChange}
                triggerRef={agentTriggerRef}
              />
            </div>

            {/* Model Selector (Simplified) */}
            <div className="relative">
              <SelectorButton
                icon={SlidersHorizontal}
                label={currentModel.name.split(" ").pop() || currentModel.name}
                onClick={() => setModelSelectorOpen(!modelSelectorOpen)}
                isOpen={modelSelectorOpen}
                buttonRef={undefined}
              />
            </div>

            {/* Branch Selector */}
            <div className="relative">
              <SelectorButton
                icon={GitBranch}
                label={currentBranch.name}
                onClick={() => setBranchSelectorOpen(!branchSelectorOpen)}
                isOpen={branchSelectorOpen}
                buttonRef={branchTriggerRef}
              />
              <BranchSelectorPopover
                open={branchSelectorOpen}
                onOpenChange={setBranchSelectorOpen}
                branches={branches}
                selectedBranch={currentBranch}
                onBranchChange={onBranchChange}
                triggerRef={branchTriggerRef}
              />
            </div>
          </div>
        )}

        {/* Task Mode Bottom Bar */}
        {variant === "task" && (
          <div className="mt-4 flex items-center justify-between">
            {/* Image Upload */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ImagePlus className="h-5 w-5" />
            </button>

            {/* Right side controls */}
            <div className="flex items-center gap-4">
              {/* Start Toggle */}
              <div className="flex items-center gap-2">
                <Switch />
                <span className="text-sm text-muted-foreground">开始</span>
              </div>

              {/* Create Button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSubmit}
                className={cn(
                  "rounded-lg bg-muted px-6 py-3 text-sm font-medium transition-colors",
                  "hover:bg-muted/80",
                  !canSubmit && "cursor-not-allowed opacity-50"
                )}
              >
                创建
              </button>
            </div>
          </div>
        )}
      </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              // Handle file upload
              e.target.value = "";
            }
          }}
        />
      </div>
    </TooltipProvider>
  );
}
