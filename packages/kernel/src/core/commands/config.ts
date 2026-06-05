import type { CommandRegistry } from '../command-registry.js'
import type { CommandResponse } from '../plugin/types.js'
import type { VibenCore } from '../core.js'
import type { ConfigSelectChoice, ConfigSelectGroup } from '../types.js'
import { createChildLogger } from '../utils/log.js'
import { BusEvent } from '../events.js'

const log = createChildLogger({ module: 'commands/config' })

// ── Bypass keyword detection ─────────────────────────────────────────

import { isPermissionBypass } from '../utils/bypass-detection.js'
export { isPermissionBypass } from '../utils/bypass-detection.js'

// ── Helpers ──────────────────────────────────────────────────────────

/** Flatten grouped and ungrouped options into a flat array of ConfigSelectChoice */
function flattenChoices(options: (ConfigSelectChoice | ConfigSelectGroup)[]): ConfigSelectChoice[] {
  const result: ConfigSelectChoice[] = []
  for (const item of options) {
    if ('group' in item && 'options' in item) {
      result.push(...(item as ConfigSelectGroup).options)
    } else {
      result.push(item as ConfigSelectChoice)
    }
  }
  return result
}

// ── User-friendly labels per category ────────────────────────────────

interface CategoryLabels {
  menuTitle: (currentName: string) => string
  successMsg: (optionLabel: string, optionName: string) => string
  notSupported: string
  description: string
}

const CATEGORY_LABELS: Record<string, CategoryLabels> = {
  mode: {
    menuTitle: (cur) => `Choose session mode (current: ${cur})`,
    successMsg: (label) => `Mode switched to **${label}**.`,
    notSupported: 'This agent does not support switching modes.',
    description: 'Switch the session mode (e.g. code, architect, ask)',
  },
  model: {
    menuTitle: (cur) => `Choose a model (current: ${cur})`,
    successMsg: (label) => `Model switched to **${label}**.`,
    notSupported: 'This agent does not support switching models.',
    description: 'Switch the AI model for this session',
  },
  thought_level: {
    menuTitle: (cur) => `Choose thinking level (current: ${cur})`,
    successMsg: (label) => `Thinking level set to **${label}**.`,
    notSupported: 'This agent does not support changing the thinking level.',
    description: 'Adjust how much the agent thinks before responding',
  },
}

function getLabels(category: string, commandName: string): CategoryLabels {
  return CATEGORY_LABELS[category] ?? {
    menuTitle: (cur: string) => `Choose ${commandName} (current: ${cur})`,
    successMsg: (label: string) => `${commandName} set to **${label}**.`,
    notSupported: `This agent does not support ${commandName}.`,
    description: `Change ${commandName} for this session`,
  }
}

// ── Generic category command factory ─────────────────────────────────

/**
 * Register a command that reads/writes a session config option by category.
 *
 * Each agent exposes config options (mode, model, thought_level) as select menus.
 * This factory creates a command that:
 * - With no args: shows a menu of available values with the current one checked
 * - With a value arg: validates and applies the new value via `session.setConfigOption`
 */
function registerCategoryCommand(
  registry: CommandRegistry,
  core: VibenCore,
  category: string,
  commandName: string,
): void {
  const labels = getLabels(category, commandName)
  registry.register({
    name: commandName,
    description: labels.description,
    usage: `[value]`,
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) {
        return { type: 'error', message: 'No active session. Start a session first.' } satisfies CommandResponse
      }
      const session = core.sessionManager.getSession(args.sessionId)
      if (!session) {
        return { type: 'error', message: 'Session not found.' } satisfies CommandResponse
      }

      const configOption = session.getConfigByCategory(category)
      if (!configOption || configOption.type !== 'select') {
        return { type: 'error', message: labels.notSupported } satisfies CommandResponse
      }

      const choices = flattenChoices(configOption.options)
      const raw = args.raw.trim()

      // No args → show menu with current selection
      if (!raw) {
        const currentChoice = choices.find(c => c.value === configOption.currentValue)
        const currentLabel = currentChoice?.name ?? String(configOption.currentValue)
        return {
          type: 'menu',
          title: labels.menuTitle(currentLabel),
          options: choices.map(c => ({
            label: c.value === configOption.currentValue ? `✅ ${c.name}` : c.name,
            command: `/${commandName} ${c.value}`,
            hint: c.description,
          })),
        } satisfies CommandResponse
      }

      // Validate value
      const match = choices.find(c => c.value === raw)
      if (!match) {
        const valid = choices.map(c => `**${c.value}** (${c.name})`).join(', ')
        return { type: 'error', message: `Unknown option "${raw}". Available: ${valid}` } satisfies CommandResponse
      }

      // Already set to this value
      if (configOption.currentValue === raw) {
        return { type: 'text', text: `Already using **${match.name}**.` } satisfies CommandResponse
      }

      try {
        await session.setConfigOption(configOption.id, { type: 'select', value: raw })
        core.eventBus.emit(BusEvent.SESSION_CONFIG_CHANGED, { sessionId: session.id })
        return { type: 'text', text: labels.successMsg(match.name, configOption.name) } satisfies CommandResponse
      } catch (err) {
        log.error({ err, commandName, configId: configOption.id }, 'setConfigOption failed')
        const msg = err instanceof Error ? err.message
          : typeof err === 'object' && err !== null && typeof (err as any).message === 'string'
            ? (err as any).message
            : String(err)
        return { type: 'error', message: `Could not change ${commandName}: ${msg}` } satisfies CommandResponse
      }
    },
  })
}

// ── /bypass_permissions command ───────────────────────────────────────────────

/**
 * Register /bypass_permissions — toggles auto-approval of permission requests.
 *
 * Two mechanisms are supported:
 * 1. If the agent has a bypass value in its mode options (e.g. Claude Code's "dangermode"),
 *    the command switches the agent mode via setConfigOption.
 * 2. Otherwise, falls back to a client-side override on the Session that auto-approves
 *    all permission requests before they reach the user.
 */
function registerDangerousCommand(registry: CommandRegistry, core: VibenCore): void {
  registry.register({
    name: 'bypass_permissions',
    description: 'Auto-approve all permission requests (skip confirmation prompts)',
    usage: '[on|off]',
    category: 'system',
    handler: async (args) => {
      if (!args.sessionId) {
        return { type: 'error', message: 'No active session. Start a session first.' } satisfies CommandResponse
      }
      const session = core.sessionManager.getSession(args.sessionId)
      if (!session) {
        return { type: 'error', message: 'Session not found.' } satisfies CommandResponse
      }

      const raw = args.raw.trim().toLowerCase()
      const modeConfig = session.getConfigByCategory('mode')

      // Detect if the agent has a bypass value in mode options
      let bypassValue: string | undefined
      let nonBypassDefault: string | undefined
      if (modeConfig && modeConfig.type === 'select') {
        const choices = flattenChoices(modeConfig.options)
        bypassValue = choices.find(c => isPermissionBypass(c.value))?.value
        nonBypassDefault = choices.find(c => !isPermissionBypass(c.value))?.value
      }

      // Determine current bypass state (check BOTH agent mode and client override)
      const isCurrentlyBypassing =
        (bypassValue && modeConfig!.type === 'select' && isPermissionBypass(modeConfig!.currentValue as string))
        || !!session.clientOverrides.bypassPermissions

      // No args → show status with toggle
      if (!raw) {
        if (isCurrentlyBypassing) {
          return {
            type: 'menu',
            title: '☠️ Bypass is ON — all permissions are auto-approved',
            options: [{ label: '🔐 Turn off bypass', command: '/bypass_permissions off' }],
          } satisfies CommandResponse
        }
        return {
          type: 'menu',
          title: '🔐 Bypass is OFF — you will be asked before risky actions',
          options: [{ label: '☠️ Turn on bypass', command: '/bypass_permissions on' }],
        } satisfies CommandResponse
      }

      if (raw !== 'on' && raw !== 'off') {
        return { type: 'error', message: 'Use **/bypass_permissions on** or **/bypass_permissions off**.' } satisfies CommandResponse
      }

      const wantOn = raw === 'on'

      // Already in desired state
      if (wantOn === isCurrentlyBypassing) {
        return {
          type: 'text',
          text: wantOn
            ? '☠️ Bypass is already enabled.'
            : '🔐 Bypass is already disabled.',
        } satisfies CommandResponse
      }

      // Agent has bypass value in mode options → use setConfigOption
      if (bypassValue && modeConfig) {
        try {
          const targetValue = wantOn ? bypassValue : nonBypassDefault!
          await session.setConfigOption(modeConfig.id, { type: 'select', value: targetValue })
          core.eventBus.emit(BusEvent.SESSION_CONFIG_CHANGED, { sessionId: session.id })
          return {
            type: 'text',
            text: wantOn
              ? '☠️ **Bypass Permissions enabled** — all permission requests will be auto-approved. The agent can run any action without asking.'
              : '🔐 **Bypass Permissions disabled** — you will be asked to approve risky actions.',
          } satisfies CommandResponse
        } catch (err) {
          log.error({ err }, 'setConfigOption failed (bypass toggle)')
          const msg = err instanceof Error ? err.message
            : typeof err === 'object' && err !== null && typeof (err as any).message === 'string'
              ? (err as any).message
              : String(err)
          return { type: 'error', message: `Could not toggle bypass: ${msg}` } satisfies CommandResponse
        }
      }

      // Fallback → client-side bypass
      session.clientOverrides.bypassPermissions = wantOn
      await core.sessionManager.patchRecord(session.id, {
        clientOverrides: { ...session.clientOverrides },
      })
      core.eventBus.emit(BusEvent.SESSION_CONFIG_CHANGED, { sessionId: session.id })
      return {
        type: 'text',
        text: wantOn
          ? '☠️ **Bypass Permissions enabled** (client-side) — all permission requests will be auto-approved.\n\n_Note: This agent doesn\'t natively support bypass mode, so Viben will auto-approve on your behalf._'
          : '🔐 **Bypass Permissions disabled** — you will be asked to approve risky actions.',
      } satisfies CommandResponse
    },
  })
}

// ── Public registration ──────────────────────────────────────────────

/**
 * Register session configuration commands: /mode, /model, /thought, /bypass_permissions.
 *
 * These commands let users change agent behavior at runtime. Each maps to
 * a config option category exposed by the agent via ACP config_option events.
 */
export function registerConfigCommands(registry: CommandRegistry, _core: unknown): void {
  const core = _core as VibenCore
  registerCategoryCommand(registry, core, 'mode', 'mode')
  registerCategoryCommand(registry, core, 'model', 'model')
  registerCategoryCommand(registry, core, 'thought_level', 'thought')
  registerDangerousCommand(registry, core)
}
