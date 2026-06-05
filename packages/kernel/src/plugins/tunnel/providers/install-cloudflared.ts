import { ensureBinary, type BinarySpec } from '../../../core/utils/install-binary.js'

// cloudflared is not available on all systems via a package manager, and
// users of the Viben managed tunnel provider don't need to install it themselves.
// We download the official prebuilt binary from GitHub Releases on first use
// and cache it in the plugin's bin directory.
export const CLOUDFLARED_SPEC: BinarySpec = {
  name: 'cloudflared',
  githubBaseUrl: 'https://github.com/cloudflare/cloudflared/releases/latest/download',
  platforms: {
    darwin: {
      x64: 'cloudflared-darwin-amd64.tgz',
      arm64: 'cloudflared-darwin-arm64.tgz',
    },
    win32: {
      x64: 'cloudflared-windows-amd64.exe',
    },
    linux: {
      x64: 'cloudflared-linux-amd64',
      arm64: 'cloudflared-linux-arm64',
    },
  },
  isArchive: (url) => url.endsWith('.tgz'),
}

/**
 * Ensure the cloudflared binary is available, downloading it if needed.
 * Returns the path to the binary.
 */
export async function ensureCloudflared(): Promise<string> {
  return ensureBinary(CLOUDFLARED_SPEC)
}
