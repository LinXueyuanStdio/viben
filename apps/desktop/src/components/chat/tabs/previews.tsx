/**
 * Preview components for artifacts and tools
 */
import * as React from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Artifact, ToolUsage } from "@/types";
import { getArtifactIcon, getToolIcon, isMcpTool } from "./utils";

/**
 * Artifact preview content
 */
export function ArtifactPreview({ artifact }: { artifact: Artifact }) {
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        {(() => {
          const IconComponent = getArtifactIcon(artifact.type);
          return <IconComponent className="h-5 w-5 text-muted-foreground" />;
        })()}
        <div>
          <h3 className="font-medium">{artifact.name}</h3>
          <p className="text-xs text-muted-foreground">{artifact.type}</p>
        </div>
      </div>
      {artifact.content && (
        <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-auto max-h-[calc(100vh-300px)] whitespace-pre-wrap break-words font-mono">
          {artifact.content}
        </pre>
      )}
    </div>
  );
}

/**
 * Tool preview content
 */
export function ToolPreview({ tool }: { tool: ToolUsage }) {
  const { t } = useTranslation();

  const formatInput = (input: unknown): string => {
    if (!input) return "No input";
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  const formatOutput = (output: string | undefined): string => {
    if (!output) return "No output";
    if (output.length > 10000) {
      return output.slice(0, 10000) + "\n\n... (truncated)";
    }
    return output;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        {(() => {
          const IconComponent = getToolIcon(tool.name);
          return <IconComponent className="h-5 w-5 text-muted-foreground" />;
        })()}
        <div className="flex items-center gap-2">
          <h3 className="font-medium">{tool.displayName}</h3>
          {isMcpTool(tool.name) && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              MCP
            </span>
          )}
          {tool.isError && (
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-500">
              {t("chat.error")}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">{t("chat.toolInput")}</h4>
          <pre className="bg-muted/50 rounded-lg p-3 text-xs overflow-auto max-h-[200px] whitespace-pre-wrap break-words font-mono">
            {formatInput(tool.input)}
          </pre>
        </div>
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2">{t("chat.toolOutput")}</h4>
          <pre
            className={cn(
              "bg-muted/50 rounded-lg p-3 text-xs overflow-auto max-h-[calc(100vh-400px)] whitespace-pre-wrap break-words font-mono",
              tool.isError && "bg-red-500/10 text-red-400"
            )}
          >
            {formatOutput(tool.output)}
          </pre>
        </div>
      </div>
    </div>
  );
}
