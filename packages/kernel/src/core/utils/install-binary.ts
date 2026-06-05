import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import { createChildLogger } from './log.js'
import { commandExists } from '../agents/agent-dependencies.js'
import { MAX_DOWNLOAD_SIZE, validateTarContents } from '../agents/agent-installer.js'

const log = createChildLogger({ module: 'binary-installer' })

const DEFAULT_BIN_DIR = path.join(os.homedir(), '.viben', 'bin')
const IS_WINDOWS = os.platform() === 'win32'

/**
 * Specification for a binary that can be auto-downloaded from GitHub releases.
 *
 * Used by ensureBinary() to resolve the correct download URL for the
 * current platform/architecture and handle archive extraction if needed.
 */
export interface BinarySpec {
  name: string
  /** GitHub base URL for releases, e.g. "https://github.com/jqlang/jq/releases/latest/download" */
  githubBaseUrl: string
  /** Platform → arch → filename mapping */
  platforms: Record<string, Record<string, string>>
  /** If true, downloaded file is a .tgz archive that needs extraction */
  isArchive?: (url: string) => boolean
}

/**
 * Download a file via HTTPS with redirect following and size limit enforcement.
 *
 * Cleans up partial downloads on failure to avoid leaving corrupt files.
 */
function downloadFile(url: string, dest: string, maxRedirects = 10): Promise<string> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)

    const cleanup = () => {
      try { if (fs.existsSync(dest)) fs.unlinkSync(dest) } catch { /* ignore */ }
    }

    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        if (maxRedirects <= 0) {
          file.close(() => {
            cleanup()
            reject(new Error('Too many redirects'))
          })
          return
        }
        file.close(() => {
          cleanup()
          downloadFile(response.headers.location!, dest, maxRedirects - 1).then(resolve).catch(reject)
        })
        return
      }

      if (response.statusCode !== 200) {
        file.close(() => {
          cleanup()
          reject(new Error(`Download failed with status ${response.statusCode}`))
        })
        return
      }

      // Enforce size limit to prevent malicious or oversized downloads
      let totalBytes = 0
      const request = response

      response.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length
        if (totalBytes > MAX_DOWNLOAD_SIZE) {
          request.destroy()
          file.close(() => {
            cleanup()
            reject(new Error(`Download exceeds size limit of ${MAX_DOWNLOAD_SIZE} bytes`))
          })
        }
      })

      response.pipe(file)
      file.on('finish', () => file.close(() => resolve(dest)))
      file.on('error', (err) => {
        file.close(() => {
          cleanup()
          reject(err)
        })
      })
    }).on('error', (err) => {
      file.close(() => {
        cleanup()
        reject(err)
      })
    })
  })
}

/** Resolve the download URL for the current platform and architecture. */
function getDownloadUrl(spec: BinarySpec): string {
  const platform = os.platform()
  const arch = os.arch()
  const mapping = spec.platforms[platform]
  if (!mapping) throw new Error(`${spec.name}: unsupported platform ${platform}`)
  const binary = mapping[arch]
  if (!binary) throw new Error(`${spec.name}: unsupported architecture ${arch} for ${platform}`)
  return `${spec.githubBaseUrl}/${binary}`
}

/**
 * Ensure a binary is available, downloading it from GitHub if needed.
 *
 * Resolution order:
 *   1. System PATH — respects user's existing install
 *   2. ~/.viben/bin/ — previously downloaded by Viben
 *   3. Download from GitHub releases — fetch, verify, extract if needed
 *
 * For archives (.tgz), tar contents are validated before extraction
 * to prevent path traversal attacks.
 */
export async function ensureBinary(spec: BinarySpec, binDir?: string): Promise<string> {
  const resolvedBinDir = binDir ?? DEFAULT_BIN_DIR
  const binName = IS_WINDOWS ? `${spec.name}.exe` : spec.name
  const binPath = path.join(resolvedBinDir, binName)

  // 1. Check PATH first
  if (commandExists(spec.name)) {
    log.debug({ name: spec.name }, 'Found in PATH')
    return spec.name
  }

  // 2. Check our bin directory
  if (fs.existsSync(binPath)) {
    if (!IS_WINDOWS) fs.chmodSync(binPath, '755')
    log.debug({ name: spec.name, path: binPath }, 'Found in ~/.viben/bin')
    return binPath
  }

  // 3. Download
  log.info({ name: spec.name }, 'Not found, downloading from GitHub...')
  fs.mkdirSync(resolvedBinDir, { recursive: true })

  const url = getDownloadUrl(spec)
  const isArchive = spec.isArchive?.(url) ?? false
  const downloadDest = isArchive ? path.join(resolvedBinDir, `${spec.name}.tgz`) : binPath

  await downloadFile(url, downloadDest)

  if (isArchive) {
    // Validate tar contents before extraction to prevent path traversal
    const listing = execFileSync('tar', ['-tf', downloadDest], { stdio: 'pipe' })
      .toString().trim().split("\n").filter(Boolean);
    validateTarContents(listing, resolvedBinDir);
    execFileSync('tar', ['-xzf', downloadDest, '-C', resolvedBinDir], { stdio: 'pipe' })
    try { fs.unlinkSync(downloadDest) } catch { /* ignore */ }
  }

  // Validate the binary was actually produced
  if (!fs.existsSync(binPath)) {
    throw new Error(`${spec.name}: binary not found at ${binPath} after download/extraction. The archive structure may have changed.`)
  }

  if (!IS_WINDOWS) {
    fs.chmodSync(binPath, '755')
  }

  log.info({ name: spec.name, path: binPath }, 'Installed successfully')
  return binPath
}
