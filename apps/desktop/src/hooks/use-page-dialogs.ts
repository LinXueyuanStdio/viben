import { useState, useCallback } from "react";
import type { PageConfig } from "@/hooks/use-pages";

export interface PageDialogsState {
  // Delete dialog
  pageToDelete: PageConfig | null;
  setPageToDelete: (page: PageConfig | null) => void;

  // Create dialog
  createDialogOpen: boolean;
  createParentUid: string | undefined;
  openCreateDialog: (parentUid?: string) => void;
  closeCreateDialog: () => void;

  // Permissions dialog
  permissionsPage: PageConfig | null;
  setPermissionsPage: (page: PageConfig | null) => void;

  // Edit dialog
  editPage: PageConfig | null;
  setEditPage: (page: PageConfig | null) => void;
}

export function usePageDialogs(): PageDialogsState {
  const [pageToDelete, setPageToDelete] = useState<PageConfig | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createParentUid, setCreateParentSlug] = useState<string | undefined>(
    undefined,
  );
  const [permissionsPage, setPermissionsPage] = useState<PageConfig | null>(
    null,
  );
  const [editPage, setEditPage] = useState<PageConfig | null>(null);

  const openCreateDialog = useCallback((parentUid?: string) => {
    setCreateParentSlug(parentUid);
    setCreateDialogOpen(true);
  }, []);

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false);
  }, []);

  return {
    pageToDelete,
    setPageToDelete,
    createDialogOpen,
    createParentUid,
    openCreateDialog,
    closeCreateDialog,
    permissionsPage,
    setPermissionsPage,
    editPage,
    setEditPage,
  };
}
