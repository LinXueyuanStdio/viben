import { createContext, useContext, useMemo, useRef } from "react";
import type { AgentMessage } from "./types";
import {
  buildMessageLookups,
  updateMessageLookupsIncremental,
  EMPTY_LOOKUPS,
  type MessageLookups,
} from "./message-lookups";

const MessageLookupsContext = createContext<MessageLookups>(EMPTY_LOOKUPS);

/**
 * Hook to access the pre-computed message lookups.
 *
 * Must be used within a <MessageLookupsProvider>.
 * Returns O(1) access to tool results, error state, and in-progress state.
 */
export function useMessageLookups(): MessageLookups {
  return useContext(MessageLookupsContext);
}

interface MessageLookupsProviderProps {
  messages: AgentMessage[];
  children: React.ReactNode;
}

/**
 * Provider that builds and caches MessageLookups for all descendants.
 *
 * Uses incremental update: if only new messages were appended (detected by
 * count comparison), patches the existing Maps/Sets rather than rebuilding.
 * Falls back to a full rebuild when messages shrink or are reordered.
 */
export function MessageLookupsProvider({
  messages,
  children,
}: MessageLookupsProviderProps) {
  const cacheRef = useRef<{
    lookups: MessageLookups;
    messageCount: number;
    lastAssistantMsgId: string | undefined;
  } | null>(null);

  const lookups = useMemo(() => {
    const cache = cacheRef.current;

    // Find current last assistant message ID (turn-boundary detection)
    let lastAssistantMsgId: string | undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === "text" || m.type === "result") {
        lastAssistantMsgId = m.id;
        break;
      }
    }

    if (cache && messages.length >= cache.messageCount) {
      // Turn-boundary guard: if the last assistant message changed, a new turn started.
      // Stale inProgressIds from the previous turn must be cleared via full rebuild.
      if (cache.lastAssistantMsgId !== lastAssistantMsgId) {
        const fresh = buildMessageLookups(messages);
        cacheRef.current = { lookups: fresh, messageCount: messages.length, lastAssistantMsgId };
        return fresh;
      }

      const updated = updateMessageLookupsIncremental(
        cache.lookups,
        cache.messageCount,
        messages,
      );
      if (updated) {
        cacheRef.current = { lookups: updated, messageCount: messages.length, lastAssistantMsgId };
        return updated;
      }
    }

    // Full rebuild
    const fresh = buildMessageLookups(messages);
    cacheRef.current = { lookups: fresh, messageCount: messages.length, lastAssistantMsgId };
    return fresh;
  }, [messages]);

  return (
    <MessageLookupsContext.Provider value={lookups}>
      {children}
    </MessageLookupsContext.Provider>
  );
}
