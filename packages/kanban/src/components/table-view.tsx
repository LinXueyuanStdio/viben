"use client";

import * as React from "react";
import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@viben/ui";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export interface TableColumn<T> {
  id: string;
  header: string;
  accessor: keyof T | ((item: T) => React.ReactNode);
  sortable?: boolean;
  width?: string | number;
  minWidth?: string | number;
  align?: "left" | "center" | "right";
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
}

export interface TableViewProps<T extends { id: string }> {
  items: T[];
  columns: TableColumn<T>[];
  onItemClick?: (item: T) => void;
  selectedId?: string;
  emptyMessage?: string;
  className?: string;
  /** Enable pagination */
  pagination?: boolean;
  /** Items per page */
  pageSize?: number;
  /** Enable row hover effect */
  hoverable?: boolean;
  /** Enable striped rows */
  striped?: boolean;
  /** Sticky header */
  stickyHeader?: boolean;
  /** Custom row class */
  rowClassName?: (item: T) => string;
  /** Custom labels for i18n */
  labels?: {
    page?: string;
    of?: string;
    showing?: string;
    items?: string;
  };
}

type SortDirection = "asc" | "desc" | null;

export function TableView<T extends { id: string }>({
  items,
  columns,
  onItemClick,
  selectedId,
  emptyMessage,
  className,
  pagination = false,
  pageSize = 20,
  hoverable = true,
  striped = false,
  stickyHeader = true,
  rowClassName,
  labels,
}: TableViewProps<T>) {
  const { t } = useTranslation();
  const resolvedEmptyMessage = emptyMessage ?? t("kanban.table.noItemsFound");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Handle sorting
  const handleSort = useCallback((columnId: string) => {
    if (sortColumn === columnId) {
      // Cycle: asc -> desc -> null
      if (sortDirection === "asc") {
        setSortDirection("desc");
      } else if (sortDirection === "desc") {
        setSortDirection(null);
        setSortColumn(null);
      } else {
        setSortDirection("asc");
      }
    } else {
      setSortColumn(columnId);
      setSortDirection("asc");
    }
    setCurrentPage(1); // Reset to first page on sort
  }, [sortColumn, sortDirection]);

  // Sort items
  const sortedItems = useMemo(() => {
    if (!sortColumn || !sortDirection) return items;

    const column = columns.find((c) => c.id === sortColumn);
    if (!column) return items;

    return [...items].sort((a, b) => {
      let aVal: unknown;
      let bVal: unknown;

      if (typeof column.accessor === "function") {
        aVal = column.accessor(a);
        bVal = column.accessor(b);
      } else {
        aVal = a[column.accessor];
        bVal = b[column.accessor];
      }

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === "asc" ? 1 : -1;
      if (bVal == null) return sortDirection === "asc" ? -1 : 1;

      // Compare strings
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Compare numbers/dates
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [items, columns, sortColumn, sortDirection]);

  // Paginate items
  const paginatedItems = useMemo(() => {
    if (!pagination) return sortedItems;
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, pagination, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedItems.length / pageSize);

  // Get cell value
  const getCellValue = (item: T, column: TableColumn<T>): React.ReactNode => {
    if (typeof column.accessor === "function") {
      return column.accessor(item);
    }
    const value = item[column.accessor];
    if (value === null || value === undefined) return "-";
    if (typeof value === "boolean") return value ? t("kanban.common.yes") : t("kanban.common.no");
    return String(value);
  };

  // Render sort icon
  const renderSortIcon = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
    if (sortDirection === "asc") {
      return <ArrowUp className="h-3.5 w-3.5 text-primary" />;
    }
    return <ArrowDown className="h-3.5 w-3.5 text-primary" />;
  };

  if (items.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-12",
          "text-muted-foreground border rounded-lg",
          className
        )}
      >
        <p className="text-sm">{resolvedEmptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Table Container */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            {/* Header */}
            <thead>
              <tr
                className={cn(
                  "bg-muted/50 border-b",
                  stickyHeader && "sticky top-0 z-10"
                )}
              >
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider",
                      "whitespace-nowrap",
                      column.sortable && "cursor-pointer select-none hover:bg-muted/80 transition-colors",
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                      column.headerClassName
                    )}
                    style={{
                      width: column.width,
                      minWidth: column.minWidth,
                    }}
                    onClick={() => column.sortable && handleSort(column.id)}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1.5",
                        column.align === "center" && "justify-center",
                        column.align === "right" && "justify-end"
                      )}
                    >
                      <span>{column.header}</span>
                      {column.sortable && renderSortIcon(column.id)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {paginatedItems.map((item, index) => {
                const isSelected = selectedId === item.id;
                const customRowClass = rowClassName?.(item);

                return (
                  <tr
                    key={item.id}
                    onClick={() => onItemClick?.(item)}
                    className={cn(
                      "border-b last:border-b-0 transition-colors",
                      hoverable && "hover:bg-muted/50 cursor-pointer",
                      striped && index % 2 === 1 && "bg-muted/20",
                      isSelected && "bg-accent",
                      customRowClass
                    )}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          "px-4 py-3 text-sm",
                          column.align === "center" && "text-center",
                          column.align === "right" && "text-right",
                          column.cellClassName,
                          column.className
                        )}
                        style={{
                          width: column.width,
                          minWidth: column.minWidth,
                        }}
                      >
                        {getCellValue(item, column)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-3 text-sm text-muted-foreground">
          <div>
            {labels?.showing ?? t("kanban.table.showing")} {(currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, sortedItems.length)}{" "}
            {labels?.of ?? t("kanban.table.of")} {sortedItems.length} {labels?.items ?? t("kanban.table.items")}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                currentPage === 1
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : "hover:bg-muted text-muted-foreground"
              )}
              aria-label={t("kanban.table.previousPage")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2">
              {labels?.page ?? t("kanban.table.page")} {currentPage} {labels?.of ?? t("kanban.table.of")} {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                currentPage === totalPages
                  ? "text-muted-foreground/50 cursor-not-allowed"
                  : "hover:bg-muted text-muted-foreground"
              )}
              aria-label={t("kanban.table.nextPage")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

TableView.displayName = "TableView";
