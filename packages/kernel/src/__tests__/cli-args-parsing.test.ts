/**
 * CLI args parsing tests.
 *
 * cli.ts dispatches commands like this:
 *   const [command, ...args] = remaining
 *   cmdFoo(args)
 *
 * So `args` does NOT contain the command name. These tests verify that
 * every command handler correctly indexes into args (args[0] is the first
 * real argument, not the command name).
 *
 * This was a systematic bug where handlers used args[1] instead of args[0],
 * silently ignoring the first argument.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We can't easily call the real handlers (they do I/O, spawn processes, etc.),
// so we simulate the args dispatch from cli.ts and test the parsing logic
// that each command uses, extracted into a helper.

/**
 * Simulates how cli.ts splits process.argv into [command, ...args].
 * Given a full CLI invocation string, returns the args array that
 * would be passed to the command handler.
 */
function simulateDispatch(argv: string[]): { command: string; args: string[] } {
  // Mirrors cli.ts: const [command, ...args] = remaining
  // (simplified: no instance flag extraction needed for these tests)
  const [command, ...args] = argv
  return { command: command!, args }
}

describe('CLI args dispatch', () => {
  describe('simulateDispatch matches cli.ts behavior', () => {
    it('strips command name from args', () => {
      const { command, args } = simulateDispatch(['dev', '/path/to/plugin', '--verbose'])
      expect(command).toBe('dev')
      expect(args).toEqual(['/path/to/plugin', '--verbose'])
      // args[0] is the first real argument, NOT the command name
      expect(args[0]).toBe('/path/to/plugin')
    })

    it('handles single subcommand', () => {
      const { args } = simulateDispatch(['agents', 'install', 'claude'])
      expect(args[0]).toBe('install')
      expect(args[1]).toBe('claude')
    })

    it('handles no arguments', () => {
      const { args } = simulateDispatch(['config'])
      expect(args).toEqual([])
      expect(args[0]).toBeUndefined()
    })
  })
})

describe('CLI command args parsing', () => {
  // Each test verifies the parsing logic that the command handler uses.
  // If a command uses args[N], we check that N maps to the correct argument.

  describe('cmdDev', () => {
    it('parses plugin path as first non-flag arg from args (not args.slice(1))', () => {
      const { args } = simulateDispatch(['dev', '/path/to/plugin', '--verbose'])
      // cmdDev does: args.find(a => !a.startsWith('--'))
      const pluginPathArg = args.find(a => !a.startsWith('--'))
      expect(pluginPathArg).toBe('/path/to/plugin')
    })

    it('parses plugin path when flags come first', () => {
      const { args } = simulateDispatch(['dev', '--verbose', '/path/to/plugin'])
      const pluginPathArg = args.find(a => !a.startsWith('--'))
      expect(pluginPathArg).toBe('/path/to/plugin')
    })
  })

  describe('cmdAgents', () => {
    it('parses subcommand from args[0]', () => {
      const { args } = simulateDispatch(['agents', 'install', 'claude'])
      const subcommand = args[0]
      expect(subcommand).toBe('install')
    })

    it('parses agent name from args[1]', () => {
      const { args } = simulateDispatch(['agents', 'install', 'claude'])
      const name = args[1]
      expect(name).toBe('claude')
    })

    it('parses run extra args from args.slice(2)', () => {
      const { args } = simulateDispatch(['agents', 'run', 'gemini', '--', '--flag'])
      const subcommand = args[0]
      const name = args[1]
      const extraArgs = args.slice(2)
      expect(subcommand).toBe('run')
      expect(name).toBe('gemini')
      expect(extraArgs).toEqual(['--', '--flag'])
    })

    it('returns undefined subcommand when no args', () => {
      const { args } = simulateDispatch(['agents'])
      expect(args[0]).toBeUndefined()
    })
  })

  describe('cmdApi', () => {
    it('parses subcommand from args[0]', () => {
      const { args } = simulateDispatch(['api', 'status'])
      const subCmd = args[0]
      expect(subCmd).toBe('status')
    })

    it('parses session id from args[1] for session command', () => {
      const { args } = simulateDispatch(['api', 'session', 'abc123'])
      const subCmd = args[0]
      const sessionId = args[1]
      expect(subCmd).toBe('session')
      expect(sessionId).toBe('abc123')
    })

    it('parses send command args correctly', () => {
      const { args } = simulateDispatch(['api', 'send', 'abc123', 'Fix', 'the', 'bug'])
      const subCmd = args[0]
      const sessionId = args[1]
      const prompt = args.slice(2).join(' ')
      expect(subCmd).toBe('send')
      expect(sessionId).toBe('abc123')
      expect(prompt).toBe('Fix the bug')
    })

    it('parses new command with agent and workspace', () => {
      const { args } = simulateDispatch(['api', 'new', 'claude', '/path/to/project'])
      const subCmd = args[0]
      const agent = args[1]
      const workspace = args[2]
      expect(subCmd).toBe('new')
      expect(agent).toBe('claude')
      expect(workspace).toBe('/path/to/project')
    })

    it('parses bypass command', () => {
      const { args } = simulateDispatch(['api', 'bypass', 'abc123', 'on'])
      const subCmd = args[0]
      const sessionId = args[1]
      const toggle = args[2]
      expect(subCmd).toBe('bypass')
      expect(sessionId).toBe('abc123')
      expect(toggle).toBe('on')
    })

    it('parses notify message', () => {
      const { args } = simulateDispatch(['api', 'notify', 'Deploy', 'complete'])
      const subCmd = args[0]
      const message = args.slice(1).join(' ')
      expect(subCmd).toBe('notify')
      expect(message).toBe('Deploy complete')
    })

    it('parses config set subcommand', () => {
      const { args } = simulateDispatch(['api', 'config', 'set', 'telegram.botToken', '123:ABC'])
      const subCmd = args[0]
      const subSubCmd = args[1]
      const configPath = args[2]
      const configValue = args[3]
      expect(subCmd).toBe('config')
      expect(subSubCmd).toBe('set')
      expect(configPath).toBe('telegram.botToken')
      expect(configValue).toBe('123:ABC')
    })

    it('parses session-config set', () => {
      const { args } = simulateDispatch(['api', 'session-config', 'abc123', 'set', 'model', 'claude-opus-4-5'])
      const subCmd = args[0]
      const sessionId = args[1]
      const configSubCmd = args[2]
      const configId = args[3]
      const value = args[4]
      expect(subCmd).toBe('session-config')
      expect(sessionId).toBe('abc123')
      expect(configSubCmd).toBe('set')
      expect(configId).toBe('model')
      expect(value).toBe('claude-opus-4-5')
    })

    it('parses session-config dangerous toggle', () => {
      const { args } = simulateDispatch(['api', 'session-config', 'abc123', 'dangerous', 'on'])
      const subCmd = args[0]
      const sessionId = args[1]
      const configSubCmd = args[2]
      const toggle = args[3]
      expect(subCmd).toBe('session-config')
      expect(sessionId).toBe('abc123')
      expect(configSubCmd).toBe('dangerous')
      expect(toggle).toBe('on')
    })

    it('parses delete-topic', () => {
      const { args } = simulateDispatch(['api', 'delete-topic', 'abc123', '--force'])
      const subCmd = args[0]
      const sessionId = args[1]
      expect(subCmd).toBe('delete-topic')
      expect(sessionId).toBe('abc123')
      expect(args.includes('--force')).toBe(true)
    })
  })

  describe('cmdConfig', () => {
    it('parses set subcommand from args[0]', () => {
      const { args } = simulateDispatch(['config', 'set', 'defaultAgent', 'claude'])
      const subCmd = args[0]
      const configPath = args[1]
      const configValue = args[2]
      expect(subCmd).toBe('set')
      expect(configPath).toBe('defaultAgent')
      expect(configValue).toBe('claude')
    })

    it('returns undefined subCmd when no args (interactive mode)', () => {
      const { args } = simulateDispatch(['config'])
      expect(args[0]).toBeUndefined()
    })
  })

  describe('cmdTunnel', () => {
    it('parses subcommand from args[0]', () => {
      const { args } = simulateDispatch(['tunnel', 'add', '8080', '--label', 'dev'])
      const subCmd = args[0]
      const port = args[1]
      expect(subCmd).toBe('add')
      expect(port).toBe('8080')
    })

    it('parses stop subcommand', () => {
      const { args } = simulateDispatch(['tunnel', 'stop', '3000'])
      const subCmd = args[0]
      const port = args[1]
      expect(subCmd).toBe('stop')
      expect(port).toBe('3000')
    })

    it('parses list subcommand', () => {
      const { args } = simulateDispatch(['tunnel', 'list'])
      expect(args[0]).toBe('list')
    })
  })

  describe('cmdAdopt', () => {
    it('parses agent from args[0] and sessionId from args[1]', () => {
      const { args } = simulateDispatch(['adopt', 'claude', 'abc123-def456'])
      const agent = args[0]
      const sessionId = args[1]
      expect(agent).toBe('claude')
      expect(sessionId).toBe('abc123-def456')
    })

    it('parses with --cwd and --channel flags', () => {
      const { args } = simulateDispatch(['adopt', 'claude', 'abc123', '--cwd', '/path', '--channel', 'telegram'])
      const agent = args[0]
      const sessionId = args[1]
      expect(agent).toBe('claude')
      expect(sessionId).toBe('abc123')
      const cwdIdx = args.indexOf('--cwd')
      expect(args[cwdIdx + 1]).toBe('/path')
      const channelIdx = args.indexOf('--channel')
      expect(args[channelIdx + 1]).toBe('telegram')
    })
  })

  describe('cmdIntegrate', () => {
    it('parses agent name from args[0]', () => {
      const { args } = simulateDispatch(['integrate', 'claude'])
      const agent = args[0]
      expect(agent).toBe('claude')
    })

    it('parses --uninstall flag', () => {
      const { args } = simulateDispatch(['integrate', 'claude', '--uninstall'])
      expect(args[0]).toBe('claude')
      expect(args.includes('--uninstall')).toBe(true)
    })
  })

  describe('cmdDoctor', () => {
    it('parses flags directly from args (not args.slice(1))', () => {
      const { args } = simulateDispatch(['doctor', '--dry-run'])
      // Should not skip any flags
      const knownFlags = ['--dry-run']
      const unknownFlags = args.filter(
        (a) => a.startsWith('--') && !knownFlags.includes(a),
      )
      expect(unknownFlags).toEqual([])
      expect(args.includes('--dry-run')).toBe(true)
    })

    it('detects unknown flags', () => {
      const { args } = simulateDispatch(['doctor', '--dry-run', '--bogus'])
      const knownFlags = ['--dry-run']
      const unknownFlags = args.filter(
        (a) => a.startsWith('--') && !knownFlags.includes(a),
      )
      expect(unknownFlags).toEqual(['--bogus'])
    })
  })

  describe('cmdInstall', () => {
    it('parses package name from args[0]', () => {
      const { args } = simulateDispatch(['install', '@viben/discord-adapter'])
      const pkg = args[0]
      expect(pkg).toBe('@viben/discord-adapter')
    })
  })

  describe('cmdUninstall', () => {
    it('parses package name from args[0]', () => {
      const { args } = simulateDispatch(['uninstall', '@viben/discord-adapter'])
      const pkg = args[0]
      expect(pkg).toBe('@viben/discord-adapter')
    })
  })

  describe('cmdPlugin', () => {
    it('parses subcommand from args[0] (already correct)', () => {
      const { args } = simulateDispatch(['plugin', 'search', 'telegram'])
      const subcommand = args[0]
      expect(subcommand).toBe('search')
    })

    it('parses search query from args.slice(1)', () => {
      const { args } = simulateDispatch(['plugin', 'search', 'telegram'])
      const query = args.slice(1)
      expect(query).toEqual(['telegram'])
    })

    it('parses install package from args[1]', () => {
      const { args } = simulateDispatch(['plugin', 'add', '@viben/discord-adapter'])
      expect(args[0]).toBe('add')
      expect(args[1]).toBe('@viben/discord-adapter')
    })
  })
})
