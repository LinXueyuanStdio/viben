import * as React from "react";
import { NavLink } from "react-router-dom";
import { FolderOpen, Plus, Globe, Folder, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarSection } from "./sidebar-section";
import { useLocalWorkspaces } from "@/hooks/use-workspaces";
import { useTranslation } from "react-i18next";
import type { Workspace } from "@/types";

interface WorkspaceSectionProps {
  collapsed?: boolean;
}

/**
 * Workspace section in sidebar showing list of workspaces
 * with ability to add new workspaces.
 */
export function WorkspaceSection({ collapsed = false }: WorkspaceSectionProps) {
  const { t } = useTranslation();
  const {
    workspaces,
    activeWorkspaceId,
    isLoading,
    addWorkspace,
    selectWorkspace,
  } = useLocalWorkspaces();

  const [isAdding, setIsAdding] = React.useState(false);

  const handleAddWorkspace = async () => {
    setIsAdding(true);
    try {
      const workspace = await addWorkspace();
      if (workspace) {
        selectWorkspace(workspace.id);
      }
    } catch {
      // Error handled in hook
    } finally {
      setIsAdding(false);
    }
  };

  // Add workspace button
  const addButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={(e) => {
            e.stopPropagation();
            handleAddWorkspace();
          }}
          disabled={isAdding}
        >
          {isAdding ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {t("workspace.addWorkspace")}
      </TooltipContent>
    </Tooltip>
  );

  if (collapsed) {
    // In collapsed mode, show workspace icons that link to workspace detail pages
    return (
      <div className="space-y-1">
        {workspaces.length > 0 ? (
          workspaces.slice(0, 3).map((ws) => (
            <Tooltip key={ws.id}>
              <TooltipTrigger asChild>
                <NavLink
                  to={`/workspace/${ws.id}`}
                  onClick={() => selectWorkspace(ws.id)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center justify-center rounded-lg p-2",
                      "transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )
                  }
                >
                  {ws.type === "global" ? (
                    <Globe className="h-4 w-4" />
                  ) : (
                    <Folder className="h-4 w-4" />
                  )}
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right">
                {ws.name}
              </TooltipContent>
            </Tooltip>
          ))
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full"
                onClick={handleAddWorkspace}
                disabled={isAdding}
              >
                {isAdding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderOpen className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {t("workspace.addWorkspace")}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <SidebarSection
      title={t("workspace.workspaces")}
      collapsible
      defaultOpen
      headerAction={addButton}
    >
      {isLoading && workspaces.length === 0 ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : workspaces.length === 0 ? (
        <div className="px-3 py-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            {t("workspace.noWorkspaces")}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddWorkspace}
            disabled={isAdding}
          >
            {isAdding ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Plus className="h-3 w-3 mr-1" />
            )}
            {t("workspace.addWorkspace")}
          </Button>
        </div>
      ) : (
        <nav className="flex flex-col gap-1">
          {workspaces.map((workspace) => (
            <WorkspaceItem
              key={workspace.id}
              workspace={workspace}
              isActive={workspace.id === activeWorkspaceId}
              onSelect={() => selectWorkspace(workspace.id)}
            />
          ))}
        </nav>
      )}
    </SidebarSection>
  );
}

interface WorkspaceItemProps {
  workspace: Workspace;
  isActive: boolean;
  onSelect: () => void;
}

function WorkspaceItem({ workspace, isActive, onSelect }: WorkspaceItemProps) {
  const isGlobal = workspace.type === "global";

  return (
    <NavLink
      to={`/workspace/${workspace.id}`}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
        "transition-all duration-200",
        isActive
          ? [
              "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
              "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
              "before:h-6 before:w-1 before:rounded-r-full before:bg-primary",
            ]
          : [
              "text-sidebar-foreground/70",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            ]
      )}
    >
      {isGlobal ? (
        <Globe className="h-4 w-4 shrink-0 text-primary" />
      ) : (
        <Folder className="h-4 w-4 shrink-0 group-hover:text-primary transition-colors" />
      )}
      <span className="truncate">{workspace.name}</span>
      {isGlobal && (
        <span className="ml-auto text-[10px] uppercase text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">
          Default
        </span>
      )}
    </NavLink>
  );
}
