import { useCallback, useMemo } from "react";
import { useOverlayStore } from "@/stores/overlay-store";
import type { SubtitleItem, SubtitleConfig, StreamingSubtitleState } from "@/types/overlay";

interface UseSubtitleReturn {
  enabled: boolean;
  current: SubtitleItem | null;
  config: SubtitleConfig;
  streaming: StreamingSubtitleState | null;
  show: (text: string, options?: Partial<SubtitleItem>) => void;
  hide: () => void;
  setEnabled: (enabled: boolean) => void;
  startStream: (options?: Partial<SubtitleItem>) => string;
  appendStream: (chunk: string) => void;
  finishStream: () => void;
  cancelStream: () => void;
  streamFromAsyncIterator: (
    iterator: AsyncIterable<string>,
    options?: Partial<SubtitleItem>
  ) => Promise<string>;
}

export function useSubtitle(): UseSubtitleReturn {
  const store = useOverlayStore();
  const {
    subtitleEnabled: enabled,
    currentSubtitle: current,
    subtitleConfig: config,
    streamingSubtitle: streaming,
    actions,
  } = store;

  const streamFromAsyncIterator = useCallback(
    async (
      iterator: AsyncIterable<string>,
      options?: Partial<SubtitleItem>
    ): Promise<string> => {
      actions.startStream(options);
      let fullText = "";

      try {
        for await (const chunk of iterator) {
          fullText += chunk;
          actions.appendStream(chunk);
        }
        actions.finishStream();
      } catch (error) {
        actions.cancelStream();
        throw error;
      }

      return fullText;
    },
    [actions]
  );

  return useMemo(
    () => ({
      enabled,
      current,
      config,
      streaming,
      show: actions.showSubtitle,
      hide: actions.hideSubtitle,
      setEnabled: actions.setSubtitleEnabled,
      startStream: actions.startStream,
      appendStream: actions.appendStream,
      finishStream: actions.finishStream,
      cancelStream: actions.cancelStream,
      streamFromAsyncIterator,
    }),
    [enabled, current, config, streaming, actions, streamFromAsyncIterator]
  );
}
