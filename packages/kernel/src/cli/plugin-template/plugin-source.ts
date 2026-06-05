import type { TemplateParams } from './package-json.js'

/**
 * Generate the main plugin source file (src/index.ts).
 *
 * Produces a fully annotated VibenPlugin object with all lifecycle hooks stubbed out
 * (setup, teardown, install, configure, migrate, uninstall). Each hook includes
 * commented examples showing how to register services, commands, and event listeners.
 *
 * The generated file is the primary editing surface for plugin authors.
 */
export function generatePluginSource(params: TemplateParams): string {
  const dirName = params.pluginName.replace(/^@[^/]+\//, '')
  const escapedDescription = (params.description || '').replace(/'/g, "\\'")

  return `import type { VibenPlugin, PluginContext, InstallContext, MigrateContext } from '@viben/plugin-sdk'

const plugin: VibenPlugin = {
  name: '${params.pluginName}',
  version: '0.1.0',
  description: '${escapedDescription}',

  // Declare which permissions your plugin needs.
  // Available: events:read, events:emit, services:register, services:use,
  //            middleware:register, commands:register, storage:read, storage:write, kernel:access
  permissions: ['events:read', 'services:register'],

  // Dependencies on other plugins (loaded before this one).
  // pluginDependencies: { '@viben/security': '>=1.0.0' },

  // Optional dependencies (used if available, gracefully degrade if not).
  // optionalPluginDependencies: { '@viben/usage': '>=1.0.0' },

  /**
   * Called during server startup in dependency order.
   * Register services, middleware, commands, and event listeners here.
   */
  async setup(ctx: PluginContext): Promise<void> {
    ctx.log.info('Plugin setup started')

    // Example: register a service
    // ctx.registerService('my-service', myServiceImpl)

    // Example: listen to events
    // ctx.on('session:created', (event) => { ... })

    // Example: register a slash command
    // ctx.registerCommand({
    //   name: 'mycommand',
    //   description: 'Does something useful',
    //   category: 'plugin',
    //   async handler(args) {
    //     return { type: 'text', text: 'Hello from ${params.pluginName}!' }
    //   },
    // })

    ctx.log.info('Plugin setup complete')
  },

  /**
   * Called during server shutdown in reverse dependency order.
   * Clean up resources, close connections, stop timers here.
   * Has a 10-second timeout.
   */
  async teardown(): Promise<void> {
    // Clean up resources here
  },

  /**
   * Called when user runs \`viben plugin add ${params.pluginName}\`.
   * Use ctx.terminal for interactive prompts to gather configuration.
   */
  async install(ctx: InstallContext): Promise<void> {
    ctx.terminal.log.info('Installing ${params.pluginName}...')

    // Example: prompt for configuration
    // const apiKey = await ctx.terminal.text({
    //   message: 'Enter your API key',
    //   validate: (v) => v.length === 0 ? 'Required' : undefined,
    // })
    // await ctx.settings.set('apiKey', apiKey)

    ctx.terminal.log.success('Installation complete!')
  },

  /**
   * Called when user runs \`viben plugin configure ${params.pluginName}\`.
   * Re-run configuration prompts to update settings.
   */
  async configure(ctx: InstallContext): Promise<void> {
    ctx.terminal.log.info('Configuring ${params.pluginName}...')

    // Re-run configuration prompts, pre-filling with current values
    // const current = await ctx.settings.getAll()
    // ...

    ctx.terminal.log.success('Configuration updated!')
  },

  /**
   * Called during boot when the plugin version has changed.
   * Migrate settings from the old format to the new format.
   */
  async migrate(ctx: MigrateContext, oldSettings: unknown, oldVersion: string): Promise<unknown> {
    ctx.log.info(\`Migrating from v\${oldVersion}\`)
    // Return the migrated settings object
    return oldSettings
  },

  /**
   * Called when user runs \`viben plugin remove ${params.pluginName}\`.
   * Clean up any external resources. If opts.purge is true, delete all data.
   */
  async uninstall(ctx: InstallContext, opts: { purge: boolean }): Promise<void> {
    ctx.terminal.log.info('Uninstalling ${params.pluginName}...')
    if (opts.purge) {
      await ctx.settings.clear()
    }
    ctx.terminal.log.success('Uninstalled!')
  },
}

export default plugin
`
}
