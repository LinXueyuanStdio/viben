import { isJsonMode, jsonSuccess, muteForJson } from '../output.js'

/** `viben --version` / `viben -v` — Print the current CLI version. */
export async function cmdVersion(args: string[] = []): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const { getCurrentVersion } = await import('../version.js')
  const version = getCurrentVersion()

  if (json) {
    jsonSuccess({ version })
  }

  console.log(`viben v${version}`)
}
