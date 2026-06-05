/**
 * Warm-pool unit tests for AgentManager.
 *
 * We mock `AgentInstance` at the module boundary so we never touch the real
 * subprocess spawn logic (and avoid the transitive `ignore` package import
 * that is missing from node_modules in this test environment).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Module-level mock — must come before any import of the real module ────────
vi.mock('../agent-instance.js', () => {
  return {
    AgentInstance: {
      spawnSubprocess: vi.fn(),
      spawn: vi.fn(),
      resume: vi.fn(),
    },
  }
})

// Now safe to import — AgentInstance is mocked
import { AgentManager } from '../agent-manager.js'
import { AgentInstance } from '../agent-instance.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockCatalog(installed: Record<string, any> = {}) {
  return {
    resolve: vi.fn((name: string) => {
      if (installed[name]) {
        return {
          name,
          command: installed[name].command ?? 'mock-agent',
          args: installed[name].args ?? [],
          env: installed[name].env ?? {},
        }
      }
      return undefined
    }),
    getInstalledEntries: vi.fn(() => installed),
  } as any
}

function fakeWarmInstance(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: undefined,
    isDead: false,
    claimForSession: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AgentManager warm-pool', () => {
  beforeEach(() => {
    vi.mocked(AgentInstance.spawnSubprocess).mockReset()
    vi.mocked(AgentInstance.spawn).mockReset()
    vi.mocked(AgentInstance.resume).mockReset()
    // Default: spawn returns a fresh fake instance
    vi.mocked(AgentInstance.spawnSubprocess).mockImplementation(
      async () => fakeWarmInstance() as any,
    )
    vi.mocked(AgentInstance.spawn).mockImplementation(
      async () => fakeWarmInstance() as any,
    )
  })

  // ── 1. prewarm schedules a single warm entry; concurrent calls are deduped ──

  describe('prewarm()', () => {
    it('spawns a subprocess for the named agent in the background', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      manager.prewarm('claude', '/workspace')

      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )
      expect(AgentInstance.spawnSubprocess).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'claude' }),
        '/workspace',
        [],
      )
    })

    it('is a no-op if a second call arrives while warming is in flight', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      let resolveSpawn!: () => void
      vi.mocked(AgentInstance.spawnSubprocess).mockImplementation(
        () =>
          new Promise<any>((res) => {
            resolveSpawn = () => res(fakeWarmInstance())
          }),
      )

      manager.prewarm('claude', '/workspace')
      manager.prewarm('claude', '/workspace') // second call — no-op

      resolveSpawn()
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )
      expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1)
    })

    it('is a no-op when a matching warm entry already exists', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      manager.prewarm('claude', '/workspace')
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      // Second call with same agent/dir — entry already present
      manager.prewarm('claude', '/workspace')
      await Promise.resolve()

      expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1)
    })

    it('skips if agent is not installed', async () => {
      const catalog = mockCatalog({})
      const manager = new AgentManager(catalog)

      manager.prewarm('claude', '/workspace')
      await Promise.resolve()

      expect(AgentInstance.spawnSubprocess).not.toHaveBeenCalled()
    })
  })

  // ── 2. spawn() on matching agent/workingDir consumes the warm ────────────

  describe('spawn() — warm hit', () => {
    it('calls claimForSession on the warm instance instead of AgentInstance.spawn', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      manager.prewarm('claude', '/workspace')
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      const result = await manager.spawn('claude', '/workspace')

      expect((result as any).claimForSession).toHaveBeenCalledWith('/workspace')
      expect(AgentInstance.spawn).not.toHaveBeenCalled()
    })

    it('fires a background refill after consuming the warm instance', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      manager.prewarm('claude', '/workspace')
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      await manager.spawn('claude', '/workspace')

      // Refill: a second spawnSubprocess call should happen in the background
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(2),
      )
    })
  })

  // ── 3. spawn() on mismatched agent does NOT consume the warm ─────────────

  describe('spawn() — warm miss (different agent)', () => {
    it('leaves the warm entry intact and calls AgentInstance.spawn normally', async () => {
      const catalog = mockCatalog({
        claude: { command: 'claude-agent-acp' },
        gemini: { command: 'gemini-agent-acp' },
      })
      const manager = new AgentManager(catalog)

      manager.prewarm('claude', '/workspace')
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      // Spawn a different agent — should not consume the claude warm slot
      await manager.spawn('gemini', '/workspace')

      expect(AgentInstance.spawn).toHaveBeenCalledOnce()

      // The warm entry must still be there — spawning claude now should hit it
      vi.mocked(AgentInstance.spawn).mockClear()
      vi.mocked(AgentInstance.spawnSubprocess).mockClear()
      const claudeResult = await manager.spawn('claude', '/workspace')
      expect((claudeResult as any).claimForSession).toHaveBeenCalled()
      expect(AgentInstance.spawn).not.toHaveBeenCalled()
    })
  })

  // ── 4. isDead warm instance → fall through to full spawn ─────────────────

  describe('spawn() — dead warm instance', () => {
    it('falls through to AgentInstance.spawn when warm instance is dead', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      const deadInstance = fakeWarmInstance({ isDead: true })
      vi.mocked(AgentInstance.spawnSubprocess).mockResolvedValueOnce(deadInstance as any)

      manager.prewarm('claude', '/workspace')
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      await manager.spawn('claude', '/workspace')

      // Dead warm was discarded — fell through to full spawn
      expect(AgentInstance.spawn).toHaveBeenCalledOnce()
      expect(deadInstance.claimForSession).not.toHaveBeenCalled()
    })
  })

  // ── 5. claimForSession throws → fall through + no crash ──────────────────

  describe('spawn() — claim failure', () => {
    it('falls through to fresh spawn when claimForSession throws', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      const badInstance = fakeWarmInstance()
      ;(badInstance.claimForSession as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('ACP gone'),
      )
      vi.mocked(AgentInstance.spawnSubprocess).mockResolvedValueOnce(badInstance as any)

      manager.prewarm('claude', '/workspace')
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      // Should not throw — fallback happens internally
      await expect(manager.spawn('claude', '/workspace')).resolves.toBeDefined()

      // destroy was called on the bad warm instance
      expect(badInstance.destroy).toHaveBeenCalled()
      // Full spawn fallback was used
      expect(AgentInstance.spawn).toHaveBeenCalledOnce()
    })
  })

  // ── 6. destroyWarm destroys the warm instance and clears the slot ─────────

  describe('destroyWarm()', () => {
    it('destroys the warm instance and clears the slot', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      const warmInst = fakeWarmInstance()
      vi.mocked(AgentInstance.spawnSubprocess).mockResolvedValueOnce(warmInst as any)

      manager.prewarm('claude', '/workspace')
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      await manager.destroyWarm()

      expect(warmInst.destroy).toHaveBeenCalled()

      // After destroyWarm, spawn should fall through to full spawn (no warm entry)
      vi.mocked(AgentInstance.spawn).mockClear()
      await manager.spawn('claude', '/workspace')
      expect(AgentInstance.spawn).toHaveBeenCalledOnce()
    })

    it('is safe to call when no warm entry exists', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      await expect(manager.destroyWarm()).resolves.toBeUndefined()
    })
  })

  // ── TTL: stale warm entries are discarded ─────────────────────────────────

  describe('TTL', () => {
    it('discards a warm entry older than 5 minutes and falls through to full spawn', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      const staleInst = fakeWarmInstance()
      vi.mocked(AgentInstance.spawnSubprocess).mockResolvedValueOnce(staleInst as any)

      manager.prewarm('claude', '/workspace')
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      // Simulate 6 minutes elapsed
      const sixMinutesMs = 6 * 60 * 1000
      const realNow = Date.now()
      vi.spyOn(Date, 'now').mockReturnValue(realNow + sixMinutesMs)

      try {
        await manager.spawn('claude', '/workspace')
      } finally {
        vi.restoreAllMocks()
      }

      // Stale entry destroyed
      expect(staleInst.destroy).toHaveBeenCalled()
      // Fell through to full spawn
      expect(AgentInstance.spawn).toHaveBeenCalledOnce()
    })
  })

  // ── Review fix: dead warm instance must be destroy()ed (not just orphaned) ──

  describe('spawn() — dead warm instance is destroyed (resource cleanup)', () => {
    it('calls destroy() on a dead warm instance to release listeners + StderrCapture', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      const deadInstance = fakeWarmInstance({ isDead: true })
      vi.mocked(AgentInstance.spawnSubprocess).mockResolvedValueOnce(deadInstance as any)

      manager.prewarm('claude', '/workspace')
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      await manager.spawn('claude', '/workspace')

      expect(deadInstance.destroy).toHaveBeenCalled()
    })
  })

  // ── Review fix: allowedPaths is part of the warm match key ────────────────

  describe('allowedPaths matching', () => {
    it('reuses the warm when allowedPaths match (order-insensitive)', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      manager.prewarm('claude', '/workspace', ['/a', '/b'])
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      // Different order, same set — must match
      const result = await manager.spawn('claude', '/workspace', ['/b', '/a'])
      expect((result as any).claimForSession).toHaveBeenCalled()
      expect(AgentInstance.spawn).not.toHaveBeenCalled()
    })

    it('discards the warm when allowedPaths differ — security boundary mismatch', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      const warmInst = fakeWarmInstance()
      vi.mocked(AgentInstance.spawnSubprocess).mockResolvedValueOnce(warmInst as any)

      manager.prewarm('claude', '/workspace', ['/a'])
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      // Different allowedPaths → mismatched PathGuard → must NOT reuse
      await manager.spawn('claude', '/workspace', ['/a', '/b'])

      // Warm was destroyed (cleared), full spawn happened
      expect(warmInst.destroy).toHaveBeenCalled()
      expect(warmInst.claimForSession).not.toHaveBeenCalled()
      expect(AgentInstance.spawn).toHaveBeenCalledOnce()
    })
  })

  // ── Review fix: prewarm evicts mismatched entry, warms with new params ──────

  describe('prewarm() — mismatched allowedPaths eviction', () => {
    it('evicts a mismatched warm entry and warms with the new allowedPaths', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      // First prewarm: allowedPaths = ['/a']
      const firstInstance = fakeWarmInstance()
      vi.mocked(AgentInstance.spawnSubprocess).mockResolvedValueOnce(firstInstance as any)

      manager.prewarm('claude', '/workspace', ['/a'])
      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      vi.mocked(AgentInstance.spawnSubprocess).mockClear()

      // Second prewarm with different paths — must evict the first and warm again
      manager.prewarm('claude', '/workspace', ['/a', '/b'])
      expect(firstInstance.destroy).toHaveBeenCalled()

      await vi.waitFor(() =>
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1),
      )

      // New warm slot matches ['/a', '/b'] — spawn should hit it
      vi.mocked(AgentInstance.spawn).mockClear()
      const result = await manager.spawn('claude', '/workspace', ['/a', '/b'])
      expect((result as any).claimForSession).toHaveBeenCalled()
      expect(AgentInstance.spawn).not.toHaveBeenCalled()
    })
  })

  // ── Review fix: concurrent prewarm + spawn race ───────────────────────────

  describe('race: prewarm in flight when spawn fires', () => {
    it('falls through to full spawn, then refills via post-spawn prewarm', async () => {
      const catalog = mockCatalog({ claude: { command: 'claude-agent-acp' } })
      const manager = new AgentManager(catalog)

      // First prewarm: keep it suspended so spawn fires before it completes.
      let resolveFirstSpawn!: (i: any) => void
      vi.mocked(AgentInstance.spawnSubprocess).mockImplementationOnce(
        () => new Promise<any>((res) => { resolveFirstSpawn = res }),
      )

      manager.prewarm('claude', '/workspace')

      // Spawn fires while warming is in flight — takeWarm finds nothing in slot,
      // falls through to AgentInstance.spawn.
      const spawnP = manager.spawn('claude', '/workspace')
      await spawnP
      expect(AgentInstance.spawn).toHaveBeenCalledOnce()

      // Refill (post-spawn prewarm) is dropped because the original prewarm is
      // still warming — it logs at debug and returns. Now resolve the original:
      resolveFirstSpawn(fakeWarmInstance())

      await vi.waitFor(() => {
        // The first spawnSubprocess from the original prewarm completes and
        // populates the warm slot. A subsequent spawn should find it.
        expect(AgentInstance.spawnSubprocess).toHaveBeenCalledTimes(1)
      })

      // Subsequent spawn picks up the now-warm slot.
      vi.mocked(AgentInstance.spawn).mockClear()
      const next = await manager.spawn('claude', '/workspace')
      expect((next as any).claimForSession).toHaveBeenCalled()
      expect(AgentInstance.spawn).not.toHaveBeenCalled()
    })
  })
})
