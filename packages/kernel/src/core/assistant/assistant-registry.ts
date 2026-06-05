import { createChildLogger } from '../utils/log.js'
import { ASSISTANT_PREAMBLE, buildAssistantGuidelines } from './prompt-constants.js'

const log = createChildLogger({ module: 'assistant-registry' })

/** A CLI command the assistant can run, shown as a code block in the system prompt. */
export interface AssistantCommand {
  command: string
  description: string
}

/**
 * A section that injects live system state into the assistant's system prompt.
 *
 * Each section provides a `buildContext()` callback that is called at prompt
 * composition time. Sections are sorted by priority (lower = earlier in prompt)
 * so the most important context appears first.
 */
export interface AssistantSection {
  id: string
  title: string
  /** Lower priority = appears earlier in the system prompt. */
  priority: number
  /** Returns the section's context string, or null to skip this section entirely. */
  buildContext: () => string | null
  commands?: AssistantCommand[]
}

/**
 * Registry that collects assistant prompt sections and composes them into
 * a single system prompt.
 *
 * Core modules and plugins register sections (e.g. sessions, agents, config)
 * that each contribute a fragment of live system state. At prompt build time,
 * sections are sorted by priority, their `buildContext()` is called, and the
 * results are assembled with the preamble and CLI guidelines.
 */
export class AssistantRegistry {
  private sections = new Map<string, AssistantSection>()
  private _instanceRoot: string = ''

  /** Set the instance root path used in assistant guidelines. */
  setInstanceRoot(root: string): void {
    this._instanceRoot = root
  }

  /** Register a prompt section. Overwrites any existing section with the same id. */
  register(section: AssistantSection): void {
    if (this.sections.has(section.id)) {
      log.warn({ id: section.id }, 'Assistant section overwritten')
    }
    this.sections.set(section.id, section)
  }

  /** Remove a previously registered section by id. */
  unregister(id: string): void {
    this.sections.delete(id)
  }

  /**
   * Compose the full system prompt from all registered sections.
   *
   * Sections are sorted by priority (ascending), each contributing a titled
   * markdown block. If a section's `buildContext()` throws, it is skipped
   * gracefully so one broken section doesn't break the entire prompt.
   *
   * If `channelId` is provided, a "Current Channel" block is injected at the
   * top of the prompt so the assistant can adapt its behavior to the platform.
   */
  buildSystemPrompt(channelId?: string): string {
    const sorted = [...this.sections.values()].sort((a, b) => a.priority - b.priority)
    const parts: string[] = [ASSISTANT_PREAMBLE]

    if (channelId) {
      parts.push(`## Current Channel\nYou are responding on the **${channelId}** channel. Adapt your formatting and behavior to this platform.`)
    }

    for (const section of sorted) {
      try {
        const context = section.buildContext()
        if (!context) continue
        parts.push(`## ${section.title}\n${context}`)
        if (section.commands?.length) {
          const cmds = section.commands.map((c) => `${c.command}  # ${c.description}`).join('\n')
          parts.push('```bash\n' + cmds + '\n```')
        }
      } catch (err) {
        log.warn({ err, sectionId: section.id }, 'Assistant section buildContext() failed, skipping')
      }
    }

    parts.push(buildAssistantGuidelines(this._instanceRoot))
    return parts.join('\n\n')
  }
}
