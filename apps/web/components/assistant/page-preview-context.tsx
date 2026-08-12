"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PagePreviewResponse } from "@/app/api/page-sessions/[sessionId]/preview/route";

export type PagePreviewContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  revision: number;
  reload: () => void;
  previewData: PagePreviewResponse | null;
  previewUnavailable: boolean;
  setPreviewData: (data: PagePreviewResponse | null) => void;
  setPreviewUnavailable: (unavailable: boolean) => void;
};

const PagePreviewContext = createContext<PagePreviewContextValue | undefined>(
  undefined,
);

export function PagePreviewProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [previewData, setPreviewData] = useState<PagePreviewResponse | null>(
    null,
  );
  const [previewUnavailable, setPreviewUnavailable] = useState(false);

  const reload = useCallback(() => {
    setPreviewUnavailable(false);
    setRevision((value) => value + 1);
  }, []);

  const value = useMemo<PagePreviewContextValue>(
    () => ({
      open,
      setOpen,
      revision,
      reload,
      previewData,
      previewUnavailable,
      setPreviewData,
      setPreviewUnavailable,
    }),
    [open, previewData, previewUnavailable, reload, revision],
  );

  return (
    <PagePreviewContext.Provider value={value}>
      {children}
    </PagePreviewContext.Provider>
  );
}

export function usePagePreview() {
  const context = useContext(PagePreviewContext);
  if (!context) {
    throw new Error("usePagePreview must be used within PagePreviewProvider");
  }
  return context;
}
