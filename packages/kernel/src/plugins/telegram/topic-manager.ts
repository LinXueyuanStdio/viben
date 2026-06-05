import type { SessionManager } from '../../core/sessions/session-manager.js'
import type { IChannelAdapter } from '../../core/channel.js'
import type { SessionRecord } from '../../core/types.js'
import { createChildLogger } from '../../core/utils/log.js'

const log = createChildLogger({ module: 'topic-manager' })

/** Flat view of a session record, enriched with its Telegram topic ID. */
export interface TopicInfo {
  sessionId: string
  topicId: number | null
  name: string | null
  status: string
  agentName: string
  lastActiveAt: string
}

/** Result of a single-topic deletion operation. */
export interface DeleteTopicResult {
  ok: boolean
  /** True when deletion requires explicit confirmation (session is still active). */
  needsConfirmation?: boolean
  topicId?: number | null
  session?: { id: string; name: string | null; status: string }
  error?: string
}

/** Aggregate result for a bulk cleanup operation. */
export interface CleanupResult {
  deleted: string[]
  failed: { sessionId: string; error: string }[]
}

// IDs for the two system-managed topics that must never be deleted by user-facing commands.
interface SystemTopicIds {
  notificationTopicId: number | null
  assistantTopicId: number | null
}

/**
 * High-level topic management for the Telegram adapter.
 *
 * Sits above the raw Telegram API (`topics.ts`) and adds session-level concerns:
 * guarding system topics, requiring confirmation for active sessions, and
 * coordinating with the SessionManager to remove session records after deletion.
 */
export class TopicManager {
  constructor(
    private sessionManager: SessionManager,
    private adapter: IChannelAdapter | null,
    private systemTopicIds: SystemTopicIds,
  ) {}

  /**
   * List user-facing session topics, excluding system topics.
   * Optionally filtered to specific status values.
   */
  listTopics(filter?: { statuses?: string[] }): TopicInfo[] {
    const records = this.sessionManager.listRecords(filter)
    return records
      .filter(r => !this.isSystemTopic(r))
      .filter(r => !filter?.statuses?.length || filter.statuses.includes(r.status))
      .map(r => ({
        sessionId: r.sessionId,
        topicId: (r.platform as Record<string, unknown>)?.topicId as number ?? null,
        name: r.name ?? null,
        status: r.status,
        agentName: r.agentName,
        lastActiveAt: r.lastActiveAt,
      }))
  }

  /**
   * Delete a session topic and its session record.
   *
   * Returns `needsConfirmation: true` when the session is still active and
   * `options.confirmed` was not set — callers must ask the user before proceeding.
   */
  async deleteTopic(sessionId: string, options?: { confirmed?: boolean }): Promise<DeleteTopicResult> {
    const records = this.sessionManager.listRecords()
    const record = records.find(r => r.sessionId === sessionId)
    if (!record) return { ok: false, error: 'Session not found' }

    if (this.isSystemTopic(record)) return { ok: false, error: 'Cannot delete system topic' }

    const isActive = record.status === 'active' || record.status === 'initializing'
    if (isActive && !options?.confirmed) {
      return {
        ok: false,
        needsConfirmation: true,
        session: { id: record.sessionId, name: record.name ?? null, status: record.status },
      }
    }

    if (isActive) {
      await this.sessionManager.cancelSession(sessionId)
    }

    const topicId = (record.platform as Record<string, unknown>)?.topicId as number ?? null
    if (this.adapter && topicId) {
      try {
        await this.adapter.deleteSessionThread?.(sessionId)
      } catch (err) {
        log.warn({ err, sessionId, topicId }, 'Failed to delete platform thread, removing record anyway')
      }
    }

    await this.sessionManager.removeRecord(sessionId)
    return { ok: true, topicId }
  }

  /**
   * Bulk-delete topics by status (default: finished, error, cancelled).
   * Active/initializing sessions are cancelled before deletion to prevent orphaned processes.
   */
  async cleanup(statuses?: string[]): Promise<CleanupResult> {
    const targetStatuses = statuses?.length ? statuses : ['finished', 'error', 'cancelled']
    const records = this.sessionManager.listRecords({ statuses: targetStatuses })
    const targets = records
      .filter(r => !this.isSystemTopic(r))
      .filter(r => targetStatuses.includes(r.status))

    const deleted: string[] = []
    const failed: { sessionId: string; error: string }[] = []

    for (const record of targets) {
      try {
        // Cancel active/initializing sessions to prevent orphaned agent processes
        const isActive = record.status === 'active' || record.status === 'initializing'
        if (isActive) {
          await this.sessionManager.cancelSession(record.sessionId)
        }

        const topicId = (record.platform as Record<string, unknown>)?.topicId as number | undefined
        if (this.adapter && topicId) {
          try {
            await this.adapter.deleteSessionThread?.(record.sessionId)
          } catch (err) {
            log.warn({ err, sessionId: record.sessionId }, 'Failed to delete platform thread during cleanup')
          }
        }
        await this.sessionManager.removeRecord(record.sessionId)
        deleted.push(record.sessionId)
      } catch (err) {
        failed.push({ sessionId: record.sessionId, error: err instanceof Error ? err.message : String(err) })
      }
    }

    return { deleted, failed }
  }

  private isSystemTopic(record: SessionRecord): boolean {
    const topicId = (record.platform as Record<string, unknown>)?.topicId as number | undefined
    if (!topicId) return false
    return topicId === this.systemTopicIds.notificationTopicId
      || topicId === this.systemTopicIds.assistantTopicId
  }
}
