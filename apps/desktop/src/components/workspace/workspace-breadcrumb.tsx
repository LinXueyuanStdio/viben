import { useState } from "react";
import { Link } from "react-router-dom";
import { Folder, Globe, Copy, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/types";

export interface BreadcrumbSegment {
  label: string;
  href: string;
  /** Full path for tooltip display */
  path?: string;
  /** Custom click handler (overrides href navigation) */
  onClick?: () => void;
}

interface WorkspaceBreadcrumbProps {
  workspace: Workspace;
  segments?: BreadcrumbSegment[];
  className?: string;
}

export function WorkspaceBreadcrumb({
  workspace,
  segments = [],
  className,
}: WorkspaceBreadcrumbProps) {
  const [pathCopied, setPathCopied] = useState(false);

  const isGlobal = workspace.type === "global";

  const handleCopyPath = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!workspace.path) return;
    try {
      await navigator.clipboard.writeText(workspace.path);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = workspace.path;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setPathCopied(true);
      setTimeout(() => setPathCopied(false), 2000);
    }
  };

  const Icon = isGlobal ? Globe : Folder;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1", className)}
    >
      {/* Root: Workspace name with icon */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-2.5 gap-2 font-medium",
                "hover:bg-accent rounded-lg",
                segments.length === 0 && "bg-accent/50"
              )}
              asChild={segments.length > 0}
            >
              {segments.length > 0 ? (
                <Link to={`/workspace/${workspace.id}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate max-w-[200px]">{workspace.name}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate max-w-[200px]">{workspace.name}</span>
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            className="max-w-md p-3"
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-sm">{workspace.name}</span>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <code className="text-xs text-muted-foreground font-mono flex-1 break-all">
                  {workspace.path}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={handleCopyPath}
                >
                  {pathCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Additional segments */}
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const hasPath = !!segment.path;
        const hasOnClick = !!segment.onClick;

        const segmentContent = (
          <span className="truncate max-w-[200px]">{segment.label}</span>
        );

        // If segment has a path, wrap in tooltip
        const wrapWithTooltip = (content: React.ReactNode) => {
          if (!hasPath) return content;

          return (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  className="max-w-md p-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium text-sm">{segment.label}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                      <code className="text-xs text-muted-foreground font-mono flex-1 break-all">
                        {segment.path}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!segment.path) return;
                          try {
                            await navigator.clipboard.writeText(segment.path);
                          } catch {
                            const textArea = document.createElement("textarea");
                            textArea.value = segment.path;
                            document.body.appendChild(textArea);
                            textArea.select();
                            document.execCommand("copy");
                            document.body.removeChild(textArea);
                          }
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        };

        return (
          <div key={`${segment.href}-${index}`} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            {isLast && !hasOnClick ? (
              // Current page - not clickable (unless has onClick)
              wrapWithTooltip(
                <span className="text-sm font-medium px-2 py-1 bg-accent/50 rounded-md">
                  {segmentContent}
                </span>
              )
            ) : hasOnClick ? (
              // Has custom onClick handler
              wrapWithTooltip(
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-8 px-2 font-medium",
                    isLast && "bg-accent/50"
                  )}
                  onClick={segment.onClick}
                >
                  {segmentContent}
                </Button>
              )
            ) : (
              // Link navigation
              wrapWithTooltip(
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 font-medium"
                  asChild
                >
                  <Link to={segment.href}>{segmentContent}</Link>
                </Button>
              )
            )}
          </div>
        );
      })}
    </nav>
  );
}
