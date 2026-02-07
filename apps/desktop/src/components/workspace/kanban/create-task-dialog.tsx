"use client";

import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  Settings2,
  GitBranch,
  ImagePlus,
  Loader2,
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

// Agent types available
const AGENT_TYPES = [
  { value: "CLAUDE_CODE", label: "CLAUDE_CODE" },
  { value: "GEMINI", label: "GEMINI" },
  { value: "OPENCODE", label: "OPENCODE" },
] as const;

// Model options
const MODEL_OPTIONS = [
  { value: "opus", label: "OPUS" },
  { value: "sonnet", label: "SONNET" },
  { value: "haiku", label: "HAIKU" },
] as const;

export interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTaskData) => Promise<void>;
  defaultColumnId?: string;
  isSubmitting?: boolean;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  agentType: string;
  model: string;
  branch: string;
  autoStart: boolean;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onSubmit,
  defaultColumnId: _defaultColumnId,
  isSubmitting = false,
}: CreateTaskDialogProps) {
  const { t } = useTranslation();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [agentType, setAgentType] = useState("CLAUDE_CODE");
  const [model, setModel] = useState("opus");
  const [branch, setBranch] = useState("main");
  const [autoStart, setAutoStart] = useState(false);

  // Reset form when dialog opens
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      setTitle("");
      setDescription("");
      setAgentType("CLAUDE_CODE");
      setModel("opus");
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
      agentType,
      model,
      branch,
      autoStart,
    });

    handleOpenChange(false);
  }, [title, description, agentType, model, branch, autoStart, onSubmit, handleOpenChange]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[640px] p-0 gap-0 overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t("workspace.createTask", "Create Task")}</DialogTitle>
        </DialogHeader>

        {/* Title Input */}
        <div className="p-4 pb-0">
          <Input
            placeholder={t("workspace.taskTitle", "任务标题")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-medium border-border/60 bg-muted/30 h-12 px-4"
            autoFocus
          />
        </div>

        {/* Description Textarea */}
        <div className="p-4">
          <Textarea
            placeholder={t("workspace.taskDescriptionPlaceholder", "添加更多详情（可选）。输入 @ 搜索文件。")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[200px] resize-none border-border/60 bg-muted/30 text-sm"
          />
        </div>

        {/* Options Row */}
        <div className="px-4 pb-4 grid grid-cols-3 gap-3">
          {/* Agent Type Selector */}
          <Select value={agentType} onValueChange={setAgentType}>
            <SelectTrigger className="h-12 bg-muted/30 border-border/60">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {AGENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Model Selector */}
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="h-12 bg-muted/30 border-border/60">
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Branch Selector */}
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="h-12 bg-muted/30 border-border/60">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="main">main</SelectItem>
              <SelectItem value="develop">develop</SelectItem>
              <SelectItem value="feature">feature</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/20">
          {/* Left: Attachment */}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 border-border/60"
            type="button"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>

          {/* Right: Auto-start toggle + Create button */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="auto-start"
                checked={autoStart}
                onCheckedChange={setAutoStart}
              />
              <Label htmlFor="auto-start" className="text-sm cursor-pointer">
                {t("workspace.autoStart", "开始")}
              </Label>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting}
              className="h-10 px-6"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("workspace.create", "创建")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
