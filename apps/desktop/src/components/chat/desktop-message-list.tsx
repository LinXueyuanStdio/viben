/**
 * Desktop Message List Component
 *
 * A wrapper around @viben/chat's MessageList that provides Tauri-specific
 * link handling using @tauri-apps/plugin-shell.
 *
 * Usage:
 * ```tsx
 * import { DesktopMessageList } from "@/components/chat";
 *
 * <DesktopMessageList
 *   messages={messages}
 *   isStreaming={isStreaming}
 *   // ... other props from MessageList
 * />
 * ```
 */

import * as React from "react";
import { MessageList, type MessageListProps } from "@viben/chat";

// ============================================================================
// Types
// ============================================================================

/**
 * Props for DesktopMessageList
 * Omits onLinkClick as it's implemented internally using Tauri shell
 */
export type DesktopMessageListProps = Omit<MessageListProps, "onLinkClick">;

// ============================================================================
// Component
// ============================================================================

/**
 * Desktop-specific MessageList wrapper
 *
 * Provides Tauri implementation for link handling using the shell plugin
 * to open URLs in the system's default browser.
 */
export function DesktopMessageList(props: DesktopMessageListProps) {
  /**
   * Handle link clicks by opening in system browser via Tauri shell
   */
  const handleLinkClick = React.useCallback(async (href: string) => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(href);
    } catch (err) {
      // Fallback to window.open if Tauri shell is not available
      console.warn(
        "[DesktopMessageList] Tauri shell not available, falling back to window.open:",
        err
      );
      window.open(href, "_blank");
    }
  }, []);

  return <MessageList {...props} onLinkClick={handleLinkClick} />;
}
