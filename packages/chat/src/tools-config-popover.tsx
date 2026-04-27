/**
 * Tools Configuration Popover
 *
 * Shows a list of available tools with enable/disable toggles.
 */

import * as React from "react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Wrench } from "lucide-react";
import { cn, Input, Switch, ScrollArea } from "@viben/ui";
import type { ToolConfig } from "./types";

export interface ToolsConfigPopoverProps {
  tools: ToolConfig[];
  onToggleTool: (toolId: string, enabled: boolean) => void;
  className?: string;
}

export function ToolsConfigPopover({
  tools,
  onToggleTool,
  className,
}: ToolsConfigPopoverProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(
      (tool) =>
        tool.name.toLowerCase().includes(query) ||
        tool.description?.toLowerCase().includes(query)
    );
  }, [tools, searchQuery]);

  const enabledCount = tools.filter((t) => t.enabled).length;

  return (
    <div className={cn("w-[320px]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            {t("chat.configureTools", "Configure Tools")}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {enabledCount}/{tools.length} {t("common.enabled", "enabled")}
        </span>
      </div>

      {/* Search */}
      {tools.length > 5 && (
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("inspector.searchTools", "Search tools...")}
            className="h-8 pl-8 text-sm"
          />
        </div>
      )}

      {/* Tools list */}
      <ScrollArea className="max-h-[300px]">
        {filteredTools.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {tools.length === 0
              ? t("inspector.noToolsFound", "No tools available")
              : t("common.noResults", "No results found")}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredTools.map((tool) => (
              <div
                key={tool.id}
                className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                <Switch
                  checked={tool.enabled}
                  onCheckedChange={(checked) => onToggleTool(tool.id, checked)}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{tool.name}</div>
                  {tool.description && (
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {tool.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
