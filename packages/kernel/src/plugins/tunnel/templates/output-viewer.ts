import type { ViewerEntry } from '../viewer-store.js'

/**
 * Render a simple line-numbered output viewer HTML page.
 *
 * Intentionally minimal (no Monaco) since command output is plain text and
 * doesn't benefit from a full code editor. Line numbers are rendered server-side
 * to avoid any JS dependency, making the page fast to load even for long outputs.
 */
export function renderOutputViewer(entry: ViewerEntry): string {
  const label = entry.filePath ?? 'Output'
  const lines = entry.content.split('\n')
  const lineNumbers = lines
    .map((line, i) => {
      const num = String(i + 1).padStart(String(lines.length).length, ' ')
      return `<span class="line-num">${num}</span><span class="line-content">${escapeHtml(line)}</span>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(label)} — Viben</title>
<style>
  body { background: #0d1117; color: #c9d1d9; font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 13px; margin: 0; padding: 0; }
  header { background: #161b22; border-bottom: 1px solid #30363d; padding: 12px 20px; position: sticky; top: 0; z-index: 10; }
  header h1 { margin: 0; font-size: 14px; color: #e6edf3; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .content { padding: 16px 20px; }
  pre { margin: 0; line-height: 1.6; white-space: pre; overflow-x: auto; }
  .line-num { color: #484f58; user-select: none; margin-right: 16px; display: inline-block; min-width: 3ch; text-align: right; }
  .line-content { color: #c9d1d9; }
</style>
</head>
<body>
<header><h1>📋 ${escapeHtml(label)}</h1></header>
<div class="content"><pre>${lineNumbers}</pre></div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
