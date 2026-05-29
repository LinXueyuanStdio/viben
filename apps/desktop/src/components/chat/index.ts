/**
 * DEPRECATED: This shim is kept for backwards compatibility.
 * New code should import directly from:
 * - @/pages/conversation/components (for desktop components)
 * - @viben/chat (for shared chat types)
 *
 * The conversation hooks should be imported from:
 * - @/pages/conversation/hooks/use-agent-conversation
 * - @/pages/conversation/hooks/use-chat-config
 * - @/pages/conversation/hooks/use-group-chat
 * - @/pages/conversation/hooks/use-chat-notifications
 * - @/pages/conversation/hooks/use-group-notifications
 * - @/pages/conversation/hooks/use-executor-sessions
 */
export * from "@/pages/conversation/components";
export type { MessageAttachment } from "@viben/chat";

// Local components in this directory
export { ScreenshotDropdown } from "./screenshot-dropdown";
