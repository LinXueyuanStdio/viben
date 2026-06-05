import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'

// --- Mocks ---

const FAKE_HOME = '/fake/home'

// Mock @clack/prompts
const mockSelect = vi.fn()
const mockIsCancel = vi.fn().mockReturnValue(false)
vi.mock('@clack/prompts', () => ({
  select: (...args: any[]) => mockSelect(...args),
  isCancel: (...args: any[]) => mockIsCancel(...args),
}))

// Mock fs
const mockExistsSync = vi.fn()
const mockReadFileSync = vi.fn()
const mockMkdirSync = vi.fn()
vi.mock('node:fs', () => ({
  default: {
    existsSync: (...args: any[]) => mockExistsSync(...args),
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
    mkdirSync: (...args: any[]) => mockMkdirSync(...args),
  },
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  mkdirSync: (...args: any[]) => mockMkdirSync(...args),
}))

// Mock os.homedir
vi.mock('node:os', () => ({
  default: {
    homedir: () => FAKE_HOME,
  },
  homedir: () => FAKE_HOME,
}))

// Mock instance-context
vi.mock('../../core/instance/instance-context.js', () => ({
  getGlobalRoot: () => path.join(FAKE_HOME, '.viben'),
}))

// Mock InstanceRegistry — must be a class (used with `new`)
const mockRegistryList = vi.fn().mockReturnValue([])
const mockRegistryLoad = vi.fn()
vi.mock('../../core/instance/instance-registry.js', () => ({
  InstanceRegistry: class MockInstanceRegistry {
    constructor(_path: string) {}
    load() { return mockRegistryLoad() }
    list() { return mockRegistryList() }
  },
}))

// Spies
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('promptForInstance', () => {
  const GLOBAL_ROOT = path.join(FAKE_HOME, '.viben')
  const GLOBAL_CONFIG = path.join(GLOBAL_ROOT, 'config.json')

  // We need to dynamically import after mocks are set up
  let promptForInstance: (opts: { allowCreate?: boolean }) => Promise<string>

  beforeEach(async () => {
    vi.clearAllMocks()

    // Default: TTY mode
    Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })
    Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true })

    // Default: CWD is not home
    vi.spyOn(process, 'cwd').mockReturnValue('/fake/workspace')

    // Default: nothing exists on disk
    mockExistsSync.mockReturnValue(false)
    mockRegistryList.mockReturnValue([])
    mockSelect.mockResolvedValue('/selected/.viben')

    // Re-import to pick up mocks (reset module cache)
    vi.resetModules()
    const mod = await import('../instance-prompt.js')
    promptForInstance = mod.promptForInstance
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Fix 2: auto-select single instance for operational commands', () => {
    it('allowCreate=false + 1 instance → auto-selects without prompt', async () => {
      const instanceRoot = '/projects/my-app/.viben'
      mockRegistryList.mockReturnValue([{ id: 'my-app', root: instanceRoot }])
      mockExistsSync.mockImplementation((p: string) => {
        if (p === instanceRoot) return true
        return false
      })
      mockReadFileSync.mockImplementation(() => { throw new Error('not found') })

      const result = await promptForInstance({ allowCreate: false })

      expect(result).toBe(instanceRoot)
      // Should NOT have called clack select
      expect(mockSelect).not.toHaveBeenCalled()
      // Should print hint line
      expect(consoleLogSpy).toHaveBeenCalled()
    })

    it('allowCreate=false + 2 instances → does NOT auto-select, reaches prompt', async () => {
      const root1 = '/projects/app1/.viben'
      const root2 = '/projects/app2/.viben'
      mockRegistryList.mockReturnValue([
        { id: 'app1', root: root1 },
        { id: 'app2', root: root2 },
      ])
      mockExistsSync.mockImplementation((p: string) => {
        if (p === root1 || p === root2) return true
        return false
      })
      mockReadFileSync.mockImplementation(() => { throw new Error('not found') })
      mockSelect.mockResolvedValue(root1)

      const result = await promptForInstance({ allowCreate: false })

      // Should reach the prompt
      expect(mockSelect).toHaveBeenCalled()
    })

    it('allowCreate=true + 1 instance → does NOT auto-select, still prompts', async () => {
      const instanceRoot = '/projects/my-app/.viben'
      mockRegistryList.mockReturnValue([{ id: 'my-app', root: instanceRoot }])
      mockExistsSync.mockImplementation((p: string) => {
        if (p === instanceRoot) return true
        return false
      })
      mockReadFileSync.mockImplementation(() => { throw new Error('not found') })
      mockSelect.mockResolvedValue(instanceRoot)

      const result = await promptForInstance({ allowCreate: true })

      // Should reach the prompt (allowCreate means we show "create new" option too)
      expect(mockSelect).toHaveBeenCalled()
    })
  })

  describe('Fix 3: home directory redirect for new instances', () => {
    it('CWD is home + 0 instances + allowCreate → returns ~/viben-workspace/.viben', async () => {
      vi.spyOn(process, 'cwd').mockReturnValue(FAKE_HOME)
      mockRegistryList.mockReturnValue([])
      mockExistsSync.mockReturnValue(false)

      const result = await promptForInstance({ allowCreate: true })

      expect(result).toBe(path.join(FAKE_HOME, 'viben-workspace', '.viben'))
      // Should create the workspace directory
      expect(mockMkdirSync).toHaveBeenCalledWith(
        path.join(FAKE_HOME, 'viben-workspace'),
        { recursive: true },
      )
    })

    it('CWD is NOT home + 0 instances + allowCreate → returns cwd/.viben', async () => {
      const fakeCwd = '/fake/workspace'
      vi.spyOn(process, 'cwd').mockReturnValue(fakeCwd)
      mockRegistryList.mockReturnValue([])
      mockExistsSync.mockReturnValue(false)

      const result = await promptForInstance({ allowCreate: true })

      expect(result).toBe(path.join(fakeCwd, '.viben'))
    })
  })
})
