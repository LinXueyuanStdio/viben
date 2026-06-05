/** Returns true if the user passed -h or --help in the command arguments. */
export function wantsHelp(args: string[]): boolean {
  return args.includes('--help') || args.includes('-h')
}

/**
 * Convert a dot-notation path and value into a nested object for config updates.
 *
 * For example: `buildNestedUpdateFromPath('logging.logDir', '/tmp')` produces
 * `{ logging: { logDir: '/tmp' } }`, which ConfigManager.save() merges into the config.
 */
export function buildNestedUpdateFromPath(dotPath: string, value: unknown): Record<string, unknown> {
  const parts = dotPath.split('.')
  const result: Record<string, unknown> = {}
  let target = result
  for (let i = 0; i < parts.length - 1; i++) {
    target[parts[i]] = {}
    target = target[parts[i]] as Record<string, unknown>
  }
  target[parts[parts.length - 1]] = value
  return result
}
