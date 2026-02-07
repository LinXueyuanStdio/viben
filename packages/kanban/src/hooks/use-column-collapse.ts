import { useState, useCallback } from "react";

export function useColumnCollapse(initialState: Record<string, boolean> = {}) {
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>(initialState);

  const toggleCollapse = useCallback((columnId: string, collapsed?: boolean) => {
    setCollapsedColumns(prev => ({
      ...prev,
      [columnId]: collapsed ?? !prev[columnId],
    }));
  }, []);

  const isCollapsed = useCallback((columnId: string) => {
    return collapsedColumns[columnId] ?? false;
  }, [collapsedColumns]);

  const collapseAll = useCallback((columnIds: string[]) => {
    const newState: Record<string, boolean> = {};
    columnIds.forEach(id => {
      newState[id] = true;
    });
    setCollapsedColumns(newState);
  }, []);

  const expandAll = useCallback(() => {
    setCollapsedColumns({});
  }, []);

  return {
    collapsedColumns,
    toggleCollapse,
    isCollapsed,
    collapseAll,
    expandAll,
  };
}
