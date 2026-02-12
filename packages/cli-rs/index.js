// @ts-check
const { existsSync } = require('fs')
const { join } = require('path')

let nativeBinding = null
let loadError = null

// Try to load the local .node file first
const localNodeFile = join(__dirname, 'index.node')
if (existsSync(localNodeFile)) {
  try {
    nativeBinding = require('./index.node')
  } catch (e) {
    loadError = e
  }
}

// If local file doesn't exist, try platform-specific package
if (!nativeBinding) {
  const { platform, arch } = process

  switch (platform) {
    case 'darwin':
      switch (arch) {
        case 'x64':
          try {
            nativeBinding = require('./viben-core.darwin-x64.node')
          } catch (e) {
            loadError = e
          }
          break
        case 'arm64':
          try {
            nativeBinding = require('./viben-core.darwin-arm64.node')
          } catch (e) {
            loadError = e
          }
          break
        default:
          throw new Error(`Unsupported architecture on macOS: ${arch}`)
      }
      break
    case 'linux':
      switch (arch) {
        case 'x64':
          try {
            nativeBinding = require('./viben-core.linux-x64-gnu.node')
          } catch (e) {
            loadError = e
          }
          break
        case 'arm64':
          try {
            nativeBinding = require('./viben-core.linux-arm64-gnu.node')
          } catch (e) {
            loadError = e
          }
          break
        default:
          throw new Error(`Unsupported architecture on Linux: ${arch}`)
      }
      break
    case 'win32':
      switch (arch) {
        case 'x64':
          try {
            nativeBinding = require('./viben-core.win32-x64-msvc.node')
          } catch (e) {
            loadError = e
          }
          break
        default:
          throw new Error(`Unsupported architecture on Windows: ${arch}`)
      }
      break
    default:
      throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`)
  }
}

if (!nativeBinding) {
  if (loadError) {
    throw loadError
  }
  throw new Error(`Failed to load native binding`)
}

// Export all functions from native binding
module.exports = nativeBinding
