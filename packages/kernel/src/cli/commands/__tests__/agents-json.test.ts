import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess } from './helpers/json-test-utils.js'

vi.mock('../../../core/agents/agent-catalog.js', () => {
  class MockAgentCatalog {
    load = vi.fn()
    refreshRegistryIfStale = vi.fn().mockResolvedValue(undefined)
    getAvailable = vi.fn().mockReturnValue([
      {
        key: 'claude-code',
        name: 'Claude Code',
        version: '1.0.0',
        distribution: 'npm',
        description: 'AI coding agent',
        installed: true,
        available: true,
        missingDeps: [],
      },
      {
        key: 'gemini',
        name: 'Gemini CLI',
        version: '0.5.0',
        distribution: 'npm',
        description: 'Google Gemini agent',
        installed: false,
        available: true,
        missingDeps: [],
      },
    ])
  }
  return { AgentCatalog: MockAgentCatalog }
})

describe('agents list --json', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('outputs envelope with agents array', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['list', '--json'], '/tmp/test-viben')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('agents')
    expect(Array.isArray(data.agents)).toBe(true)
    expect((data.agents as unknown[]).length).toBe(2)
  })

  it('includes all required fields in each agent entry', async () => {
    const { cmdAgents } = await import('../agents.js')
    const result = await captureJsonOutput(async () => {
      await cmdAgents(['list', '--json'], '/tmp/test-viben')
    })
    const data = expectValidJsonSuccess(result.stdout)
    const agent = (data.agents as Record<string, unknown>[])[0]
    const fields = ['key', 'name', 'version', 'distribution', 'description', 'installed', 'available', 'missingDeps']
    for (const field of fields) {
      expect(agent).toHaveProperty(field)
    }
  })
})
