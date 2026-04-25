/**
 * Tools tab content for the right sidebar
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolsTabContentProps } from "./types";
import { getToolIcon, isMcpTool, isBuiltinTool, getMcpToolInfo } from "./utils";

/**
 * Empty state component
 */
function EmptyState({
  icon: Icon,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="bg-muted/30 rounded-full p-3 mb-3">
        <Icon className="h-5 w-5 text-muted-foreground/40" />
      </div>
      <p className="text-sm text-muted-foreground/60">{description}</p>
    </div>
  );
}

/**
 * Tools tab content
 */
export function ToolsTabContent({
  tools,
  onToolSelect,
}: ToolsTabContentProps) {
  const { t } = useTranslation();

  // Group tools by type (MCP vs Built-in)
  const mcpTools = tools.filter((t) => isMcpTool(t.name));
  const builtinTools = tools.filter((t) => isBuiltinTool(t.name));

  if (tools.length === 0) {
    return <EmptyState icon={Wrench} description={t("chat.noTools")} />;
  }

  // Count tools by name for display
  const toolCounts = tools.reduce((acc, tool) => {
    const key = tool.displayName;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-3">
      {/* MCP Tools Section */}
      {mcpTools.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">MCP</span>
            <span>{t("common.calls", { count: mcpTools.length })}</span>
          </div>
          <div className="space-y-1 rounded-md border border-border/30 bg-muted/20 p-2 max-h-[250px] overflow-y-auto">
            {Array.from(new Map(mcpTools.map((t) => [t.displayName, t])).values()).map((tool) => {
              const IconComponent = getToolIcon(tool.name);
              const count = toolCounts[tool.displayName];
              const info = getMcpToolInfo(tool.name);
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onToolSelect?.(tool)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md py-1.5 px-2 text-left transition-colors",
                    "hover:bg-accent/50",
                    tool.isError && "text-red-400"
                  )}
                >
                  <IconComponent
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      tool.isError ? "text-red-400" : "text-muted-foreground/60"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="truncate text-sm text-foreground/80 block">
                      {tool.displayName}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      {info.server}
                    </span>
                  </div>
                  {count > 1 && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      x{count}
                    </span>
                  )}
                  {tool.isError && (
                    <span className="shrink-0 rounded bg-red-500/10 px-1 py-0.5 text-[10px] text-red-500">
                      {t("chat.error")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Built-in Tools Section */}
      {builtinTools.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5">{t("common.builtIn")}</span>
            <span>{t("common.calls", { count: builtinTools.length })}</span>
          </div>
          <div className="space-y-1 rounded-md border border-border/30 bg-muted/20 p-2 max-h-[250px] overflow-y-auto">
            {Array.from(new Map(builtinTools.map((t) => [t.displayName, t])).values()).map((tool) => {
              const IconComponent = getToolIcon(tool.name);
              const count = toolCounts[tool.displayName];
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onToolSelect?.(tool)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md py-1.5 px-2 text-left transition-colors",
                    "hover:bg-accent/50",
                    tool.isError && "text-red-400"
                  )}
                >
                  <IconComponent
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      tool.isError ? "text-red-400" : "text-muted-foreground/60"
                    )}
                  />
                  <span className="truncate text-sm text-foreground/80 flex-1">
                    {tool.displayName}
                  </span>
                  {count > 1 && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      x{count}
                    </span>
                  )}
                  {tool.isError && (
                    <span className="shrink-0 rounded bg-red-500/10 px-1 py-0.5 text-[10px] text-red-500">
                      {t("chat.error")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
