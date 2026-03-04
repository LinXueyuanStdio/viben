"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Eye,
  EyeOff,
  Palette,
  Settings,
  Trash2,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  Switch,
  Input,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  cn,
} from "@viben/ui";
import { COLUMN_COLORS, type ColumnConfig } from "./board-settings-types";

export interface BoardSettingsDialogTranslations {
  title?: string;
  description?: string;
  doubleClickToEdit?: string;
  changeColor?: string;
  deleteColumn?: string;
  noColumns?: string;
  cancel?: string;
  saveChanges?: string;
  colors?: Record<string, string>;
}

export interface BoardSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  translations?: BoardSettingsDialogTranslations;
}

interface SortableColumnItemProps {
  column: ColumnConfig;
  onUpdate: (id: string, updates: Partial<ColumnConfig>) => void;
  onDelete: (id: string) => void;
  translations?: BoardSettingsDialogTranslations;
}

function SortableColumnItem({
  column,
  onUpdate,
  onDelete,
  translations,
}: SortableColumnItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(column.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  useEffect(() => {
    setEditValue(column.name);
  }, [column.name]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== column.name) {
      onUpdate(column.id, { name: trimmed });
    } else {
      setEditValue(column.name);
    }
    setIsEditing(false);
  }, [editValue, column.id, column.name, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setEditValue(column.name);
        setIsEditing(false);
      }
    },
    [handleSave, column.name]
  );

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  }, []);

  const handleColorSelect = useCallback(
    (color: string) => {
      onUpdate(column.id, { color });
    },
    [column.id, onUpdate]
  );

  const handleVisibilityToggle = useCallback(
    (checked: boolean) => {
      onUpdate(column.id, { visible: checked });
    },
    [column.id, onUpdate]
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border bg-card",
        "transition-colors duration-200",
        isDragging && "opacity-50 shadow-lg",
        !column.visible && "opacity-60"
      )}
    >
      {/* Drag Handle */}
      <button
        type="button"
        className={cn(
          "cursor-grab touch-none p-1 rounded",
          "text-muted-foreground hover:text-foreground",
          "hover:bg-muted/50 transition-colors"
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Color Indicator */}
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: column.color }}
      />

      {/* Column Name (Editable) */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="h-7 py-1 px-2 text-sm"
          />
        ) : (
          <span
            className={cn(
              "block truncate text-sm font-medium cursor-text",
              "hover:bg-muted/50 rounded px-2 py-1 -mx-2",
              "transition-colors duration-150"
            )}
            onDoubleClick={handleDoubleClick}
            title={translations?.doubleClickToEdit ?? "Double-click to edit"}
          >
            {column.name}
          </span>
        )}
      </div>

      {/* Color Picker Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            title={translations?.changeColor ?? "Change color"}
          >
            <Palette className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {COLUMN_COLORS.map((colorOption) => (
            <DropdownMenuItem
              key={colorOption.value}
              onClick={() => handleColorSelect(colorOption.value)}
              className="flex items-center gap-2"
            >
              <div
                className="w-4 h-4 rounded-full border"
                style={{ backgroundColor: colorOption.value }}
              />
              <span className="flex-1">{translations?.colors?.[colorOption.key] ?? colorOption.name}</span>
              {column.color === colorOption.value && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Visibility Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        {column.visible ? (
          <Eye className="h-4 w-4 text-muted-foreground" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
        <Switch
          checked={column.visible}
          onCheckedChange={handleVisibilityToggle}
        />
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(column.id)}
        title={translations?.deleteColumn ?? "Delete column"}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function BoardSettingsDialog({
  open,
  onOpenChange,
  columns,
  onColumnsChange,
  translations,
}: BoardSettingsDialogProps) {
  const [localColumns, setLocalColumns] = useState<ColumnConfig[]>([]);

  // Initialize local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalColumns([...columns].sort((a, b) => a.order - b.order));
    }
  }, [open, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLocalColumns((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);
        // Update order values
        return newItems.map((item, index) => ({
          ...item,
          order: index,
        }));
      });
    }
  }, []);

  const handleUpdate = useCallback(
    (id: string, updates: Partial<ColumnConfig>) => {
      setLocalColumns((items) =>
        items.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        )
      );
    },
    []
  );

  const handleDelete = useCallback((id: string) => {
    setLocalColumns((items) => {
      const filtered = items.filter((item) => item.id !== id);
      // Re-calculate order values
      return filtered.map((item, index) => ({
        ...item,
        order: index,
      }));
    });
  }, []);

  const handleSave = useCallback(() => {
    onColumnsChange(localColumns);
    onOpenChange(false);
  }, [localColumns, onColumnsChange, onOpenChange]);

  const handleCancel = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {translations?.title ?? "Board Settings"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            {translations?.description ?? "Drag to reorder columns. Double-click to rename. Toggle visibility to show/hide columns."}
          </p>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localColumns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {localColumns.map((column) => (
                  <SortableColumnItem
                    key={column.id}
                    column={column}
                    onUpdate={handleUpdate}
                    onDelete={handleDelete}
                    translations={translations}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {localColumns.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {translations?.noColumns ?? "No columns configured"}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {translations?.cancel ?? "Cancel"}
          </Button>
          <Button onClick={handleSave}>{translations?.saveChanges ?? "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

BoardSettingsDialog.displayName = "BoardSettingsDialog";
