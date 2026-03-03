/**
 * Issue List Header Component
 *
 * Search bar, filters, and action buttons for the issue list.
 */

import { useTranslation } from "react-i18next";
import {
  Search,
  CircleDot,
  CircleCheck,
  Circle,
  RefreshCw,
  FileDown,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface IssueListHeaderProps {
  stateFilter: "open" | "closed" | "all";
  onStateFilterChange: (state: "open" | "closed" | "all") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onRefresh: () => void;
  isLoading: boolean;
  onImportSelected: () => Promise<void>;
}

export function IssueListHeader({
  stateFilter,
  onStateFilterChange,
  searchQuery,
  onSearchChange,
  selectedCount,
  totalCount,
  onSelectAll,
  onRefresh,
  isLoading,
  onImportSelected,
}: IssueListHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-border p-3 space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("workspaceSettings.github.issues.search", "Search issues...")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Filters and actions row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Select all checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedCount > 0 && selectedCount === totalCount}
              onCheckedChange={onSelectAll}
              disabled={totalCount === 0}
            />
            {selectedCount > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedCount} {t("common.selected")}
              </span>
            )}
          </div>

          {/* State filter */}
          <Select
            value={stateFilter}
            onValueChange={(v: "open" | "closed" | "all") => onStateFilterChange(v)}
          >
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">
                <span className="flex items-center gap-2">
                  <CircleDot className="h-3 w-3 text-green-500" />
                  {t("workspaceSettings.github.issues.open")}
                </span>
              </SelectItem>
              <SelectItem value="closed">
                <span className="flex items-center gap-2">
                  <CircleCheck className="h-3 w-3 text-purple-500" />
                  {t("workspaceSettings.github.issues.closed")}
                </span>
              </SelectItem>
              <SelectItem value="all">
                <span className="flex items-center gap-2">
                  <Circle className="h-3 w-3 text-muted-foreground" />
                  {t("workspaceSettings.github.issues.all")}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          {/* Import selected */}
          {selectedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onImportSelected}
              className="h-8"
            >
              <FileDown className="h-4 w-4 mr-1" />
              {t("workspaceSettings.github.issues.import")} ({selectedCount})
            </Button>
          )}

          {/* Refresh */}
          <Button
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>

          {/* Settings */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              window.location.hash = "#/workspace-settings/github";
            }}
            className="h-8 w-8 p-0"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
