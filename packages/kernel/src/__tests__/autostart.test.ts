import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}))

vi.mock('../core/utils/log.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('autostart', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-autostart-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('escapeXml', () => {
    it('escapes XML special characters', async () => {
      const { escapeXml } = await import('../cli/autostart.js')
      expect(escapeXml('a & b')).toBe('a &amp; b')
      expect(escapeXml('<script>')).toBe('&lt;script&gt;')
      expect(escapeXml('"hello"')).toBe('&quot;hello&quot;')
      expect(escapeXml("it's")).toBe('it&apos;s')
      expect(escapeXml('/normal/path')).toBe('/normal/path')
    })
  })

  describe('escapeSystemdValue', () => {
    it('quotes and escapes systemd special characters', async () => {
      const { escapeSystemdValue } = await import('../cli/autostart.js')
      expect(escapeSystemdValue('/usr/bin/node')).toBe('"/usr/bin/node"')
      expect(escapeSystemdValue('/path with spaces/node')).toBe('"/path with spaces/node"')
      expect(escapeSystemdValue('/path"quote')).toBe('"/path\\"quote"')
      expect(escapeSystemdValue('/path\\back')).toBe('"/path\\\\back"')
      expect(escapeSystemdValue('/path%specifier')).toBe('"/path%%specifier"')
      expect(escapeSystemdValue('/home/$USER/bin')).toBe('"/home/$$USER/bin"')
    })
  })

  describe('generateLaunchdPlist', () => {
    it('generates valid plist with absolute paths', async () => {
      const { generateLaunchdPlist } = await import('../cli/autostart.js')
      const plist = generateLaunchdPlist(
        '/usr/local/bin/node', '/usr/local/lib/cli.js',
        '/Users/test/.viben/logs', '/Users/test/.viben', 'test-instance',
      )
      expect(plist).toContain('/usr/local/bin/node')
      expect(plist).toContain('/usr/local/lib/cli.js')
      expect(plist).toContain('--daemon-child')
      expect(plist).toContain('com.viben.daemon.test-instance')
      expect(plist).not.toContain('~')
    })

    it('includes VIBEN_INSTANCE_ROOT in EnvironmentVariables', async () => {
      const { generateLaunchdPlist } = await import('../cli/autostart.js')
      const plist = generateLaunchdPlist(
        '/usr/bin/node', '/usr/bin/viben',
        '/logs', '/Users/test/workspace/.viben', 'my-project',
      )
      expect(plist).toContain('<key>EnvironmentVariables</key>')
      expect(plist).toContain('<key>VIBEN_INSTANCE_ROOT</key>')
      expect(plist).toContain('<string>/Users/test/workspace/.viben</string>')
    })

    it('uses per-instance label with instanceId', async () => {
      const { generateLaunchdPlist } = await import('../cli/autostart.js')
      const plist = generateLaunchdPlist(
        '/usr/bin/node', '/usr/bin/viben',
        '/logs', '/Users/test/.viben', 'abc-123',
      )
      expect(plist).toContain('<string>com.viben.daemon.abc-123</string>')
    })

    it('escapes special characters in paths', async () => {
      const { generateLaunchdPlist } = await import('../cli/autostart.js')
      const plist = generateLaunchdPlist(
        '/usr/bin/no<de', '/path/"cli".js',
        '/logs/a&b', '/root', 'test',
      )
      expect(plist).toContain('<string>/usr/bin/no&lt;de</string>')
      expect(plist).toContain('<string>/path/&quot;cli&quot;.js</string>')
      expect(plist).toContain('<string>/logs/a&amp;b/viben.log</string>')
      expect(plist).not.toContain('<de')
    })

    it('escapes special characters in instanceRoot', async () => {
      const { generateLaunchdPlist } = await import('../cli/autostart.js')
      const plist = generateLaunchdPlist(
        '/usr/bin/node', '/usr/bin/viben',
        '/logs', '/path/with&special/root', 'test',
      )
      expect(plist).toContain('<string>/path/with&amp;special/root</string>')
    })
  })

  describe('generateSystemdUnit', () => {
    it('generates valid unit file with absolute paths', async () => {
      const { generateSystemdUnit } = await import('../cli/autostart.js')
      const unit = generateSystemdUnit(
        '/usr/bin/node', '/usr/lib/cli.js',
        '/home/user/.viben', 'test-instance',
      )
      expect(unit).toContain('/usr/bin/node')
      expect(unit).toContain('/usr/lib/cli.js')
      expect(unit).toContain('--daemon-child')
      expect(unit).toContain('Restart=on-failure')
    })

    it('uses per-instance service name', async () => {
      const { generateSystemdUnit } = await import('../cli/autostart.js')
      const unit = generateSystemdUnit(
        '/usr/bin/node', '/usr/lib/cli.js',
        '/home/user/.viben', 'my-project',
      )
      expect(unit).toContain('viben-my-project')
    })

    it('includes VIBEN_INSTANCE_ROOT environment variable', async () => {
      const { generateSystemdUnit } = await import('../cli/autostart.js')
      const unit = generateSystemdUnit(
        '/usr/bin/node', '/usr/lib/cli.js',
        '/home/user/.viben', 'test-instance',
      )
      expect(unit).toContain('VIBEN_INSTANCE_ROOT=')
      expect(unit).toContain('/home/user/.viben')
    })

    it('escapes special characters in paths', async () => {
      const { generateSystemdUnit } = await import('../cli/autostart.js')
      const unit = generateSystemdUnit(
        '/usr/bin/no de', '/path/"cli".js',
        '/home/user/.viben', 'test',
      )
      expect(unit).toContain('ExecStart="/usr/bin/no de" "/path/\\"cli\\".js" --daemon-child')
    })

    it('escapes percent specifiers', async () => {
      const { generateSystemdUnit } = await import('../cli/autostart.js')
      const unit = generateSystemdUnit(
        '/usr/bin/node', '/home/%user/cli.js',
        '/home/user/.viben', 'test',
      )
      expect(unit).toContain('%%user')
    })
  })

  describe('isAutoStartSupported', () => {
    it('returns true on darwin or linux', async () => {
      const { isAutoStartSupported } = await import('../cli/autostart.js')
      const supported = isAutoStartSupported()
      if (process.platform === 'darwin' || process.platform === 'linux') {
        expect(supported).toBe(true)
      } else {
        expect(supported).toBe(false)
      }
    })
  })

  describe('installAutoStart', () => {
    let origPlatform: NodeJS.Platform
    const fakeNodePath = '/usr/bin/node'
    const fakeCli = '/usr/lib/viben/cli.js'
    const instanceRoot = '/home/user/.viben'
    const instanceId = 'my-project'

    beforeEach(() => {
      origPlatform = process.platform
      Object.defineProperty(process, 'execPath', { value: fakeNodePath, configurable: true })
      Object.defineProperty(process, 'argv', { value: [fakeNodePath, fakeCli], configurable: true })
    })

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true })
      vi.resetAllMocks()
    })

    it('writes plist file and calls launchctl on darwin', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      const { execFileSync } = await import('node:child_process')
      const { installAutoStart } = await import('../cli/autostart.js')

      const logDir = path.join(tmpDir, 'logs')
      const result = installAutoStart(logDir, instanceRoot, instanceId)

      expect(result.success).toBe(true)
      const launchAgentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents')
      const plistPath = path.join(launchAgentsDir, `com.viben.daemon.${instanceId}.plist`)
      expect(fs.existsSync(plistPath)).toBe(true)
      const content = fs.readFileSync(plistPath, 'utf-8')
      expect(content).toContain(`com.viben.daemon.${instanceId}`)
      expect(content).toContain(instanceRoot)
      // bootstrap must use: ['bootstrap', 'gui/<uid>', plistPath]
      expect(execFileSync).toHaveBeenCalledWith(
        'launchctl',
        expect.arrayContaining(['bootstrap', plistPath]),
        expect.any(Object),
      )
    })

    it('returns error on unsupported platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
      const { installAutoStart } = await import('../cli/autostart.js')
      const result = installAutoStart('/logs', instanceRoot, instanceId)
      expect(result.success).toBe(false)
      expect(result.error).toContain('not supported')
    })
  })

  describe('uninstallAutoStart', () => {
    let origPlatform: NodeJS.Platform

    beforeEach(() => {
      origPlatform = process.platform
    })

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true })
      vi.resetAllMocks()
    })

    it('removes plist file and calls launchctl unload on darwin', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      const instanceId = 'uninstall-test'
      const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `com.viben.daemon.${instanceId}.plist`)
      fs.mkdirSync(path.dirname(plistPath), { recursive: true })
      fs.writeFileSync(plistPath, '<plist/>')

      const { execFileSync } = await import('node:child_process')
      const { uninstallAutoStart } = await import('../cli/autostart.js')
      const result = uninstallAutoStart(instanceId)

      expect(result.success).toBe(true)
      expect(fs.existsSync(plistPath)).toBe(false)
      // bootout must use plist path form: ['bootout', 'gui/<uid>', plistPath]
      expect(execFileSync).toHaveBeenCalledWith(
        'launchctl',
        expect.arrayContaining(['bootout', plistPath]),
        expect.any(Object),
      )
    })

    it('succeeds silently when plist does not exist on darwin', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      const { uninstallAutoStart } = await import('../cli/autostart.js')
      const result = uninstallAutoStart('nonexistent-instance-xyz')
      expect(result.success).toBe(true)
    })

    it('returns error on unsupported platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
      const { uninstallAutoStart } = await import('../cli/autostart.js')
      const result = uninstallAutoStart('any')
      expect(result.success).toBe(false)
    })
  })

  describe('isAutoStartInstalled', () => {
    let origPlatform: NodeJS.Platform

    beforeEach(() => {
      origPlatform = process.platform
    })

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true })
    })

    it('returns true when plist file exists on darwin', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      const instanceId = 'installed-check'
      const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `com.viben.daemon.${instanceId}.plist`)
      fs.mkdirSync(path.dirname(plistPath), { recursive: true })
      fs.writeFileSync(plistPath, '<plist/>')

      const { isAutoStartInstalled } = await import('../cli/autostart.js')
      expect(isAutoStartInstalled(instanceId)).toBe(true)

      fs.unlinkSync(plistPath)
    })

    it('returns false when plist file does not exist on darwin', async () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
      const { isAutoStartInstalled } = await import('../cli/autostart.js')
      expect(isAutoStartInstalled('definitely-not-installed-xyz')).toBe(false)
    })

    it('returns false on unsupported platform', async () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
      const { isAutoStartInstalled } = await import('../cli/autostart.js')
      expect(isAutoStartInstalled('any')).toBe(false)
    })
  })
})

describe('resolveInstanceId', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viben-resolve-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('falls back to sanitized parent dir name when registry not found', async () => {
    const { resolveInstanceId } = await import('../cli/resolve-instance-id.js')
    const instanceRoot = path.join(tmpDir, 'my-project', '.viben')
    fs.mkdirSync(instanceRoot, { recursive: true })
    const id = resolveInstanceId(instanceRoot)
    expect(id).toBe('my-project')
  })

  it('sanitizes special characters in parent dir name', async () => {
    const { resolveInstanceId } = await import('../cli/resolve-instance-id.js')
    const instanceRoot = path.join(tmpDir, 'my project!@#', '.viben')
    fs.mkdirSync(instanceRoot, { recursive: true })
    const id = resolveInstanceId(instanceRoot)
    expect(id).toMatch(/^[a-zA-Z0-9-]+$/)
    expect(id).not.toContain(' ')
  })

  it('returns "default" when parent dir resolves to empty string', async () => {
    const { resolveInstanceId } = await import('../cli/resolve-instance-id.js')
    // Path like /.viben → dirname is /, basename is '' → fallback to 'default'
    const id = resolveInstanceId('/.viben')
    expect(id).toBe('default')
  })
})
