import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../api-client.js', () => ({
  readApiPort: vi.fn().mockReturnValue(3000),
  removeStalePortFile: vi.fn(),
  apiCall: vi.fn().mockImplementation((_port: number, urlPath: string, options?: RequestInit) => {
    if (urlPath === '/api/sessions' && !options?.method) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          sessions: [{ id: 'sess-1', agent: 'claude', status: 'active', name: 'Test' }],
        }),
      })
    }
    if (urlPath === '/api/sessions' && options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          sessionId: 'new-sess', agent: 'claude', workspace: '/tmp', status: 'active', channelId: 'tg',
        }),
      })
    }
    if (urlPath === '/api/agents') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          agents: [{ name: 'claude', command: 'npx', args: [] }],
          default: 'claude',
        }),
      })
    }
    if (urlPath === '/api/topics') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          topics: [{ sessionId: 's1', topicId: 1, name: 'Test', status: 'active', agentName: 'claude', lastActiveAt: '2026-01-01' }],
        }),
      })
    }
    if (urlPath === '/api/health') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', uptime: 3600, version: '2026.401.1' }),
      })
    }
    if (urlPath === '/api/config' && !options?.method) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ config: { defaultAgent: 'claude', runMode: 'daemon' } }),
      })
    }
    if (urlPath.startsWith('/api/sessions/') && options?.method === 'DELETE') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ cancelled: true }),
      })
    }
    // Default
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }),
}))

// Mock the logger to prevent pino initialization errors
vi.mock('../../../core/utils/log.js', () => ({
  muteLogger: vi.fn(),
}))

beforeEach(() => {
  vi.resetModules()
})

describe('api status --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('wraps API response in success envelope', async () => {
    const { cmdApi } = await import('../api.js')
    const result = await captureJsonOutput(async () => {
      await cmdApi(['status', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('sessions')
    expect((data.sessions as unknown[]).length).toBe(1)
  })
})

describe('api new --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('wraps session creation response', async () => {
    const { cmdApi } = await import('../api.js')
    const result = await captureJsonOutput(async () => {
      await cmdApi(['new', 'claude', '/tmp', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('sessionId', 'new-sess')
  })
})

describe('api agents --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('wraps agents response', async () => {
    const { cmdApi } = await import('../api.js')
    const result = await captureJsonOutput(async () => {
      await cmdApi(['agents', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('agents')
  })
})

describe('api topics --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('wraps topics response', async () => {
    const { cmdApi } = await import('../api.js')
    const result = await captureJsonOutput(async () => {
      await cmdApi(['topics', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('topics')
  })
})

describe('api health --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('wraps health response', async () => {
    const { cmdApi } = await import('../api.js')
    const result = await captureJsonOutput(async () => {
      await cmdApi(['health', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('status', 'ok')
  })
})

describe('api cancel --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs success on cancel', async () => {
    const { cmdApi } = await import('../api.js')
    const result = await captureJsonOutput(async () => {
      await cmdApi(['cancel', 'sess-1', '--json'])
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('cancelled', true)
    expect(data).toHaveProperty('sessionId', 'sess-1')
  })
})

describe('api --json daemon not running', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs DAEMON_NOT_RUNNING error', async () => {
    const apiClient = await import('../../api-client.js')
    vi.mocked(apiClient.readApiPort).mockReturnValue(null)

    const { cmdApi } = await import('../api.js')
    const result = await captureJsonOutput(async () => {
      await cmdApi(['status', '--json'])
    })
    expect(result.exitCode).toBe(1)
    expectValidJsonError(result.stdout, 'DAEMON_NOT_RUNNING')
  })
})
