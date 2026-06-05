import { RegistryClient } from '../../core/plugin/registry-client.js'
import { isJsonMode, jsonSuccess, jsonError, muteForJson, ErrorCodes } from '../output.js'

/**
 * `viben plugin search` — Search the Viben plugin registry.
 * Queries the remote registry and displays matching plugins with install instructions.
 */
export async function cmdPluginSearch(args: string[]): Promise<void> {
  const json = isJsonMode(args)
  if (json) await muteForJson()

  const query = args.filter(a => a !== '--json').join(' ').trim()
  if (!query) {
    if (json) jsonError(ErrorCodes.MISSING_ARGUMENT, 'Search query is required')
    console.error('Usage: viben plugin search <query>')
    process.exit(1)
  }

  const client = new RegistryClient()

  try {
    const results = await client.search(query)

    if (json) {
      jsonSuccess({
        results: results.map(p => ({
          name: p.name,
          displayName: p.displayName ?? p.name,
          version: p.version,
          description: p.description,
          npm: p.npm,
          category: p.category,
          verified: p.verified ?? false,
          featured: p.featured ?? false,
        })),
      })
    }

    if (results.length === 0) {
      console.log(`No plugins found matching "${query}"`)
      return
    }

    console.log(`\nFound ${results.length} plugin${results.length > 1 ? 's' : ''} matching "${query}":\n`)
    for (const p of results) {
      const verified = p.verified ? ' ✓' : ''
      const featured = p.featured ? ' ⭐' : ''
      console.log(`  ${p.icon || '📦'} ${p.displayName ?? p.name}${verified}${featured}`)
      console.log(`     ${p.description}`)
      console.log(`     ${p.category} | v${p.version} | npm: ${p.npm}`)
      console.log(`     Install: viben plugin install ${p.name}`)
      console.log()
    }
  } catch (err) {
    if (json) jsonError(ErrorCodes.API_ERROR, `Failed to search registry: ${err}`)
    console.error(`Failed to search registry: ${err}`)
    process.exit(1)
  }
}
