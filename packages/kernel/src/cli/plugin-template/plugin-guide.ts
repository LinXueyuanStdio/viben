import type { TemplateParams } from './package-json.js'

/**
 * Generate PLUGIN_GUIDE.md — the human-readable developer guide embedded in every plugin.
 *
 * Contains practical how-to sections: adding commands, registering services, listening to
 * events, using middleware, and writing tests. Aimed at plugin authors who prefer docs
 * over reading the API types directly.
 *
 * This file is kept in sync with the actual Viben plugin API. When the API changes,
 * this generator must be updated so newly scaffolded plugins start with accurate examples.
 */
export function generatePluginGuide(params: TemplateParams): string {
  return `# Plugin Developer Guide

## Overview

**${params.pluginName}** is an Viben plugin.

> TODO: Describe what this plugin does.

## Project Structure

\`\`\`
src/
  index.ts              — Plugin entry point (exports VibenPlugin object)
  __tests__/
    index.test.ts       — Tests using Vitest + @viben/plugin-sdk/testing
package.json            — npm package config with engines.viben constraint
tsconfig.json           — TypeScript strict mode, ES2022, NodeNext
CLAUDE.md               — Full technical reference for AI coding agents
PLUGIN_GUIDE.md         — This file
\`\`\`

## Development Workflow

1. **Edit** \`src/index.ts\` — implement your plugin logic
2. **Dev mode**: \`viben dev .\` — compiles, watches, and hot-reloads your plugin
3. **Test**: \`npm test\` — runs Vitest with SDK testing utilities
4. **Build**: \`npm run build\` — compiles TypeScript to \`dist/\`

\`\`\`bash
npm install
viben dev .     # start developing with hot-reload
npm test          # run tests
npm run build     # compile for publishing
\`\`\`

## Adding a Command

Register commands in your \`setup()\` function. Requires \`commands:register\` permission.

\`\`\`typescript
async setup(ctx: PluginContext) {
  ctx.registerCommand({
    name: 'greet',
    description: 'Send a greeting',
    usage: '[name]',
    category: 'plugin',
    async handler(args) {
      const name = args.raw.trim() || 'World'
      return { type: 'text', text: \\\`Hello, \\\${name}!\\\` }
    },
  })

  // Add a menu item to the /menu command
  ctx.registerMenuItem({ id: 'my-item', label: 'My Feature', priority: 150, action: { type: 'command', command: '/greet' } })
  // Remove it later if needed
  ctx.unregisterMenuItem('my-item')

  // Add context sections for the assistant command
  ctx.registerAssistantSection({ id: 'my-section', title: 'My Section', priority: 200, buildContext: () => 'context text' })
  ctx.unregisterAssistantSection('my-section')
}
\`\`\`

The command will be available as \`/greet\` in all messaging platforms.

## Adding a Service

Provide a service that other plugins can consume. Requires \`services:register\` permission.

\`\`\`typescript
async setup(ctx: PluginContext) {
  const myService = {
    doSomething(input: string): string {
      return input.toUpperCase()
    },
  }
  ctx.registerService('my-service', myService)
}
\`\`\`

Other plugins access it with \`ctx.getService<MyServiceType>('my-service')\`.

## Adding Middleware

Intercept and modify message flows. Requires \`middleware:register\` permission.

\`\`\`typescript
async setup(ctx: PluginContext) {
  ctx.registerMiddleware('message:outgoing', {
    priority: 50,
    handler: async (payload, next) => {
      // Modify the message before delivery
      payload.message.text += '\\n-- sent via ${params.pluginName}'
      return next()  // continue the chain
      // return null to block the message entirely
    },
  })
}
\`\`\`

## Handling Settings

### Install flow (first-time setup)

\`\`\`typescript
async install(ctx: InstallContext) {
  const apiKey = await ctx.terminal.password({
    message: 'Enter your API key:',
    validate: (v) => v.length > 0 ? undefined : 'Required',
  })
  await ctx.settings.set('apiKey', apiKey)
  ctx.terminal.log.success('Configured!')
}
\`\`\`

### Configure flow (reconfiguration)

\`\`\`typescript
async configure(ctx: InstallContext) {
  const current = await ctx.settings.getAll()
  const apiKey = await ctx.terminal.password({
    message: \\\`API key (current: \\\${current.apiKey ? '***' : 'not set'}):\\\`,
  })
  if (apiKey) await ctx.settings.set('apiKey', apiKey)
  ctx.terminal.log.success('Updated!')
}
\`\`\`

### Reading settings at runtime

\`\`\`typescript
async setup(ctx: PluginContext) {
  const apiKey = ctx.pluginConfig.apiKey as string
  if (!apiKey) {
    ctx.log.warn('Not configured — run: viben plugin configure ${params.pluginName}')
    return
  }
  // Use apiKey...
}
\`\`\`

## Testing

Tests use Vitest and \`@viben/plugin-sdk/testing\`.

\`\`\`typescript
import { describe, it, expect } from 'vitest'
import { createTestContext, createTestInstallContext, mockServices } from '@viben/plugin-sdk/testing'
import plugin from '../index.js'

describe('${params.pluginName}', () => {
  it('registers commands on setup', async () => {
    const ctx = createTestContext({ pluginName: '${params.pluginName}' })
    await plugin.setup(ctx)
    expect(ctx.registeredCommands.has('greet')).toBe(true)
  })

  it('command returns expected response', async () => {
    const ctx = createTestContext({ pluginName: '${params.pluginName}' })
    await plugin.setup(ctx)
    const res = await ctx.executeCommand('greet', { raw: 'Alice' })
    expect(res).toEqual({ type: 'text', text: 'Hello, Alice!' })
  })

  it('install saves settings', async () => {
    const ctx = createTestInstallContext({
      pluginName: '${params.pluginName}',
      terminalResponses: { password: ['sk-test-key'] },
    })
    await plugin.install!(ctx)
    expect(ctx.settingsData.get('apiKey')).toBe('sk-test-key')
  })
})
\`\`\`

### Available mock services

\`\`\`typescript
const ctx = createTestContext({
  pluginName: '${params.pluginName}',
  services: {
    security: mockServices.security(),
    usage: mockServices.usage({ async checkBudget() { return { ok: false, percent: 100 } } }),
  },
})
\`\`\`

## Publishing

1. Update \`version\` in both \`package.json\` and \`src/index.ts\`
2. Build and test:
   \`\`\`bash
   npm run build
   npm test
   \`\`\`
3. Publish:
   \`\`\`bash
   npm publish --access public
   \`\`\`
4. Users install with:
   \`\`\`bash
   viben plugin install ${params.pluginName}
   \`\`\`
5. Submit to the [Viben Plugin Registry](https://github.com/Viben/plugin-registry) for discoverability.

## Useful Links

- [Architecture: Plugin System](https://docs.viben.dev/architecture/plugin-system)
- [Architecture: Writing Plugins](https://docs.viben.dev/architecture/writing-plugins)
- [Architecture: Command System](https://docs.viben.dev/architecture/command-system)
- [Plugin SDK Reference](https://docs.viben.dev/extending/plugin-sdk-reference)
- [Getting Started: Your First Plugin](https://docs.viben.dev/extending/getting-started-plugin)
- [Dev Mode](https://docs.viben.dev/extending/dev-mode)
- [Contributing](https://github.com/LinXueyuanStdio/viben/blob/main/CONTRIBUTING.md)
`
}
