import { describe, it, expect } from 'vitest'

describe('URL regex patterns', () => {
  describe('ngrok', () => {
    const urlPattern = /https:\/\/[a-zA-Z0-9-]+\.(?:ngrok(?:-free)?\.app|ngrok\.io)/

    it('matches ngrok v3 free domain', () => {
      const line = 'url=https://abc-123-def.ngrok-free.app'
      expect(line.match(urlPattern)?.[0]).toBe('https://abc-123-def.ngrok-free.app')
    })

    it('matches ngrok v3 paid domain', () => {
      const line = 'url=https://my-tunnel.ngrok.app'
      expect(line.match(urlPattern)?.[0]).toBe('https://my-tunnel.ngrok.app')
    })

    it('matches ngrok v2 domain', () => {
      const line = 'url=https://abc123.ngrok.io'
      expect(line.match(urlPattern)?.[0]).toBe('https://abc123.ngrok.io')
    })

    it('does not match random URLs', () => {
      expect('https://example.com'.match(urlPattern)).toBeNull()
    })
  })

  describe('cloudflare', () => {
    const urlPattern = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/

    it('matches trycloudflare domain', () => {
      const line = '2026 INF +---https://happy-cat-singing.trycloudflare.com---+'
      expect(line.match(urlPattern)?.[0]).toBe('https://happy-cat-singing.trycloudflare.com')
    })

    it('does not match random URLs', () => {
      expect('https://example.com'.match(urlPattern)).toBeNull()
    })
  })

  describe('tailscale', () => {
    const urlPattern = /https:\/\/[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.ts\.net/

    it('matches ts.net funnel URL', () => {
      const line = 'Available on the internet: https://my-machine.tail12345.ts.net'
      expect(line.match(urlPattern)?.[0]).toBe('https://my-machine.tail12345.ts.net')
    })

    it('does not match documentation URLs', () => {
      expect('https://tailscale.com/kb/1234'.match(urlPattern)).toBeNull()
    })

    it('does not match generic HTTPS URLs', () => {
      expect('https://example.com'.match(urlPattern)).toBeNull()
    })
  })

  describe('bore', () => {
    const urlPattern = /listening at ([^\s]+):(\d+)/

    it('matches bore output', () => {
      const line = 'listening at bore.pub:12345'
      const match = line.match(urlPattern)
      expect(match?.[1]).toBe('bore.pub')
      expect(match?.[2]).toBe('12345')
    })
  })
})

describe('cloudflared arm64 binary mapping', () => {
  it('darwin arm64 uses native arm64 binary not amd64', async () => {
    const { CLOUDFLARED_SPEC } = await import('../providers/install-cloudflared.js')
    expect(CLOUDFLARED_SPEC.platforms.darwin.arm64).toBe('cloudflared-darwin-arm64.tgz')
    expect(CLOUDFLARED_SPEC.platforms.darwin.arm64).not.toBe('cloudflared-darwin-amd64.tgz')
    expect(CLOUDFLARED_SPEC.platforms.darwin.x64).toBe('cloudflared-darwin-amd64.tgz')
  })
})
