"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import {
  cn,
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@viben/ui";
import { X, CheckSquare, Square, ChevronDown, Trash2, Flag, CircleDot } from "lucide-react";
import { PRIORITY_CONFIG, PRIORITY_ORDER, type IssuePriority } from "../primitives/priority-config";

export interface BulkActionsBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkStatusChange?: (status: string) => void;
  onBulkPriorityChange?: (priority: string) => void;
  onBulkDelete?: () => void;
  statuses?: Array<{ id: string; name: string; color?: string }>;
  className?: string;
}

export function BulkActionsBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkStatusChange,
  onBulkPriorityChange,
  onBulkDelete,
  statuses = [],
  className,
}: BulkActionsBarProps) {
  const { t } = useTranslation();
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "transform transition-all duration-200 ease-out",
        selectedCount > 0
          ? "translate-y-0 opacity-100"
          : "translate-y-full opacity-0 pointer-events-none",
        className
      )}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Selection Info */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="h-8 w-8 p-0"
              aria-label={t("kanban.bulk.clearSelection")}
            >
              <X className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {t("kanban.bulk.selected", { count: selectedCount })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={isAllSelected ? onClearSelection : onSelectAll}
              className="h-8 gap-1.5 text-xs"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="h-3.5 w-3.5" />
                  {t("kanban.bulk.deselectAll")}
                </>
              ) : (
                <>
                  <Square className="h-3.5 w-3.5" />
                  {t("kanban.bulk.selectAll", { count: totalCount })}
                </>
              )}
            </Button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Status Dropdown */}
            {onBulkStatusChange && statuses.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    <CircleDot className="h-4 w-4" />
                    {t("kanban.bulk.status")}
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{t("kanban.bulk.setStatus")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {statuses.map((status) => (
                    <DropdownMenuItem
                      key={status.id}
                      onClick={() => onBulkStatusChange(status.id)}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: status.color
                              ? `hsl(var(${status.color}))`
                              : "hsl(var(--muted-foreground))",
                          }}
                        />
                        {status.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Priority Dropdown */}
            {onBulkPriorityChange && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    <Flag className="h-4 w-4" />
                    {t("kanban.bulk.priority")}
                    <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>{t("kanban.bulk.setPriority")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {PRIORITY_ORDER.map((priority) => {
                    const config = PRIORITY_CONFIG[priority];
                    const Icon = config.Icon;
                    return (
                      <DropdownMenuItem
                        key={priority}
                        onClick={() => onBulkPriorityChange(priority)}
                      >
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: config.color }} />
                          {t(config.labelKey)}
                        </span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Delete Button */}
            {onBulkDelete && (
              <Button
                variant="outline"
                size="sm"
                onClick={onBulkDelete}
                className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
                {t("kanban.common.delete")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

BulkActionsBar.displayName = "BulkActionsBar";
