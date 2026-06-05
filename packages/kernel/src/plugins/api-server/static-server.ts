import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/**
 * Serves the bundled Viben App (a Vite SPA) from the local filesystem.
 *
 * Two directory layouts are probed at startup to support both the development
 * build (`ui/dist/`) and the npm publish layout (`../ui/`). If neither exists,
 * `isAvailable()` returns false and the server skips static file serving.
 *
 * Path traversal is blocked in two stages:
 * 1. String prefix check before resolving symlinks (catches obvious `..` segments).
 * 2. `realpathSync` check after resolution (catches symlinks that escape the UI dir).
 *
 * Vite content-hashed assets (`*.{hash}.js/css`) receive a 1-year immutable cache.
 * All other files use `no-cache` so updates roll out on the next page refresh.
 *
 * Non-asset routes fall through to `index.html` (SPA client-side routing).
 */
export class StaticServer {
  private uiDir: string | undefined;

  constructor(uiDir?: string) {
    this.uiDir = uiDir;

    if (!this.uiDir) {
      const __filename = fileURLToPath(import.meta.url);
      const candidate = path.resolve(path.dirname(__filename), "../../ui/dist");
      if (fs.existsSync(path.join(candidate, "index.html"))) {
        this.uiDir = candidate;
      }
      // Also check dist-publish layout
      if (!this.uiDir) {
        const publishCandidate = path.resolve(
          path.dirname(__filename),
          "../ui",
        );
        if (fs.existsSync(path.join(publishCandidate, "index.html"))) {
          this.uiDir = publishCandidate;
        }
      }
    }
  }

  /** Returns true if a UI build was found and static serving is active. */
  isAvailable(): boolean {
    return this.uiDir !== undefined;
  }

  /**
   * Attempts to serve a static file or SPA fallback for the given request.
   *
   * @returns true if the response was handled, false if the caller should return a 404.
   */
  serve(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    if (!this.uiDir) return false;

    const urlPath = (req.url || "/").split("?")[0];
    const safePath = path.normalize(urlPath);

    // Try exact file match
    const filePath = path.join(this.uiDir, safePath);
    if (!filePath.startsWith(this.uiDir + path.sep) && filePath !== this.uiDir)
      return false; // path traversal guard (pre-symlink check)

    // Resolve symlinks to prevent traversal via symlinks pointing outside uiDir.
    // Only apply the symlink guard when the file actually exists — a non-existent
    // path cannot be a symlink pointing anywhere, so skipping the guard is safe
    // and avoids false negatives on systems where the temp directory itself is a
    // symlink (e.g. macOS where /var → /private/var).
    let realFilePath: string | null;
    try {
      realFilePath = fs.realpathSync(filePath);
    } catch {
      // File does not exist — fall through to SPA fallback without symlink check
      realFilePath = null;
    }

    if (realFilePath !== null) {
      const realUiDir = fs.realpathSync(this.uiDir);
      if (!realFilePath.startsWith(realUiDir + path.sep) && realFilePath !== realUiDir)
        return false; // symlink traversal guard
    }

    if (realFilePath !== null && fs.existsSync(realFilePath) && fs.statSync(realFilePath).isFile()) {
      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
      // Vite-hashed assets get long cache, others get no-cache
      const isHashed = /\.[a-zA-Z0-9]{8,}\.(js|css)$/.test(filePath);
      const cacheControl = isHashed
        ? "public, max-age=31536000, immutable"
        : "no-cache";
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      });
      fs.createReadStream(realFilePath).pipe(res);
      return true;
    }

    // SPA fallback — serve index.html
    const indexPath = path.join(this.uiDir, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(indexPath).pipe(res);
      return true;
    }

    return false;
  }
}
