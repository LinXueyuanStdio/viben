import type { CommandRegistry } from '../command-registry.js'
import type { CommandResponse } from '../plugin/types.js'
import type { VibenCore } from '../core.js'

/**
 * Register session lifecycle commands: /new, /cancel, /status, /sessions,
 * /newchat, /resume, /handoff, /fork, /archive, /close, /agentsessions.
 *
 * These commands manage the full session lifecycle — creating, inspecting,
 * forking, archiving, and closing sessions. Most require a session context
 * (i.e. being invoked inside a session topic/thread).
 */
export function registerSessionCommands(registry: CommandRegistry, _core: unknown): void {
  const core = _core as VibenCore;
  registry.register({
    name: 'new',
    description: 'Start a new session',
    usage: '[agent-name]',
    category: 'system',
    handler: async (args) => {
      const parts = args.raw.trim().split(/\s+/).filter(Boolean)
      const agent = parts[0] || undefined
      const workspace = parts[1] || undefined
      if (agent && workspace) {
        const session = await core.handleNewSession(args.channelId, agent, workspace, { createThread: true })
        return { type: 'text', text: `✅ Session created: ${session.name || session.id}` }
      }
      const assistant = core.assistantManager?.get(args.channelId)
      if (assistant && !args.sessionId) {
        const prompt = agent
          ? `Create session with agent "${agent}", ask user for workspace path.`
          : `Create new session, guide user through agent and workspace selection.`
        await assistant.enqueuePrompt(prompt)
        return { type: 'delegated' }
      }
      return { type: 'text', text: 'Usage: /new [agent] [workspace]\nOr use the Assistant topic for guided setup.' }
    },
  })

  registry.register({
    name: 'cancel',
    description: 'Cancel the current agent turn',
    category: 'system',
    handler: async (args) => {
      if (args.sessionId) {
        const session = core.sessionManager.getSession(args.sessionId)
        if (session) {
          await session.abortPrompt?.()
          session.markCancelled()
          return { type: 'text', text: '⛔ Session cancelled.' }
        }
      }
      return { type: 'error', message: 'No active session in this topic.' }
    },
  })

  registry.register({
    name: 'clearqueue',
    description: 'Discard all queued prompts (keeps current prompt running)',
    category: 'system',
    handler: async (args) => {
      if (args.sessionId) {
        const session = core.sessionManager.getSession(args.sessionId)
        if (session) {
          const dropped = session.queueDepth
          if (dropped === 0) {
            return { type: 'text', text: 'Queue is already empty.' }
          }
          session.clearQueue()
          return { type: 'text', text: `🗑️ Cleared ${dropped} queued prompt${dropped > 1 ? 's' : ''}.` }
        }
      }
      return { type: 'error', message: 'No active session in this topic.' }
    },
  })

  registry.register({
    name: 'flush',
    description: 'Cancel current prompt and clear all queued prompts',
    category: 'system',
    handler: async (args) => {
      if (args.sessionId) {
        const session = core.sessionManager.getSession(args.sessionId)
        if (session) {
          await session.flushAll()
          session.markCancelled()
          return { type: 'text', text: '🔄 Session flushed — prompt cancelled, queue cleared.' }
        }
      }
      return { type: 'error', message: 'No active session in this topic.' }
    },
  })

  registry.register({
    name: 'status',
    description: 'Show current session status',
    category: 'system',
    handler: async (args) => {
      if (args.sessionId) {
        const session = core.sessionManager.getSession(args.sessionId)
        if (session) {
          return { type: 'text', text: `📊 ${session.name || session.id}\nAgent: ${session.agentName}\nStatus: ${session.status}\nPrompts: ${session.promptCount}` }
        }
      }
      const records = core.sessionManager.listRecords()
      const active = records.filter((r: any) => r.status === 'active' || r.status === 'initializing').length
      return { type: 'text', text: `📊 ${active} active / ${records.length} total sessions` }
    },
  })

  registry.register({
    name: 'sessions',
    description: 'List all active sessions',
    category: 'system',
    handler: async (args) => {
      const records = core.sessionManager.listRecords()
      if (records.length === 0) return { type: 'text', text: 'No sessions.' }
      const items = records.map((r: any) => ({
        label: r.name || r.id,
        detail: `${r.agentName} — ${r.status}`,
      }))
      return { type: 'list', title: '📋 Sessions', items }
    },
  })

  registry.register({
    name: 'newchat',
    description: 'New chat, same agent & workspace',
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) return { type: 'text', text: 'Use /newchat inside a session topic.' }
      const session = core.sessionManager.getSession(args.sessionId)
      if (!session) return { type: 'error', message: 'No session in this topic.' }
      const newSession = await core.handleNewSession(
        args.channelId,
        session.agentName,
        session.workingDirectory,
        { createThread: true },
      )
      return { type: 'text', text: `✅ New chat created: ${newSession.name || newSession.id}` }
    },
  })

  registry.register({
    name: 'resume',
    description: 'Resume a previous session',
    usage: '[session-number]',
    category: 'system',
    handler: async (args) => {
      const assistant = core.assistantManager?.get(args.channelId)
      if (assistant && !args.sessionId) {
        await assistant.enqueuePrompt('User wants to resume a previous session. Show available sessions and guide them.')
        return { type: 'delegated' }
      }
      return { type: 'text', text: 'Usage: /resume\nUse in the Assistant topic for guided session resume.' }
    },
  })

  registry.register({
    name: 'handoff',
    description: 'Hand off session to another agent',
    usage: '[agent-name]',
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) return { type: 'text', text: 'Use /handoff inside a session topic.' }
      const session = core.sessionManager.getSession(args.sessionId)
      if (!session) return { type: 'error', message: 'No session in this topic.' }
      const { getAgentCapabilities } = await import('../agents/agent-registry.js')
      const caps = getAgentCapabilities(session.agentName)
      if (!caps.supportsResume || !caps.resumeCommand) {
        return { type: 'text', text: 'This agent does not support session transfer.' }
      }
      const command = caps.resumeCommand(session.agentSessionId)
      return { type: 'text', text: `Run this in your terminal:\n${command}` }
    },
  })

  registry.register({
    name: 'fork',
    description: 'Fork the current session into a new conversation',
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) {
        return { type: 'error', message: '⚠️ No active session in this topic.' } satisfies CommandResponse;
      }
      const session = core.sessionManager.getSession(args.sessionId);
      if (!session) {
        return { type: 'error', message: '⚠️ Session not found.' } satisfies CommandResponse;
      }
      if (!session.supportsCapability('fork')) {
        return { type: 'error', message: '⚠️ This agent does not support session forking.' } satisfies CommandResponse;
      }
      try {
        const response = await session.agentInstance.forkSession(
          session.agentSessionId,
          session.workingDirectory,
        );
        const newSession = await core.createSession({
          channelId: session.channelId,
          agentName: session.agentName,
          workingDirectory: session.workingDirectory,
          resumeAgentSessionId: response.sessionId,
          createThread: true,
          initialName: `Fork of ${session.name || session.id.slice(0, 6)}`,
        });
        return { type: 'text', text: `Session forked → ${newSession.name || newSession.id}` } satisfies CommandResponse;
      } catch (err) {
        return { type: 'error', message: `⚠️ Fork failed: ${err instanceof Error ? err.message : String(err)}` } satisfies CommandResponse;
      }
    },
  })

  registry.register({
    name: 'archive',
    description: 'Archive session (stop agent and delete topic)',
    category: 'system',
    handler: async (args) => {
      const raw = args.raw.trim()

      // /archive yes <sessionId> — confirmation
      if (raw === 'yes' || raw.startsWith('yes ')) {
        const sessionId = raw.slice(3).trim() || args.sessionId
        if (!sessionId) {
          return { type: 'error', message: 'No session to archive.' } satisfies CommandResponse
        }
        const result = await core.archiveSession(sessionId)
        if (!result.ok) {
          return { type: 'error', message: `Archive failed: ${result.error}` } satisfies CommandResponse
        }
        return { type: 'text', text: 'Session archived.' } satisfies CommandResponse
      }

      // /archive no — cancel
      if (raw === 'no') {
        return { type: 'text', text: 'Archive cancelled.' } satisfies CommandResponse
      }

      // /archive (no args) — show confirmation
      if (!args.sessionId) {
        return { type: 'error', message: 'Use this command in a session topic.' } satisfies CommandResponse
      }

      const session = core.sessionManager.getSession(args.sessionId)
      const record = !session ? core.sessionManager.getSessionRecord(args.sessionId) : undefined
      if (!session && !record) {
        return { type: 'error', message: 'No session found for this topic.' } satisfies CommandResponse
      }

      const status = session?.status ?? record?.status
      if (status === 'initializing') {
        return { type: 'error', message: 'Cannot archive a session that is still initializing.' } satisfies CommandResponse
      }

      return {
        type: 'confirm',
        question: 'Archive this session?\n\nThis will stop the agent and delete the topic. This cannot be undone.',
        onYes: `/archive yes ${args.sessionId}`,
        onNo: '/archive no',
      } satisfies CommandResponse
    },
  })

  registry.register({
    name: 'close',
    description: 'Close this session permanently',
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) {
        return { type: 'error', message: '⚠️ No active session in this topic.' } satisfies CommandResponse;
      }
      const session = core.sessionManager.getSession(args.sessionId);
      if (!session) {
        return { type: 'error', message: '⚠️ Session not found.' } satisfies CommandResponse;
      }
      try {
        if (session.supportsCapability('close')) {
          await session.agentInstance.closeSession(session.agentSessionId);
        }
        await core.sessionManager.cancelSession(session.id);
        return { type: 'text', text: 'Session closed.' } satisfies CommandResponse;
      } catch (err) {
        return { type: 'error', message: `⚠️ Close failed: ${err instanceof Error ? err.message : String(err)}` } satisfies CommandResponse;
      }
    },
  })

  registry.register({
    name: 'agentsessions',
    description: 'List sessions known to the agent',
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) {
        return { type: 'error', message: '⚠️ No active session in this topic.' } satisfies CommandResponse;
      }
      const session = core.sessionManager.getSession(args.sessionId);
      if (!session) {
        return { type: 'error', message: '⚠️ Session not found.' } satisfies CommandResponse;
      }
      if (!session.supportsCapability('list')) {
        return { type: 'error', message: '⚠️ This agent does not support session listing.' } satisfies CommandResponse;
      }
      try {
        const response = await session.agentInstance.listSessions(session.workingDirectory);
        const sessions = (response as any).sessions ?? [];
        if (sessions.length === 0) {
          return { type: 'text', text: 'No sessions found.' } satisfies CommandResponse;
        }
        const lines = sessions.map((s: any, i: number) =>
          `${i + 1}. ${s.title || s.sessionId}${s.updatedAt ? ` (${new Date(s.updatedAt).toLocaleString()})` : ''}`,
        );
        return { type: 'text', text: `Agent sessions:\n${lines.join('\n')}` } satisfies CommandResponse;
      } catch (err) {
        return { type: 'error', message: `⚠️ List failed: ${err instanceof Error ? err.message : String(err)}` } satisfies CommandResponse;
      }
    },
  })
}
