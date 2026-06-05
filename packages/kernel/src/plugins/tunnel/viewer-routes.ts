import path from 'node:path'
import type { FastifyPluginAsync } from 'fastify'
import type { ViewerStore } from './viewer-store.js'
import { renderFileViewer } from './templates/file-viewer.js'
import { renderDiffViewer } from './templates/diff-viewer.js'
import { renderOutputViewer } from './templates/output-viewer.js'

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Not Found - Viben</title>
<style>body{background:#0d1117;color:#c9d1d9;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{text-align:center;padding:40px}.code{font-size:72px;font-weight:bold;color:#484f58}p{margin-top:16px;color:#8b949e}</style>
</head><body><div class="box"><div class="code">404</div><p>This viewer link has expired or does not exist.</p></div></body></html>`

/**
 * Register viewer routes on the API server (Fastify plugin).
 *
 * These routes serve Monaco-based HTML viewer pages for files, diffs, and command output.
 * Agents produce a short entry id via ViewerStore, then pass the public URL to the user
 * so they can view the content in a browser without needing local access.
 *
 * Routes are registered without auth (viewer links are public but ephemeral — they
 * expire after the configured TTL and the id is unguessable).
 */
export function createViewerRoutes(store: ViewerStore): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { id: string } }>('/view/:id', async (request, reply) => {
      const entry = store.get(request.params.id)
      if (!entry || entry.type !== 'file') {
        return reply.status(404).type('text/html').send(NOT_FOUND_HTML)
      }
      return reply.type('text/html').send(renderFileViewer(entry))
    })

    app.get<{ Params: { id: string } }>('/diff/:id', async (request, reply) => {
      const entry = store.get(request.params.id)
      if (!entry || entry.type !== 'diff') {
        return reply.status(404).type('text/html').send(NOT_FOUND_HTML)
      }
      return reply.type('text/html').send(renderDiffViewer(entry))
    })

    app.get<{ Params: { id: string } }>('/output/:id', async (request, reply) => {
      const entry = store.get(request.params.id)
      if (!entry || entry.type !== 'output') {
        return reply.status(404).type('text/html').send(NOT_FOUND_HTML)
      }
      return reply.type('text/html').send(renderOutputViewer(entry))
    })

    // JSON APIs — used by HTML templates via fetch()
    app.get<{ Params: { id: string } }>('/api/file/:id', async (request, reply) => {
      const entry = store.get(request.params.id)
      if (!entry || entry.type !== 'file') {
        return reply.status(404).send({ error: 'not found' })
      }
      return reply.send({
        filePath: entry.filePath ? path.basename(entry.filePath) : null,
        content: entry.content,
        language: entry.language,
      })
    })

    app.get<{ Params: { id: string } }>('/api/diff/:id', async (request, reply) => {
      const entry = store.get(request.params.id)
      if (!entry || entry.type !== 'diff') {
        return reply.status(404).send({ error: 'not found' })
      }
      return reply.send({
        filePath: entry.filePath ? path.basename(entry.filePath) : null,
        oldContent: entry.oldContent,
        newContent: entry.content,
        language: entry.language,
      })
    })
  }
}
