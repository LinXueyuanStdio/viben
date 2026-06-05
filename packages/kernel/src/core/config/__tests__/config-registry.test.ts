import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  CONFIG_REGISTRY,
  getFieldDef,
  getSafeFields,
  isHotReloadable,
  setFieldValueAsync,
  ConfigValidationError,
  type ConfigFieldDef,
} from '../config-registry.js'
import { ConfigManager } from '../config.js'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

describe('config-registry', () => {
  it('exports a non-empty registry', () => {
    expect(CONFIG_REGISTRY.length).toBeGreaterThan(0)
  })

  it('getFieldDef returns definition for known path', () => {
    const def = getFieldDef('defaultAgent')
    expect(def).toBeDefined()
    expect(def!.type).toBe('select')
    expect(def!.scope).toBe('safe')
  })

  it('getFieldDef returns undefined for unknown path', () => {
    expect(getFieldDef('nonexistent.path')).toBeUndefined()
  })

  it('getSafeFields returns only safe-scoped fields', () => {
    const safe = getSafeFields()
    expect(safe.length).toBeGreaterThan(0)
    for (const field of safe) {
      expect(field.scope).toBe('safe')
    }
  })

  it('isHotReloadable returns correct values', () => {
    expect(isHotReloadable('defaultAgent')).toBe(true)
    expect(isHotReloadable('logging.level')).toBe(true)
  })

  it('all safe fields have required metadata', () => {
    const safe = getSafeFields()
    for (const field of safe) {
      expect(field.path).toBeTruthy()
      expect(field.displayName).toBeTruthy()
      expect(field.group).toBeTruthy()
      expect(['toggle', 'select', 'number', 'string']).toContain(field.type)
      if (field.type === 'select') {
        expect(field.options).toBeDefined()
      }
    }
  })
})

describe('ConfigManager events', () => {
  let tmpDir: string
  let cm: ConfigManager

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-config-test-'))
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({
      channels: { telegram: { enabled: false, botToken: 'test', chatId: 0 } },
      agents: { claude: { command: 'claude', args: [] } },
      defaultAgent: 'claude',
    }))
    process.env.VIBEN_CONFIG_PATH = configPath
    cm = new ConfigManager()
    await cm.load()
  })

  afterEach(() => {
    delete process.env.VIBEN_CONFIG_PATH
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('emits config:changed event on save', async () => {
    const events: Array<{ path: string; value: unknown }> = []
    cm.on('config:changed', (e) => events.push(e))

    await cm.save({ defaultAgent: 'codex' }, 'defaultAgent')
    expect(events).toHaveLength(1)
    expect(events[0].path).toBe('defaultAgent')
    expect(events[0].value).toBe('codex')
  })

  it('does not emit event when no changePath provided', async () => {
    const events: Array<unknown> = []
    cm.on('config:changed', (e) => events.push(e))

    await cm.save({ defaultAgent: 'codex' })
    expect(events).toHaveLength(0)
  })
})

describe('CONFIG_REGISTRY field membership', () => {
  it('contains exactly 4 core fields', () => {
    expect(CONFIG_REGISTRY).toHaveLength(4)
  })

  it('contains exactly the expected core field paths', () => {
    const paths = CONFIG_REGISTRY.map((f) => f.path)
    expect(paths).toContain('defaultAgent')
    expect(paths).toContain('logging.level')
    expect(paths).toContain('sessionStore.ttlDays')
    expect(paths).toContain('agentSwitch.labelHistory')
  })

  it('does not contain removed plugin fields', () => {
    const paths = CONFIG_REGISTRY.map((f) => f.path)
    expect(paths).not.toContain('channels.telegram.botToken')
    expect(paths).not.toContain('security.allowedUserIds')
    expect(paths).not.toContain('tunnel.enabled')
    expect(paths).not.toContain('speech.stt.provider')
  })
})

describe('setFieldValueAsync', () => {
  it('calls configManager.setPath with the field path and value', async () => {
    const field = getFieldDef('logging.level')!
    const mockManager = { setPath: vi.fn().mockResolvedValue(undefined) }
    await setFieldValueAsync(field, 'debug', mockManager)
    expect(mockManager.setPath).toHaveBeenCalledWith('logging.level', 'debug')
  })

  it('returns needsRestart: false for hot-reloadable field', async () => {
    const field = getFieldDef('logging.level')!
    const mockManager = { setPath: vi.fn().mockResolvedValue(undefined) }
    const result = await setFieldValueAsync(field, 'debug', mockManager)
    expect(result.needsRestart).toBe(false)
  })

  it('returns needsRestart: true for non-hot-reloadable field', async () => {
    const nonHotField: ConfigFieldDef = {
      path: 'someField',
      displayName: 'Test',
      group: 'test',
      type: 'string',
      scope: 'safe',
      hotReload: false,
    }
    const mockManager = { setPath: vi.fn().mockResolvedValue(undefined) }
    const result = await setFieldValueAsync(nonHotField, 'value', mockManager)
    expect(result.needsRestart).toBe(true)
  })

  it('throws ConfigValidationError for wrong type', async () => {
    const field = getFieldDef('sessionStore.ttlDays')! // type: number
    const mockManager = { setPath: vi.fn() }
    await expect(setFieldValueAsync(field, 'not-a-number', mockManager)).rejects.toThrow(ConfigValidationError)
  })
})
