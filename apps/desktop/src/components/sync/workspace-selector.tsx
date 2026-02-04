import { Cloud, Plus, User, Building } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import type { CloudWorkspace } from "@/hooks/use-workspace-sync";

interface WorkspaceSelectorProps {
  /** List of available workspaces */
  workspaces: CloudWorkspace[];
  /** Currently selected workspace */
  selectedWorkspace: CloudWorkspace | null;
  /** Whether workspaces are being loaded */
  loading: boolean;
  /** Callback when a workspace is selected */
  onSelect: (workspaceId: string) => void;
  /** Callback to create a new workspace */
  onCreateNew?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Dropdown to select active workspace with workspace details preview.
 */
export function WorkspaceSelector({
  workspaces,
  selectedWorkspace,
  loading,
  onSelect,
  onCreateNew,
  className,
}: WorkspaceSelectorProps) {
  const { t } = useTranslation();

  // Format the updated time for display
  const formatUpdatedTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("sync.today");
    if (diffDays === 1) return t("sync.yesterday");
    if (diffDays < 7) return t("sync.daysAgo", { count: diffDays });
    return date.toLocaleDateString();
  };

  return (
    <div className={cn("space-y-3", className)}>
      <label className="text-sm font-medium">{t("sync.selectWorkspace")}</label>

      <Select
        value={selectedWorkspace?.id || ""}
        onValueChange={onSelect}
        disabled={loading}
      >
        <SelectTrigger className="w-full rounded-xl">
          <SelectValue placeholder={t("sync.selectWorkspacePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {workspaces.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {loading ? t("common.loading") : t("sync.noWorkspacesFound")}
            </div>
          ) : (
            <>
              {workspaces.map((workspace) => (
                <SelectItem key={workspace.id} value={workspace.id}>
                  <div className="flex items-center gap-2">
                    {workspace.isPersonal ? (
                      <User className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Building className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span>{workspace.name}</span>
                    {workspace.isPersonal && (
                      <span className="text-xs text-muted-foreground">
                        ({t("sync.personal")})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}

              {onCreateNew && (
                <>
                  <SelectSeparator />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      onCreateNew();
                    }}
                    className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t("sync.createNewWorkspace")}
                  </button>
                </>
              )}
            </>
          )}
        </SelectContent>
      </Select>

      {/* Selected Workspace Details */}
      {selectedWorkspace && (
        <div className="p-3 rounded-xl bg-muted/50 space-y-2">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{selectedWorkspace.name}</span>
          </div>

          {selectedWorkspace.description && (
            <p className="text-xs text-muted-foreground">
              {selectedWorkspace.description}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {selectedWorkspace.isPersonal
                ? t("sync.personalWorkspace")
                : t("sync.sharedWorkspace")}
            </span>
            <span>
              {t("sync.updatedAt", {
                time: formatUpdatedTime(selectedWorkspace.updatedAt),
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

WorkspaceSelector.displayName = "WorkspaceSelector";
