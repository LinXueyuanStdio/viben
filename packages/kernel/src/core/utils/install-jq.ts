import { ensureBinary, type BinarySpec } from './install-binary.js'

/** Platform/arch mapping for jq binary downloads from GitHub releases. */
const JQ_SPEC: BinarySpec = {
  name: 'jq',
  githubBaseUrl: 'https://github.com/jqlang/jq/releases/latest/download',
  platforms: {
    darwin: {
      x64: 'jq-macos-amd64',
      arm64: 'jq-macos-arm64',
    },
    win32: {
      x64: 'jq-windows-amd64.exe',
    },
    linux: {
      x64: 'jq-linux-amd64',
      arm64: 'jq-linux-arm64',
    },
  },
}

/**
 * Ensure jq is available, downloading from GitHub releases if not found.
 *
 * jq is used for JSON processing in agent tool output parsing.
 * Delegates to ensureBinary() which checks PATH, then ~/.viben/bin/,
 * then downloads if needed.
 */
export async function ensureJq(): Promise<string> {
  return ensureBinary(JQ_SPEC)
}
