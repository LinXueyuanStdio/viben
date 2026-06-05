import os from 'node:os'
import path from 'node:path'

/**
 * Print which workspace is being used.
 * `root` is the .viben/ path — display the parent (workspace dir).
 */
export function printInstanceHint(root: string): void {
  const workspaceDir = path.dirname(root)
  const displayPath = workspaceDir.replace(os.homedir(), '~')
  console.log(`  Workspace: ${displayPath}`)
}
