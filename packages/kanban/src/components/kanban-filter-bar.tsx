"use client";

import * as React from "react";
import {
  cn,
  Input,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@viben/ui";
import { Search, Filter, X, ChevronDown, Tag } from "lucide-react";
import type { KanbanFilter } from "./kanban-filter-types";
import { countActiveFilters } from "./kanban-filter-types";
import { PRIORITY_CONFIG, PRIORITY_ORDER, type IssuePriority } from "../primitives/priority-config";
import type { Tag as TagType } from "../primitives/tag-config";

export interface KanbanFilterBarProps {
  filter: KanbanFilter;
  onChange: (filter: KanbanFilter) => void;
  availableTags?: TagType[];
  className?: string;
}

export function KanbanFilterBar({
  filter,
  onChange,
  availableTags = [],
  className,
}: KanbanFilterBarProps) {
  const activeFilterCount = countActiveFilters(filter);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filter, search: e.target.value || undefined });
  };

  const handlePriorityToggle = (priority: IssuePriority) => {
    const currentPriorities = filter.priorities || [];
    const newPriorities = currentPriorities.includes(priority)
      ? currentPriorities.filter((p) => p !== priority)
      : [...currentPriorities, priority];
    onChange({
      ...filter,
      priorities: newPriorities.length > 0 ? newPriorities : undefined,
    });
  };

  const handleTagToggle = (tagId: string) => {
    const currentTagIds = filter.tagIds || [];
    const newTagIds = currentTagIds.includes(tagId)
      ? currentTagIds.filter((id) => id !== tagId)
      : [...currentTagIds, tagId];
    onChange({
      ...filter,
      tagIds: newTagIds.length > 0 ? newTagIds : undefined,
    });
  };

  const handleClearFilters = () => {
    onChange({});
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap",
        "transition-all duration-200",
        className
      )}
    >
      {/* Search Input */}
      <div className="relative min-w-[200px] max-w-[300px]">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search..."
          value={filter.search || ""}
          onChange={handleSearchChange}
          className="pl-9 pr-3"
        />
      </div>

      {/* Priority Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-4 w-4" />
            Priority
            {filter.priorities?.length ? (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {filter.priorities.length}
              </Badge>
            ) : null}
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuLabel>Filter by Priority</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {PRIORITY_ORDER.map((priority) => {
            const config = PRIORITY_CONFIG[priority];
            const Icon = config.Icon;
            const isChecked = filter.priorities?.includes(priority) || false;
            return (
              <DropdownMenuCheckboxItem
                key={priority}
                checked={isChecked}
                onCheckedChange={() => handlePriorityToggle(priority)}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: config.color }} />
                  {config.label}
                </span>
              </DropdownMenuCheckboxItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tag Filter */}
      {availableTags.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Tag className="h-4 w-4" />
              Tags
              {filter.tagIds?.length ? (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                  {filter.tagIds.length}
                </Badge>
              ) : null}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Filter by Tag</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableTags.map((tag) => {
              const isChecked = filter.tagIds?.includes(tag.id) || false;
              return (
                <DropdownMenuCheckboxItem
                  key={tag.id}
                  checked={isChecked}
                  onCheckedChange={() => handleTagToggle(tag.id)}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Active Filter Count & Clear Button */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Filter className="h-3 w-3" />
            {activeFilterCount} active
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

KanbanFilterBar.displayName = "KanbanFilterBar";
