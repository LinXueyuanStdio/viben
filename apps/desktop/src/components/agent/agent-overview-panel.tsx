/**
 * Agent Overview Panel Component
 *
 * Settings tab panel for agent overview including:
 * - Basic information (name, description)
 * - Template settings (isTemplate toggle, templateDescription, tags)
 * - Storage location (scope badge, paths with open/copy)
 */
import * as React from "react";
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  Check,
  ExternalLink,
  X,
  Plus,
  FolderOpen,
  Globe,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AgentOverviewPanelProps {
  name: string;
  description: string;
  isTemplate: boolean;
  templateDescription: string;
  templateTags: string[];
  agentDir: string;
  configPath: string;
  isWorkspaceScoped: boolean;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onIsTemplateChange: (isTemplate: boolean) => void;
  onTemplateDescriptionChange: (description: string) => void;
  onTemplateTagsChange: (tags: string[]) => void;
  onOpenFolder: () => void;
  onCopyPath: (path: string) => void;
}

export function AgentOverviewPanel({
  name,
  description,
  isTemplate,
  templateDescription,
  templateTags,
  agentDir,
  configPath,
  isWorkspaceScoped,
  onNameChange,
  onDescriptionChange,
  onIsTemplateChange,
  onTemplateDescriptionChange,
  onTemplateTagsChange,
  onOpenFolder,
  onCopyPath,
}: AgentOverviewPanelProps) {
  const { t } = useTranslation();

  // Copy feedback state
  const [copiedPath, setCopiedPath] = useState<"agentDir" | "configPath" | null>(null);

  // Tag input state
  const [tagInput, setTagInput] = useState("");

  // Handle copy with visual feedback
  const handleCopy = useCallback((path: string, type: "agentDir" | "configPath") => {
    onCopyPath(path);
    setCopiedPath(type);
    setTimeout(() => setCopiedPath(null), 2000);
  }, [onCopyPath]);

  // Handle adding a tag
  const handleAddTag = useCallback(() => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !templateTags.includes(trimmedTag)) {
      onTemplateTagsChange([...templateTags, trimmedTag]);
      setTagInput("");
    }
  }, [tagInput, templateTags, onTemplateTagsChange]);

  // Handle removing a tag
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    onTemplateTagsChange(templateTags.filter((tag) => tag !== tagToRemove));
  }, [templateTags, onTemplateTagsChange]);

  // Handle tag input key press
  const handleTagKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

  return (
    <div className="space-y-6 p-4">
      {/* Section 1: Basic Information */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-3">
            {t("settingsAgents.basicInfo")}
          </h3>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="agent-name" className="text-xs font-medium">
            {t("settingsAgents.name")}
          </Label>
          <Input
            id="agent-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t("settingsAgents.namePlaceholder")}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="agent-description" className="text-xs font-medium">
            {t("settingsAgents.descriptionLabel")}
          </Label>
          <Textarea
            id="agent-description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={t("settingsAgents.descriptionPlaceholder")}
            rows={3}
            className="resize-none"
          />
        </div>
      </div>

      {/* Section 2: Template Settings */}
      <div className="space-y-4 pt-4 border-t">
        <div>
          <h3 className="text-sm font-semibold mb-3">
            {t("settingsAgents.templateSettings")}
          </h3>
        </div>

        {/* Is Template Switch */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="is-template" className="text-sm font-medium">
              {t("settingsAgents.markAsTemplate")}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t("settingsAgents.markAsTemplateDesc")}
            </p>
          </div>
          <Switch
            id="is-template"
            checked={isTemplate}
            onCheckedChange={onIsTemplateChange}
          />
        </div>

        {/* Template Description and Tags - only shown when isTemplate is true */}
        {isTemplate && (
          <div className="space-y-4 pl-0 pt-2">
            {/* Template Description */}
            <div className="space-y-2">
              <Label htmlFor="template-description" className="text-xs font-medium">
                {t("settingsAgents.templateDescription")}
              </Label>
              <Textarea
                id="template-description"
                value={templateDescription}
                onChange={(e) => onTemplateDescriptionChange(e.target.value)}
                placeholder={t("settingsAgents.templateDescriptionPlaceholder")}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {t("settingsAgents.templateDescriptionHint")}
              </p>
            </div>

            {/* Template Tags */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {t("settingsAgents.templateTags")}
              </Label>

              {/* Tag Input */}
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={t("settingsAgents.addTagPlaceholder")}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Tags Display */}
              {templateTags.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {templateTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="flex items-center gap-1 pr-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Storage Location */}
      <div className="space-y-4 pt-4 border-t">
        <div>
          <h3 className="text-sm font-semibold mb-3">
            {t("settingsAgents.storageLocation")}
          </h3>
        </div>

        {/* Scope Badge */}
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium">
            {t("settingsAgents.scope")}
          </Label>
          <Badge
            variant={isWorkspaceScoped ? "default" : "secondary"}
            className={cn(
              "text-xs gap-1",
              isWorkspaceScoped
                ? "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 border-blue-500/30"
                : "bg-muted text-muted-foreground"
            )}
          >
            {isWorkspaceScoped ? (
              <>
                <FolderOpen className="h-3 w-3" />
                {t("settingsAgents.workspaceScoped")}
              </>
            ) : (
              <>
                <Globe className="h-3 w-3" />
                {t("settingsAgents.globalScoped")}
              </>
            )}
          </Badge>
        </div>

        {/* Agent Directory */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">
            {t("settingsAgents.agentDirectory")}
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">
              {agentDir || t("settingsAgents.notAvailable")}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onOpenFolder}
              disabled={!agentDir}
              title={t("settingsAgents.openInExplorer")}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => handleCopy(agentDir, "agentDir")}
              disabled={!agentDir}
              title={t("common.copyPath")}
            >
              {copiedPath === "agentDir" ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Config Path */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">
            {t("settingsAgents.configFile")}
          </Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono break-all">
              {configPath || t("settingsAgents.notAvailable")}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => handleCopy(configPath, "configPath")}
              disabled={!configPath}
              title={t("common.copyPath")}
            >
              {copiedPath === "configPath" ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
