/**
 * File Browser Action Components
 *
 * Reusable toolbar components for file browser actions.
 * Can be placed in WorkspaceHeader's rightContent.
 */

import * as React from "react";
import {
  List,
  LayoutGrid,
  Columns3,
  Image,
  FilePlus,
  FolderPlus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  Group,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { ViewMode, SortField, SortDirection, GroupField } from "@/hooks/use-file-browser";

/* -----------------------------------------------------------------------------
 * View Mode Toggle
 * -------------------------------------------------------------------------- */

export interface ViewModeToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewModeToggle({ viewMode, onViewModeChange, className }: ViewModeToggleProps) {
  const modes: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "list", icon: <List className="h-4 w-4" />, label: "List" },
    { mode: "icon", icon: <LayoutGrid className="h-4 w-4" />, label: "Icon" },
    { mode: "column", icon: <Columns3 className="h-4 w-4" />, label: "Column" },
    { mode: "gallery", icon: <Image className="h-4 w-4" />, label: "Gallery" },
  ];

  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-0.5 bg-muted rounded-lg p-0.5", className)}>
        {modes.map(({ mode, icon, label }) => (
          <Tooltip key={mode}>
            <TooltipTrigger asChild>
              <Button
                variant={viewMode === mode ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 w-7 p-0",
                  viewMode === mode && "bg-background shadow-sm"
                )}
                onClick={() => onViewModeChange(mode)}
              >
                {icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

/* -----------------------------------------------------------------------------
 * Sort Dropdown
 * -------------------------------------------------------------------------- */

export interface SortDropdownProps {
  sortField: SortField;
  sortDirection: SortDirection;
  onSortFieldChange: (field: SortField) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  className?: string;
}

export function SortDropdown({
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
  className,
}: SortDropdownProps) {
  const { t } = useTranslation();

  const sortOptions: { value: SortField; label: string }[] = [
    { value: "name", label: t("fileBrowser.sortByName") },
    { value: "size", label: t("fileBrowser.sortBySize") },
    { value: "modified", label: t("fileBrowser.sortByModified") },
    { value: "type", label: t("fileBrowser.sortByType") },
  ];

  const directionOptions: { value: SortDirection; label: string }[] = [
    { value: "asc", label: t("fileBrowser.sortAsc") },
    { value: "desc", label: t("fileBrowser.sortDesc") },
  ];

  // Get current sort label
  const currentSortLabel = sortOptions.find(opt => opt.value === sortField)?.label || sortField;

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 px-2 gap-1", className)}
              >
                <ArrowUpDown className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">{currentSortLabel}</span>
                {sortDirection === "asc" ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("fileBrowser.sort")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("fileBrowser.sortBy")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sortField}
          onValueChange={(value) => onSortFieldChange(value as SortField)}
        >
          {sortOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={sortDirection}
          onValueChange={(value) => onSortDirectionChange(value as SortDirection)}
        >
          {directionOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -----------------------------------------------------------------------------
 * Group Dropdown
 * -------------------------------------------------------------------------- */

export interface GroupDropdownProps {
  groupField: GroupField;
  onGroupFieldChange: (field: GroupField) => void;
  className?: string;
}

export function GroupDropdown({
  groupField,
  onGroupFieldChange,
  className,
}: GroupDropdownProps) {
  const { t } = useTranslation();

  const groupOptions: { value: GroupField; label: string }[] = [
    { value: "none", label: t("fileBrowser.groupNone") },
    { value: "type", label: t("fileBrowser.groupByType") },
    { value: "date", label: t("fileBrowser.groupByDate") },
    { value: "size", label: t("fileBrowser.groupBySize") },
  ];

  // Get current group label
  const currentGroupLabel = groupOptions.find(opt => opt.value === groupField)?.label || groupField;

  return (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 px-2 gap-1", className)}
              >
                <Group className="h-4 w-4" />
                <span className="text-xs hidden sm:inline">{currentGroupLabel}</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("fileBrowser.group")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("fileBrowser.groupBy")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={groupField}
          onValueChange={(value) => onGroupFieldChange(value as GroupField)}
        >
          {groupOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -----------------------------------------------------------------------------
 * File Search Input
 * -------------------------------------------------------------------------- */

export interface FileSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const FileSearchInput = React.memo(function FileSearchInput({
  value,
  onChange,
  placeholder,
  className,
}: FileSearchInputProps) {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = React.useState(value);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local value with external value
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Handle input change with debounce
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      // Clear existing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Set new timeout
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, 300);
    },
    [onChange]
  );

  // Clear search
  const handleClear = React.useCallback(() => {
    setLocalValue("");
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder || t("fileBrowser.search")}
        className="h-8 pl-8 pr-8 text-sm w-40 sm:w-48"
      />
      {localValue && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">{t("common.clear")}</span>
        </Button>
      )}
    </div>
  );
});

/* -----------------------------------------------------------------------------
 * File Action Buttons
 * -------------------------------------------------------------------------- */

export interface FileActionButtonsProps {
  onNewFile: () => void;
  onNewFolder: () => void;
  className?: string;
}

export function FileActionButtons({ onNewFile, onNewFolder, className }: FileActionButtonsProps) {
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-1", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNewFile}>
              <FilePlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New File (Cmd+N)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNewFolder}>
              <FolderPlus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Folder (Cmd+Shift+N)</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/* -----------------------------------------------------------------------------
 * Combined File Browser Toolbar
 * -------------------------------------------------------------------------- */

export interface FileBrowserToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  sortField?: SortField;
  sortDirection?: SortDirection;
  onSortFieldChange?: (field: SortField) => void;
  onSortDirectionChange?: (direction: SortDirection) => void;
  groupField?: GroupField;
  onGroupFieldChange?: (field: GroupField) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  className?: string;
}

export function FileBrowserToolbar({
  viewMode,
  onViewModeChange,
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
  groupField,
  onGroupFieldChange,
  searchQuery,
  onSearchChange,
  onNewFile,
  onNewFolder,
  className,
}: FileBrowserToolbarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {onSearchChange && (
        <>
          <FileSearchInput
            value={searchQuery ?? ""}
            onChange={onSearchChange}
          />
          <Separator orientation="vertical" className="h-6" />
        </>
      )}
      {sortField !== undefined && sortDirection !== undefined && onSortFieldChange && onSortDirectionChange && (
        <>
          <SortDropdown
            sortField={sortField}
            sortDirection={sortDirection}
            onSortFieldChange={onSortFieldChange}
            onSortDirectionChange={onSortDirectionChange}
          />
          <Separator orientation="vertical" className="h-6" />
        </>
      )}
      {groupField !== undefined && onGroupFieldChange && (
        <>
          <GroupDropdown
            groupField={groupField}
            onGroupFieldChange={onGroupFieldChange}
          />
          <Separator orientation="vertical" className="h-6" />
        </>
      )}
      <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
      {(onNewFile || onNewFolder) && (
        <>
          <Separator orientation="vertical" className="h-6" />
          <FileActionButtons onNewFile={onNewFile ?? (() => {})} onNewFolder={onNewFolder ?? (() => {})} />
        </>
      )}
    </div>
  );
}
