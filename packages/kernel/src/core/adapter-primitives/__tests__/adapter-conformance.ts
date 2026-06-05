import { describe, it, expect, afterEach } from 'vitest'
import type { IChannelAdapter } from '../../channel.js'

export function runAdapterConformanceTests(
  createAdapter: () => IChannelAdapter | Promise<IChannelAdapter>,
  cleanup?: () => Promise<void>,
) {
  let adapter: IChannelAdapter

  afterEach(async () => {
    await cleanup?.()
  })

  describe('IChannelAdapter conformance', () => {
    it('has a name', async () => {
      adapter = await createAdapter()
      expect(typeof adapter.name).toBe('string')
      expect(adapter.name.length).toBeGreaterThan(0)
    })

    it('declares capabilities correctly', async () => {
      adapter = await createAdapter()
      const caps = adapter.capabilities
      expect(typeof caps.streaming).toBe('boolean')
      expect(typeof caps.richFormatting).toBe('boolean')
      expect(typeof caps.threads).toBe('boolean')
      expect(typeof caps.reactions).toBe('boolean')
      expect(typeof caps.fileUpload).toBe('boolean')
      expect(typeof caps.voice).toBe('boolean')
    })

    it('sends text messages without error', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', { type: 'text', text: 'hello' }),
      ).resolves.not.toThrow()
    })

    it('sends tool_call messages without error', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', {
          type: 'tool_call',
          text: 'Read',
          metadata: { id: 't1', name: 'Read', kind: 'read' },
        }),
      ).resolves.not.toThrow()
    })

    it('sends usage messages without error', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', {
          type: 'usage',
          text: '',
          metadata: { tokensUsed: 1000, contextSize: 200000 },
        }),
      ).resolves.not.toThrow()
    })

    it('sends error messages without error', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', { type: 'error', text: 'something failed' }),
      ).resolves.not.toThrow()
    })

    it('handles session_end without error', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', { type: 'session_end', text: 'finished' }),
      ).resolves.not.toThrow()
    })

    it('handles unknown message types gracefully', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendMessage('test-session', { type: 'unknown_type' as never, text: '' }),
      ).resolves.not.toThrow()
    })

    it('sendNotification does not throw', async () => {
      adapter = await createAdapter()
      await expect(
        adapter.sendNotification({
          sessionId: 'test',
          type: 'completed',
          summary: 'done',
        }),
      ).resolves.not.toThrow()
    })
  })
}
