import { describe, it, expect, vi, afterEach } from 'vitest'
import { captureJsonOutput, expectValidJsonSuccess, expectValidJsonError } from './helpers/json-test-utils.js'

vi.mock('../../api-client.js', () => ({
  readApiPort: vi.fn().mockReturnValue(3000),
  apiCall: vi.fn().mockImplementation((_port: number, urlPath: string, options?: RequestInit) => {
    if (urlPath === '/api/tunnel/list') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([
          { port: 8080, label: 'web', publicUrl: 'https://example.trycloudflare.com', status: 'active' },
        ]),
      })
    }
    if (urlPath === '/api/tunnel' && options?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ port: 8080, publicUrl: 'https://example.trycloudflare.com' }),
      })
    }
    if (urlPath === '/api/tunnel' && options?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }
    if (urlPath.startsWith('/api/tunnel/') && options?.method === 'DELETE') {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  }),
}))

describe('tunnel list --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON with tunnels array', async () => {
    const { cmdTunnel } = await import('../tunnel.js')
    const result = await captureJsonOutput(async () => {
      await cmdTunnel(['list', '--json'], '/tmp/test')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('tunnels')
    expect(Array.isArray(data.tunnels)).toBe(true)
    expect((data.tunnels as any[])[0].port).toBe(8080)
  })
})

describe('tunnel add --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON with port and publicUrl', async () => {
    const { cmdTunnel } = await import('../tunnel.js')
    const result = await captureJsonOutput(async () => {
      await cmdTunnel(['add', '8080', '--json'], '/tmp/test')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('port', 8080)
    expect(data).toHaveProperty('publicUrl')
  })
})

describe('tunnel stop --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful stop', async () => {
    const { cmdTunnel } = await import('../tunnel.js')
    const result = await captureJsonOutput(async () => {
      await cmdTunnel(['stop', '8080', '--json'], '/tmp/test')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('port', 8080)
    expect(data).toHaveProperty('stopped', true)
  })
})

describe('tunnel stop-all --json', () => {
  afterEach(() => { vi.restoreAllMocks() })

  it('outputs JSON on successful stop-all', async () => {
    const { cmdTunnel } = await import('../tunnel.js')
    const result = await captureJsonOutput(async () => {
      await cmdTunnel(['stop-all', '--json'], '/tmp/test')
    })
    expect(result.exitCode).toBe(0)
    const data = expectValidJsonSuccess(result.stdout)
    expect(data).toHaveProperty('stopped', true)
  })
})
