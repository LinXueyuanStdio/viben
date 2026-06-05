import { describe, it, expect, vi, beforeEach } from 'vitest'
import path from 'node:path'

// We test the pure data-mapping logic extracted from the command
// by mocking readInstanceInfo and InstanceRegistry

vi.mock('../../cli/commands/status.js', () => ({
  readInstanceInfo: vi.fn(),
}))

vi.mock('../../core/instance/instance-registry.js', () => ({
  InstanceRegistry: vi.fn().mockImplementation(() => ({
    load: vi.fn(),
    list: vi.fn().mockReturnValue([]),
  })),
}))

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('00000000-0000-0000-0000-000000000001'),
}))

vi.mock('../../core/instance/instance-context.js', () => ({
  getGlobalRoot: vi.fn().mockReturnValue('/Users/user/.viben'),
}))

vi.mock('node:fs')

import { buildInstanceListEntries, cmdInstancesCreate } from '../../cli/commands/instances.js'
import { readInstanceInfo } from '../../cli/commands/status.js'
import { InstanceRegistry } from '../../core/instance/instance-registry.js'
import fs from 'node:fs'

describe('buildInstanceListEntries', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty array when no instances registered', async () => {
    const mockRegistry = { load: vi.fn(), list: vi.fn().mockReturnValue([]) }
    vi.mocked(InstanceRegistry).mockImplementation(function() { return mockRegistry } as any)
    const result = await buildInstanceListEntries()
    expect(result).toEqual([])
  })

  it('maps registry entries to InstanceListEntry with correct fields', async () => {
    const mockRegistry = {
      load: vi.fn(),
      list: vi.fn().mockReturnValue([
        { id: 'main', root: '/Users/user/.viben' },
      ]),
    }
    vi.mocked(InstanceRegistry).mockImplementation(function() { return mockRegistry } as any)
    vi.mocked(readInstanceInfo).mockReturnValue({
      name: 'Main', pid: 1234, apiPort: 21420,
      tunnelPort: null, runMode: 'daemon', channels: [],
    })

    const result = await buildInstanceListEntries()
    expect(result).toEqual([{
      id: 'main',
      name: 'Main',
      directory: '/Users/user',
      root: '/Users/user/.viben',
      status: 'running',
      port: 21420,
    }])
  })

  it('sets status stopped when pid is null', async () => {
    const mockRegistry = {
      load: vi.fn(),
      list: vi.fn().mockReturnValue([{ id: 'dev', root: '/project/.viben' }]),
    }
    vi.mocked(InstanceRegistry).mockImplementation(function() { return mockRegistry } as any)
    vi.mocked(readInstanceInfo).mockReturnValue({
      name: 'Dev', pid: null, apiPort: null,
      tunnelPort: null, runMode: null, channels: [],
    })

    const result = await buildInstanceListEntries()
    expect(result[0]!.status).toBe('stopped')
    expect(result[0]!.port).toBeNull()
  })

  it('computes directory as path.dirname(root)', async () => {
    const mockRegistry = {
      load: vi.fn(),
      list: vi.fn().mockReturnValue([
        { id: 'proj', root: '/Users/user/my-project/.viben' },
      ]),
    }
    vi.mocked(InstanceRegistry).mockImplementation(function() { return mockRegistry } as any)
    vi.mocked(readInstanceInfo).mockReturnValue({
      name: 'Proj', pid: null, apiPort: null,
      tunnelPort: null, runMode: null, channels: [],
    })

    const result = await buildInstanceListEntries()
    expect(result[0]!.directory).toBe('/Users/user/my-project')
    expect(result[0]!.root).toBe('/Users/user/my-project/.viben')
  })
})

describe('cmdInstancesCreate', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('errors when --dir is missing', async () => {
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit') }) as any)
    const mockError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(cmdInstancesCreate([])).rejects.toThrow('exit')
    expect(mockError).toHaveBeenCalledWith(expect.stringContaining('--dir'))
    mockExit.mockRestore()
    mockError.mockRestore()
  })

  it('returns existing instance idempotently when .viben exists and is registered', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const existingId = 'existing-uuid-001'
    const mockRegistry = {
      load: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      getByRoot: vi.fn().mockReturnValue({ id: existingId, root: '/path/.viben' }),
      register: vi.fn(),
      save: vi.fn(),
      // resolveId returns existing id, registry not updated (already consistent)
      resolveId: vi.fn().mockReturnValue({ id: existingId, registryUpdated: false }),
    }
    vi.mocked(InstanceRegistry).mockImplementation(function() { return mockRegistry } as any)
    vi.mocked(readInstanceInfo).mockReturnValue({ name: 'My Project', pid: null, apiPort: null, tunnelPort: null, runMode: null, channels: [] })
    const mockLog = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await cmdInstancesCreate(['--dir', '/path', '--no-interactive'])
    expect(mockRegistry.resolveId).toHaveBeenCalledWith('/path/.viben')
    expect(mockRegistry.save).not.toHaveBeenCalled()  // registryUpdated = false
    expect(readInstanceInfo).toHaveBeenCalledWith('/path/.viben')
    mockLog.mockRestore()
  })

  it('registers .viben that exists but is not in registry', async () => {
    // .viben exists but registry has no entry — resolveId generates a fresh UUID and registers it
    vi.mocked(fs.existsSync).mockReturnValue(true)
    const freshId = 'fresh-uuid-abc-123'
    const mockRegistry = {
      load: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      getByRoot: vi.fn().mockReturnValue(undefined),
      register: vi.fn(),
      save: vi.fn(),
      // resolveId handles registration internally and signals the caller via registryUpdated
      resolveId: vi.fn().mockReturnValue({ id: freshId, registryUpdated: true }),
    }
    vi.mocked(InstanceRegistry).mockImplementation(function() { return mockRegistry } as any)
    vi.mocked(readInstanceInfo).mockReturnValue({
      name: 'My Project', pid: null, apiPort: null,
      tunnelPort: null, runMode: null, channels: [],
    })

    const mockLog = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await cmdInstancesCreate(['--dir', '/Users/user/my-project'])
    expect(mockRegistry.resolveId).toHaveBeenCalledWith('/Users/user/my-project/.viben')
    expect(mockRegistry.save).toHaveBeenCalled()  // registryUpdated = true
    mockLog.mockRestore()
  })

  it('creates minimal config with --no-interactive flag', async () => {
    // .viben does not exist
    vi.mocked(fs.existsSync).mockReturnValue(false)
    vi.mocked(fs.mkdirSync).mockReturnValue(undefined)
    vi.mocked(fs.writeFileSync).mockReturnValue(undefined)
    const mockRegistry = {
      load: vi.fn(),
      list: vi.fn().mockReturnValue([]),
      getByRoot: vi.fn().mockReturnValue(undefined),
      register: vi.fn(),
      save: vi.fn(),
    }
    vi.mocked(InstanceRegistry).mockImplementation(function() { return mockRegistry } as any)
    vi.mocked(readInstanceInfo).mockReturnValue({
      name: 'my-instance', pid: null, apiPort: null,
      tunnelPort: null, runMode: null, channels: [],
    })

    const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    await cmdInstancesCreate(['--dir', '/Users/user/new-instance', '--name', 'my-instance', '--no-interactive'])

    // mkdirSync called for instanceRoot
    expect(fs.mkdirSync).toHaveBeenCalledWith('/Users/user/new-instance/.viben', { recursive: true })

    // config.json written with instanceName
    const configWriteCall = vi.mocked(fs.writeFileSync).mock.calls.find(
      ([p]) => typeof p === 'string' && (p as string).endsWith('config.json')
    )
    expect(configWriteCall).toBeDefined()
    const writtenConfig = JSON.parse(configWriteCall![1] as string)
    expect(writtenConfig.instanceName).toBe('my-instance')
    expect(writtenConfig.runMode).toBe('daemon')

    // plugins.json also written
    const pluginsWriteCall = vi.mocked(fs.writeFileSync).mock.calls.find(
      ([p]) => typeof p === 'string' && (p as string).endsWith('plugins.json')
    )
    expect(pluginsWriteCall).toBeDefined()

    // ID must be a UUID, not a slug
    expect(mockRegistry.register).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
      '/Users/user/new-instance/.viben'
    )
    expect(mockRegistry.save).toHaveBeenCalled()

    mockLog.mockRestore()
  })
})
