import { useCallback, useState } from "react";
import type { PageCreationMode } from "./empty-markdown-page-utils";

export type PageAiCreationStatus = "idle" | "creating";

export interface PageAiCreationState {
  status: PageAiCreationStatus;
  mode: PageCreationMode;
  input: string;
  prompt: string;
}

export interface UsePageAiCreationOptions {
  onStart?: (prompt: string, mode: PageCreationMode) => void | Promise<void>;
  onStop?: () => void | Promise<void>;
}

export function usePageAiCreation(options: UsePageAiCreationOptions = {}) {
  const [state, setState] = useState<PageAiCreationState>({
    status: "idle",
    mode: "document",
    input: "",
    prompt: "",
  });

  const start = useCallback(
    async (prompt: string, mode: PageCreationMode) => {
      setState({
        status: "creating",
        mode,
        input: prompt,
        prompt,
      });
      await options.onStart?.(prompt, mode);
    },
    [options]
  );

  const stop = useCallback(async () => {
    await options.onStop?.();
    setState((current) => ({
      ...current,
      status: "idle",
    }));
  }, [options]);

  const dismiss = useCallback(() => {
    setState((current) => ({
      ...current,
      status: "idle",
    }));
  }, []);

  return {
    state,
    isCreating: state.status === "creating",
    start,
    stop,
    dismiss,
  };
}
