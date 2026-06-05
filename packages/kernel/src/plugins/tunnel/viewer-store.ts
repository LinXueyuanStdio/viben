import * as fs from 'node:fs'
import * as path from 'node:path'
import { nanoid } from 'nanoid'
import { createChildLogger } from '../../core/utils/log.js'

const log = createChildLogger({ module: 'viewer-store' })

// Hard limit per entry to avoid serving multi-MB payloads over the tunnel.
const MAX_CONTENT_SIZE = 1_000_000  // 1MB

const EXTENSION_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java', '.kt': 'kotlin',
  '.rb': 'ruby', '.php': 'php', '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp',
  '.cs': 'csharp', '.swift': 'swift', '.sh': 'bash', '.zsh': 'bash', '.bash': 'bash',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.xml': 'xml', '.html': 'html', '.css': 'css', '.scss': 'scss',
  '.sql': 'sql', '.md': 'markdown', '.dockerfile': 'dockerfile',
  '.tf': 'hcl', '.vue': 'xml', '.svelte': 'xml',
}

/**
 * Metadata for a single viewer entry.
 * For `type: "diff"`, `content` holds the new text and `oldContent` holds the original.
 * For `type: "output"`, `filePath` is used as the display label (not a real file path).
 * Entries expire after the configured TTL and are cleaned up lazily on read and periodically.
 */
export interface ViewerEntry {
  id: string
  type: 'file' | 'diff' | 'output'
  filePath?: string
  content: string
  oldContent?: string
  language?: string
  sessionId: string
  workingDirectory: string
  createdAt: number
  expiresAt: number
}

/**
 * In-memory store for content shared via tunnel viewer routes.
 *
 * Agents call `storeFile()` / `storeDiff()` / `storeOutput()` to get a short URL id,
 * then pass that URL to the user. The viewer routes serve HTML pages using the stored content.
 * Content is scoped to the session's working directory to avoid leaking files outside the workspace.
 */
export class ViewerStore {
  private entries = new Map<string, ViewerEntry>()
  private cleanupTimer: ReturnType<typeof setInterval>
  private ttlMs: number

  constructor(ttlMinutes: number = 60) {
    this.ttlMs = ttlMinutes * 60 * 1000
    // Periodic cleanup prevents unbounded memory growth for long-running instances
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  storeFile(sessionId: string, filePath: string, content: string, workingDirectory: string): string | null {
    if (!this.isPathAllowed(filePath, workingDirectory)) {
      log.debug({ filePath, workingDirectory }, 'Path outside workspace, skipping viewer link')
      return null
    }
    if (content.length > MAX_CONTENT_SIZE) {
      log.debug({ filePath, size: content.length }, 'File too large for viewer')
      return null
    }

    const id = nanoid(12)
    const now = Date.now()
    this.entries.set(id, {
      id,
      type: 'file',
      filePath,
      content,
      language: this.detectLanguage(filePath),
      sessionId,
      workingDirectory,
      createdAt: now,
      expiresAt: now + this.ttlMs,
    })
    log.debug({ id, filePath }, 'Stored file for viewing')
    return id
  }

  storeDiff(sessionId: string, filePath: string, oldContent: string, newContent: string, workingDirectory: string): string | null {
    if (!this.isPathAllowed(filePath, workingDirectory)) {
      log.debug({ filePath, workingDirectory }, 'Path outside workspace, skipping viewer link')
      return null
    }
    const combined = oldContent.length + newContent.length
    if (combined > MAX_CONTENT_SIZE) {
      log.debug({ filePath, size: combined }, 'Diff content too large for viewer')
      return null
    }

    const id = nanoid(12)
    const now = Date.now()
    this.entries.set(id, {
      id,
      type: 'diff',
      filePath,
      content: newContent,
      oldContent,
      language: this.detectLanguage(filePath),
      sessionId,
      workingDirectory,
      createdAt: now,
      expiresAt: now + this.ttlMs,
    })
    log.debug({ id, filePath }, 'Stored diff for viewing')
    return id
  }

  storeOutput(sessionId: string, label: string, output: string): string | null {
    if (output.length > MAX_CONTENT_SIZE) {
      log.debug({ label, size: output.length }, 'Output too large for viewer')
      return null
    }
    const id = nanoid(12)
    const now = Date.now()
    this.entries.set(id, {
      id,
      type: 'output',
      filePath: label,
      content: output,
      language: 'text',
      sessionId,
      workingDirectory: '',
      createdAt: now,
      expiresAt: now + this.ttlMs,
    })
    log.debug({ id, label }, 'Stored output for viewing')
    return id
  }

  get(id: string): ViewerEntry | undefined {
    const entry = this.entries.get(id)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(id)
      return undefined
    }
    return entry
  }

  private cleanup(): void {
    const now = Date.now()
    let removed = 0
    for (const [id, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(id)
        removed++
      }
    }
    if (removed > 0) {
      log.debug({ removed, remaining: this.entries.size }, 'Cleaned up expired viewer entries')
    }
  }

  // Guard against agents trying to serve files outside the session workspace
  // (e.g. /etc/passwd or ~/ paths). Uses realpath to handle symlinks and canonicalize
  // case on macOS/Windows where the filesystem is case-insensitive.
  private isPathAllowed(filePath: string, workingDirectory: string): boolean {
    const caseInsensitive = process.platform === 'darwin' || process.platform === 'win32'

    // Resolve paths, using realpathSync when possible for symlink/case canonicalization
    let resolved: string
    let workspace: string
    try { resolved = fs.realpathSync(path.resolve(workingDirectory, filePath)) }
    catch { resolved = path.resolve(workingDirectory, filePath) }
    try { workspace = fs.realpathSync(path.resolve(workingDirectory)) }
    catch { workspace = path.resolve(workingDirectory) }

    // macOS/Windows have case-insensitive filesystems — always compare lowercase
    if (caseInsensitive) {
      const rLower = resolved.toLowerCase()
      const wLower = workspace.toLowerCase()
      return rLower.startsWith(wLower + path.sep) || rLower === wLower
    }
    return resolved.startsWith(workspace + path.sep) || resolved === workspace
  }

  private detectLanguage(filePath: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase()
    return EXTENSION_LANGUAGE[ext]
  }

  destroy(): void {
    clearInterval(this.cleanupTimer)
    this.entries.clear()
  }
}
