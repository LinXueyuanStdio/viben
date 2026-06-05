import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TunnelService } from '../tunnel-service.js'

describe('TunnelService events', () => {
  it('calls onEvent with tunnel:started when start() succeeds', async () => {
    const onEvent = vi.fn()
    const svc = new TunnelService(
      { provider: 'cloudflare', options: {}, storeTtlMinutes: 60 } as any,
      undefined,
      undefined,
      undefined,
      onEvent,
    )

    // Mock the registry.add to return a public URL
    vi.spyOn(svc as any, 'registry', 'get').mockReturnValue({
      restore: vi.fn().mockResolvedValue(undefined),
      add: vi.fn().mockResolvedValue({ publicUrl: 'https://abc.cfargotunnel.com' }),
      shutdown: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn(),
    })

    await svc.start(21420)

    expect(onEvent).toHaveBeenCalledWith('tunnel:started', {
      url: 'https://abc.cfargotunnel.com',
    })
  })

  it('calls onEvent with tunnel:stopped when stop() is called', async () => {
    const onEvent = vi.fn()
    const svc = new TunnelService(
      { provider: 'cloudflare', options: {}, storeTtlMinutes: 60 } as any,
      undefined,
      undefined,
      undefined,
      onEvent,
    )

    vi.spyOn(svc as any, 'registry', 'get').mockReturnValue({
      shutdown: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn(),
    })
    vi.spyOn((svc as any).store, 'destroy').mockReturnValue(undefined)

    await svc.stop()

    expect(onEvent).toHaveBeenCalledWith('tunnel:stopped', {})
  })

  it('does not throw when onEvent is not provided', async () => {
    const svc = new TunnelService(
      { provider: '', options: {}, storeTtlMinutes: 60 } as any,
    )

    vi.spyOn(svc as any, 'registry', 'get').mockReturnValue({
      restore: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      flush: vi.fn(),
    })
    vi.spyOn((svc as any).store, 'destroy').mockReturnValue(undefined)

    await expect(svc.start(21420)).resolves.not.toThrow()
    await expect(svc.stop()).resolves.not.toThrow()
  })
})
