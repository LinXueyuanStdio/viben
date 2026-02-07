"use client";

import * as React from "react";
import { useState } from "react";
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
        <Label htmlFor={`column-name-${column.id}`}>列名</Label>
        <Input
          id={`column-name-${column.id}`}
          value={column.name}
          onChange={handleNameChange}
          placeholder="输入列名..."
        />
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <Label>颜色</Label>
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
              <span>{currentColor?.name || "选择颜色"}</span>
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
                <span className="flex-1">{colorOption.name}</span>
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
        <Label htmlFor={`wip-limit-${column.id}`}>WIP 限制 (可选)</Label>
        <Input
          id={`wip-limit-${column.id}`}
          type="number"
          min={0}
          value={column.wipLimit ?? ""}
          onChange={handleWipLimitChange}
          placeholder="无限制"
        />
        <p className="text-xs text-muted-foreground">
          设置此列可同时包含的最大任务数
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
            删除此列
          </Button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              此列当前包含 <strong>{taskCount}</strong> 个任务。删除此列将同时移除这些任务。此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

ColumnSettingsPanel.displayName = "ColumnSettingsPanel";
