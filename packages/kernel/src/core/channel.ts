import type { OutgoingMessage, PermissionRequest, NotificationMessage, AgentCommand } from './types.js'

/**
 * Configuration for an adapter channel (Telegram, Slack, etc.).
 * Each adapter defines its own fields beyond `enabled`.
 */
export interface ChannelConfig {
  enabled: boolean
  [key: string]: unknown
}

/**
 * Declares what a messaging platform supports. Core uses these to decide
 * whether to attempt features like streaming, file uploads, or voice.
 */
export interface AdapterCapabilities {
  streaming: boolean
  richFormatting: boolean
  threads: boolean
  reactions: boolean
  fileUpload: boolean
  voice: boolean
}

/**
 * Contract for a messaging platform adapter.
 *
 * A "channel" in Viben is identified by an adapter name (e.g. "telegram", "slack").
 * Each session binds to a channel + thread ID — together they form a unique conversation
 * location. The adapter is responsible for platform-specific I/O: sending messages,
 * creating threads/topics, handling permission buttons, etc.
 *
 * Core calls adapter methods via SessionBridge (for agent events) or directly
 * (for session lifecycle operations like thread creation and archiving).
 */
export interface IChannelAdapter {
  readonly name: string
  readonly capabilities: AdapterCapabilities

  start(): Promise<void>
  stop(): Promise<void>

  // --- Outgoing: core → platform ---
  sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>
  sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>
  sendNotification(notification: NotificationMessage): Promise<void>

  // --- Session lifecycle on platform side ---
  /** Create a thread/topic for a session. Returns the platform-specific thread ID. */
  createSessionThread(sessionId: string, name: string): Promise<string>
  renameSessionThread(sessionId: string, newName: string): Promise<void>
  deleteSessionThread?(sessionId: string): Promise<void>
  archiveSessionTopic?(sessionId: string): Promise<void>

  // TTS strip — optional, called after TTS audio is synthesized to remove [TTS] block from text
  stripTTSBlock?(sessionId: string): Promise<void>

  // --- Skill commands — optional, for agents that expose interactive commands ---
  sendSkillCommands?(sessionId: string, commands: AgentCommand[]): Promise<void>
  cleanupSkillCommands?(sessionId: string): Promise<void>
  /** Flush skill commands that were queued before threadId was available. */
  flushPendingSkillCommands?(sessionId: string): Promise<void>

  // Agent switch cleanup — optional, called when switching agents to clear adapter-side per-session state
  cleanupSessionState?(sessionId: string): Promise<void>

  // --- User-targeted notifications (optional) ---
  /** Send a notification directly to a user by platform ID. Best-effort delivery. */
  sendUserNotification?(
    platformId: string,
    message: NotificationMessage,
    options?: {
      via?: 'dm' | 'thread' | 'topic'
      topicId?: string
      sessionId?: string
      platformMention?: { platformUsername?: string; platformId: string }
    }
  ): Promise<void>
}

/**
 * Original base class for channel adapters. Provides default no-op implementations
 * for optional IChannelAdapter methods so subclasses only need to implement the
 * methods they care about.
 *
 * This class predates the adapter-primitives package. It has since been superseded
 * by MessagingAdapter and StreamAdapter, which add structured send queuing, streaming
 * support, and platform-specific rendering out of the box.
 *
 * @deprecated Use MessagingAdapter or StreamAdapter instead. Kept for backward compat during migration.
 */
export abstract class ChannelAdapter<TCore = unknown> implements IChannelAdapter {
  abstract readonly name: string
  readonly capabilities: AdapterCapabilities = {
    streaming: false, richFormatting: false, threads: false,
    reactions: false, fileUpload: false, voice: false,
  }

  constructor(public readonly core: TCore, protected config: ChannelConfig) {}

  abstract start(): Promise<void>
  abstract stop(): Promise<void>

  abstract sendMessage(sessionId: string, content: OutgoingMessage): Promise<void>
  abstract sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>
  abstract sendNotification(notification: NotificationMessage): Promise<void>

  abstract createSessionThread(sessionId: string, name: string): Promise<string>
  abstract renameSessionThread(sessionId: string, newName: string): Promise<void>
  async deleteSessionThread(_sessionId: string): Promise<void> {}

  async sendSkillCommands(_sessionId: string, _commands: AgentCommand[]): Promise<void> {}
  async cleanupSkillCommands(_sessionId: string): Promise<void> {}
  async cleanupSessionState(_sessionId: string): Promise<void> {}
  async archiveSessionTopic(_sessionId: string): Promise<void> {}
  async sendUserNotification(_platformId: string, _message: NotificationMessage, _options?: any): Promise<void> {}
}
