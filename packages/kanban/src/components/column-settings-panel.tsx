"use client";

import * as React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, AlertTriangle, Check } from "lucide-react";
import {
  Button,
  Input,
  Label,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@viben/ui";
import { COLUMN_COLORS, type ColumnConfig } from "./board-settings-types";

export interface ColumnSettingsPanelProps {
  column: ColumnConfig;
  onChange: (column: ColumnConfig) => void;
  onDelete?: () => void;
  canDelete?: boolean;
  taskCount?: number;
  className?: string;
}

export function ColumnSettingsPanel({
  column,
  onChange,
  onDelete,
  canDelete = true,
  taskCount = 0,
  className,
}: ColumnSettingsPanelProps) {
  const { t } = useTranslation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...column, name: e.target.value });
  };

  const handleColorChange = (color: string) => {
    onChange({ ...column, color });
  };

  const handleWipLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "") {
      onChange({ ...column, wipLimit: undefined });
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue >= 0) {
        onChange({ ...column, wipLimit: numValue });
      }
    }
  };

  const handleDeleteClick = () => {
    if (taskCount > 0) {
      setDeleteDialogOpen(true);
    } else {
      onDelete?.();
    }
  };

  const handleConfirmDelete = () => {
    setDeleteDialogOpen(false);
    onDelete?.();
  };

  const currentColor = COLUMN_COLORS.find((c) => c.value === column.color);

  return (
    <div className={cn("space-y-4 p-4 border rounded-lg bg-card", className)}>
      {/* Column Name */}
      <div className="space-y-2">
        <Label htmlFor={`column-name-${column.id}`}>{t("kanban.columnSettings.columnName")}</Label>
        <Input
          id={`column-name-${column.id}`}
          value={column.name}
          onChange={handleNameChange}
          placeholder={t("kanban.columnSettings.columnNamePlaceholder")}
        />
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <Label>{t("kanban.columnSettings.color")}</Label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
            >
              <div
                className="w-4 h-4 rounded-full border shrink-0"
                style={{ backgroundColor: column.color }}
              />
              <span>{currentColor ? t(currentColor.nameKey) : t("kanban.columnSettings.selectColor")}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            {COLUMN_COLORS.map((colorOption) => (
              <DropdownMenuItem
                key={colorOption.value}
                onClick={() => handleColorChange(colorOption.value)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <div
                  className="w-4 h-4 rounded-full border shrink-0"
                  style={{ backgroundColor: colorOption.value }}
                />
                <span className="flex-1">{t(colorOption.nameKey)}</span>
                {column.color === colorOption.value && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* WIP Limit */}
      <div className="space-y-2">
        <Label htmlFor={`wip-limit-${column.id}`}>{t("kanban.columnSettings.wipLimit")}</Label>
        <Input
          id={`wip-limit-${column.id}`}
          type="number"
          min={0}
          value={column.wipLimit ?? ""}
          onChange={handleWipLimitChange}
          placeholder={t("kanban.columnSettings.noLimit")}
        />
        <p className="text-xs text-muted-foreground">
          {t("kanban.columnSettings.wipLimitDescription")}
        </p>
      </div>

      {/* Delete Button */}
      {onDelete && canDelete && (
        <div className="pt-2 border-t">
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDeleteClick}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("kanban.columnSettings.deleteColumn")}
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t("kanban.columnSettings.confirmDelete")}
            </DialogTitle>
            <DialogDescription>
              {t("kanban.columnSettings.deleteWarning", { count: taskCount })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {t("kanban.common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              {t("kanban.columnSettings.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

ColumnSettingsPanel.displayName = "ColumnSettingsPanel";
