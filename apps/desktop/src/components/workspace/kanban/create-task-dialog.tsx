"use client";

import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Settings2,
  GitBranch,
  ImagePlus,
  Loader2,
  Sparkles,
  Command,
  Play,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  cn,
} from "@viben/ui";

// Types for available agents and models
export interface AvailableAgent {
  id: string;
  name: string;
  description?: string;
}

export interface AvailableModel {
  id: string;
  name: string;
  description?: string;
  provider?: string;
}

// Branch options (can be extended to be dynamic later)
const BRANCH_OPTIONS = [
  { value: "main", label: "main" },
  { value: "develop", label: "develop" },
  { value: "feature", label: "feature" },
] as const;

export interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTaskData) => Promise<void>;
  defaultColumnId?: string;
  isSubmitting?: boolean;
  /** Available agents in the workspace */
  availableAgents?: AvailableAgent[];
  /** Available models in the workspace */
  availableModels?: AvailableModel[];
  /** Default agent ID */
  defaultAgentId?: string;
  /** Default model ID */
  defaultModelId?: string;
  /** Loading state for agents/models */
  isLoadingOptions?: boolean;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  agentId: string;
  modelId: string;
  branch: string;
  autoStart: boolean;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultColumnId: _defaultColumnId,
  isSubmitting = false,
  availableAgents = [],
  availableModels = [],
  defaultAgentId,
  defaultModelId,
  isLoadingOptions = false,
}: CreateTaskDialogProps) {
  const { t } = useTranslation();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentId, setAgentId] = useState("");
  const [modelId, setModelId] = useState("");
  const [branch, setBranch] = useState("main");
  const [autoStart, setAutoStart] = useState(false);

  // Set defaults when dialog opens or defaults change
  useEffect(() => {
    if (open) {
      setAgentId(defaultAgentId || availableAgents[0]?.id || "");
      setModelId(defaultModelId || availableModels[0]?.id || "");
    }
  }, [open, defaultAgentId, defaultModelId, availableAgents, availableModels]);

  // Reset form when dialog opens
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setTitle("");
      setDescription("");
      setBranch("main");
      setAutoStart(false);
    }
    onOpenChange(newOpen);
  }, [onOpenChange]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;

    await onSubmit({
      title: title.trim(),
      description: description.trim() || undefined,
      agentId,
      modelId,
      branch,
      autoStart,
    });

    handleOpenChange(false);
  }, [title, description, agentId, modelId, branch, autoStart, onSubmit, handleOpenChange]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const selectedAgent = availableAgents.find(a => a.id === agentId);
  const selectedModel = availableModels.find(m => m.id === modelId);

  const hasNoAgents = availableAgents.length === 0;
  const hasNoModels = availableModels.length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] p-0 gap-0 overflow-hidden rounded-xl"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("workspace.createTaskDialog.title", "Create Task")}</DialogTitle>
        </DialogHeader>

        {/* Header with gradient accent */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
          <div className="relative px-5 pt-5 pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-medium">{t("workspace.createTaskDialog.title", "Create Task")}</span>
            </div>
            {/* Title Input */}
            <Input
              placeholder={t("workspace.createTaskDialog.taskTitlePlaceholder", "Enter task title...")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base font-medium border-0 bg-transparent h-10 px-0 focus-visible:ring-0 placeholder:text-muted-foreground/50"
              autoFocus
            />
          </div>
        </div>

        {/* Description */}
        <div className="px-5 pb-4">
          <Textarea
            placeholder={t("workspace.createTaskDialog.descriptionPlaceholder", "Add more details (optional)")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[140px] resize-none border-border/40 bg-muted/30 text-sm rounded-lg focus-visible:ring-1 focus-visible:ring-primary/30"
          />
          <p className="mt-1.5 text-xs text-muted-foreground/60">
            {t("workspace.createTaskDialog.descriptionHint", "Type @ to search for file references")}
          </p>
        </div>

        {/* Options Section */}
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("workspace.createTaskDialog.agent", "Agent")} & {t("workspace.createTaskDialog.model", "Model")}
            </span>
          </div>

          {isLoadingOptions ? (
            <div className="flex items-center justify-center h-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {t("common.loading", "Loading...")}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {/* Agent Selector */}
              <Select value={agentId} onValueChange={setAgentId} disabled={hasNoAgents}>
                <SelectTrigger
                  className={cn(
                    "h-10 bg-muted/40 border-border/40 hover:bg-muted/60 transition-colors",
                    hasNoAgents && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm truncate">
                    <Bot className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {hasNoAgents ? (
                      <span className="text-muted-foreground">{t("chat.noAgents", "No agents")}</span>
                    ) : (
                      <span className="truncate">{selectedAgent?.name || t("workspace.createTaskDialog.selectAgent", "Select agent")}</span>
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex flex-col">
                        <span>{agent.name}</span>
                        {agent.description && (
                          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {agent.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Model Selector */}
              <Select value={modelId} onValueChange={setModelId} disabled={hasNoModels}>
                <SelectTrigger
                  className={cn(
                    "h-10 bg-muted/40 border-border/40 hover:bg-muted/60 transition-colors",
                    hasNoModels && "opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2 text-sm truncate">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {hasNoModels ? (
                      <span className="text-muted-foreground">{t("chat.noModels", "No models")}</span>
                    ) : (
                      <span className="truncate">{selectedModel?.name || t("workspace.createTaskDialog.selectModel", "Select model")}</span>
                    )}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between gap-3 w-full">
                        <span>{model.name}</span>
                        {model.provider && (
                          <span className="text-xs text-muted-foreground">{model.provider}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Branch Selector */}
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="h-10 bg-muted/40 border-border/40 hover:bg-muted/60 transition-colors">
                  <div className="flex items-center gap-2 text-sm">
                    <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {BRANCH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Warning if no agents or models */}
          {(hasNoAgents || hasNoModels) && !isLoadingOptions && (
            <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-600 dark:text-amber-400">
                {hasNoAgents && hasNoModels
                  ? t("workspace.createTaskDialog.noAgentsOrModels", "No agents or models configured. Please configure them in Settings.")
                  : hasNoAgents
                  ? t("workspace.createTaskDialog.noAgentsWarning", "No agents configured. Please configure an agent in Settings.")
                  : t("workspace.createTaskDialog.noModelsWarning", "No models configured. Please configure a model in Settings.")}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/40 bg-muted/20">
          {/* Left: Attachment button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  type="button"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {t("workspace.createTaskDialog.attachment", "Add attachment")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Right: Auto-start + Create */}
          <div className="flex items-center gap-3">
            {/* Auto-start toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="auto-start"
                      checked={autoStart}
                      onCheckedChange={setAutoStart}
                      className="data-[state=checked]:bg-green-500"
                    />
                    <Label
                      htmlFor="auto-start"
                      className={cn(
                        "text-sm cursor-pointer flex items-center gap-1.5 transition-colors",
                        autoStart ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
                      )}
                    >
                      <Play className="h-3.5 w-3.5" />
                      {t("workspace.createTaskDialog.autoStart", "Start immediately")}
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {t("workspace.createTaskDialog.autoStartHint", "Start task execution after creation")}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Create button */}
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting || (hasNoAgents && hasNoModels)}
              className="h-9 px-4 gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("workspace.createTaskDialog.creating", "Creating...")}
                </>
              ) : (
                <>
                  {t("workspace.createTaskDialog.create", "Create Task")}
                  <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono bg-primary-foreground/20 rounded">
                    <Command className="h-2.5 w-2.5" />
                    <span>↵</span>
                  </kbd>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
