import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TunnelKeepAlive } from '../keepalive.js'

describe('TunnelKeepAlive', () => {
  let keepalive: TunnelKeepAlive

  beforeEach(() => {
    vi.useFakeTimers()
    keepalive = new TunnelKeepAlive()
  })

  afterEach(() => {
    keepalive.stop()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('calls onDead after 3 consecutive fetch failures', async () => {
    const onDead = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    keepalive.start('https://example.com', onDead)

    await vi.advanceTimersByTimeAsync(30_000)
    expect(onDead).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(onDead).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(onDead).toHaveBeenCalledOnce()
  })

  it('resets fail count on successful ping', async () => {
    const onDead = vi.fn()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ ok: true })
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))

    vi.stubGlobal('fetch', fetchMock)
    keepalive.start('https://example.com', onDead)

    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(onDead).not.toHaveBeenCalled()
  })

  it('pings the correct health endpoint URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    keepalive.start('https://my-tunnel.trycloudflare.com', vi.fn())
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://my-tunnel.trycloudflare.com/api/v1/system/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('stop() clears interval and resets state', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('fail'))
    vi.stubGlobal('fetch', fetchMock)
    const onDead = vi.fn()

    keepalive.start('https://example.com', onDead)
    await vi.advanceTimersByTimeAsync(30_000)
    keepalive.stop()

    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(onDead).not.toHaveBeenCalled()
  })

  it('start() clears previous interval', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('fail'))
    vi.stubGlobal('fetch', fetchMock)
    const onDead1 = vi.fn()
    const onDead2 = vi.fn()

    keepalive.start('https://old-url.com', onDead1)
    keepalive.start('https://new-url.com', onDead2)

    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(onDead1).not.toHaveBeenCalled()
    expect(onDead2).toHaveBeenCalledOnce()
  })

  it('treats non-200 response as failure', async () => {
    const onDead = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }))

    keepalive.start('https://example.com', onDead)
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(onDead).toHaveBeenCalledOnce()
  })
})
