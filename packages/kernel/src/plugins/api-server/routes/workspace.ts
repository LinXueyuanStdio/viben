import type { FastifyInstance } from 'fastify'

/** Options injected when the workspace route is registered. */
export interface WorkspaceRouteOpts {
  /** Unique workspace/instance identifier. */
  id: string
  name: string
  /** Absolute path to the workspace directory. */
  directory: string
  version: string
}

/**
 * Registers `GET /workspace` which returns identity info about the running instance.
 *
 * The App uses this on first connect to display the workspace name and verify it is
 * talking to the correct instance when multiple workspaces are configured.
 */
export async function workspaceRoute(
  app: FastifyInstance,
  opts: WorkspaceRouteOpts,
): Promise<void> {
  app.get('/workspace', async () => ({
    id: opts.id,
    name: opts.name,
    directory: opts.directory,
    version: opts.version,
  }))
}
