import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../../core/agents/agent-catalog.js', () => {
  class MockAgentCatalog {
    load = vi.fn()
    refreshRegistryIfStale = vi.fn().mockResolvedValue(undefined)
    getAvailable = vi.fn().mockReturnValue([])
    getInstalledAgent = vi.fn().mockImplementation((key: string) => {
      if (key === 'claude-code') {
        return {
          registryId: 'claude-code',
          name: 'Claude Code',
          version: '1.0.0',
          distribution: 'npm',
          command: 'npx',
          args: ['@anthropic-ai/claude-code'],
          env: {},
          installedAt: '2026-01-01T00:00:00Z',
          binaryPath: null,
        }
      }
      return undefined
    })
    findRegistryAgent = vi.fn().mockReturnValue(undefined)
    install = vi.fn().mockResolvedValue({ ok: true, agentKey: 'gemini' })
    uninstall = vi.fn().mockResolvedValue({ ok: true })
    getInstalledEntries = vi.fn().mockReturnValue({ 'claude-code': {} })
  }
  return { AgentCatalog: MockAgentCatalog }
})

vi.mock('../../../core/agents/agent-dependencies.js', () => ({
  getAgentCapabilities: vi.fn().mockReturnValue({ integration: null }),
  getAgentSetup: vi.fn().mockReturnValue(undefined),
}))

describe('agents info --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON for installed agent', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['info', 'claude-code', '--json'], '/tmp/test-viben')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('key', 'claude-code')
    expect(data).toHaveProperty('name', 'Claude Code')
    expect(data).toHaveProperty('installed', true)
    expect(data).toHaveProperty('version', '1.0.0')
    expect(data).toHaveProperty('distribution', 'npm')
    expect(data).toHaveProperty('command', 'npx')
  })

  it('outputs JSON error for unknown agent', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['info', 'nonexistent', '--json'], '/tmp/test-viben')
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'AGENT_NOT_FOUND')
  })

  it('outputs JSON error when no agent name provided', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['info', '--json'], '/tmp/test-viben')
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'MISSING_ARGUMENT')
  })
})

describe('agents install --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful install', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['install', 'gemini', '--json'], '/tmp/test-viben')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('key', 'gemini')
    expect(data).toHaveProperty('installed', true)
  })

  it('outputs JSON error when no agent name provided', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['install', '--json'], '/tmp/test-viben')
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'MISSING_ARGUMENT')
  })
})

describe('agents uninstall --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful uninstall', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['uninstall', 'claude-code', '--json'], '/tmp/test-viben')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('key', 'claude-code')
    expect(data).toHaveProperty('uninstalled', true)
  })

  it('outputs JSON error when no agent name provided', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['uninstall', '--json'], '/tmp/test-viben')
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'MISSING_ARGUMENT')
  })
})
