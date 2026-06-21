import { create } from "zustand";

export type PagePublishStatus = "publishing" | "published" | "failed";

export interface PagePublishEntry {
  status: PagePublishStatus;
  url: string | null;
  error: string | null;
  updatedAt: number;
}

interface PagePublishActions {
  startPublish: (key: string) => void;
  finishPublish: (key: string, url: string) => void;
  failPublish: (key: string, error: string) => void;
  reset: () => void;
}

interface PagePublishStore {
  entries: Record<string, PagePublishEntry>;
  actions: PagePublishActions;
}

export function getPagePublishKey(
  workspacePath: string,
  pageUid: string
): string {
  return `${workspacePath}\0${pageUid}`;
}

export const usePagePublishStore = create<PagePublishStore>()((set) => ({
  entries: {},
  actions: {
    startPublish: (key) =>
      set((state) => {
        const existing = state.entries[key];
        return {
          entries: {
            ...state.entries,
            [key]: {
              status: "publishing",
              url: existing?.url ?? null,
              error: null,
              updatedAt: Date.now(),
            },
          },
        };
      }),
    finishPublish: (key, url) =>
      set((state) => ({
        entries: {
          ...state.entries,
          [key]: {
            status: "published",
            url,
            error: null,
            updatedAt: Date.now(),
          },
        },
      })),
    failPublish: (key, error) =>
      set((state) => {
        const existing = state.entries[key];
        return {
          entries: {
            ...state.entries,
            [key]: {
              status: "failed",
              url: existing?.url ?? null,
              error,
              updatedAt: Date.now(),
            },
          },
        };
      }),
    reset: () => set({ entries: {} }),
  },
}));
