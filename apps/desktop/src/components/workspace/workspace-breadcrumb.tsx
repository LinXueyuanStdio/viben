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
      {segments.map((segment, index) => (
        <div key={segment.href} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          {index === segments.length - 1 ? (
            // Current page - not clickable
            <span className="text-sm font-medium px-2 py-1 bg-accent/50 rounded-md">
              {segment.label}
            </span>
          ) : (
            // Clickable segment
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 font-medium"
              asChild
            >
              <Link to={segment.href}>{segment.label}</Link>
            </Button>
          )}
        </div>
      ))}
    </nav>
  );
}
