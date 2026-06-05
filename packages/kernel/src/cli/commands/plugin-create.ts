import * as p from '@clack/prompts'
import fs from 'node:fs'
import path from 'node:path'
import { getCurrentVersion } from '../version.js'
import {
  type TemplateParams,
  generatePackageJson,
  generateTsconfig,
  generateGitignore,
  generateNpmignore,
  generateEditorconfig,
  generateReadme,
  generatePluginSource,
  generatePluginTest,
  generateClaudeMd,
  generatePluginGuide,
} from '../plugin-template/index.js'

const VALID_LICENSES = ['MIT', 'Apache-2.0', 'ISC', 'UNLICENSED']
const NAME_REGEX = /^(@[a-z0-9-]+\/)?[a-z0-9-]+$/

function parseCreateArgs(args: string[]): { name?: string; description?: string; author?: string; license?: string; dir?: string } {
  const parsed: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]
    if ((arg === '--name' || arg === '-n') && next) { parsed.name = next; i++ }
    else if ((arg === '--description' || arg === '-d') && next) { parsed.description = next; i++ }
    else if ((arg === '--author' || arg === '-a') && next) { parsed.author = next; i++ }
    else if ((arg === '--license' || arg === '-l') && next) { parsed.license = next; i++ }
    else if ((arg === '--output' || arg === '-o') && next) { parsed.dir = next; i++ }
    else if (!arg.startsWith('-') && !parsed.name) { parsed.name = arg } // positional: first non-flag = name
  }
  return parsed
}

/**
 * Re-extract --name from process.argv for plugin create.
 *
 * The top-level extractInstanceFlags() in cli.ts consumes --name as a workspace flag,
 * so by the time cmdPluginCreate receives args it is already stripped. We walk
 * process.argv directly after the 'create' token to recover it.
 */
function recoverNameFromProcessArgs(): string | undefined {
  const argv = process.argv
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === 'create') {
      // Look for --name or -n after 'create'
      for (let j = i + 1; j < argv.length; j++) {
        if ((argv[j] === '--name' || argv[j] === '-n') && argv[j + 1]) return argv[j + 1]
        if (!argv[j]!.startsWith('-') && j === i + 1) return argv[j] // positional right after create
      }
    }
  }
  return undefined
}

/**
 * `viben plugin create` — Scaffold a new Viben plugin project.
 *
 * Interactive mode: prompts for name, description, author, and license via @clack/prompts.
 * Non-interactive mode: accepts --name (required) and optional --description, --author,
 * --license, --output flags.
 *
 * Generates: package.json, tsconfig.json, src/index.ts, test file, CLAUDE.md,
 * PLUGIN_GUIDE.md, README.md, and standard dotfiles.
 */
export async function cmdPluginCreate(args: string[] = []): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
\x1b[1mviben plugin create\x1b[0m — Scaffold a new plugin project

\x1b[1mUsage:\x1b[0m
  viben plugin create                              Interactive mode
  viben plugin create --name <name> [options]      Non-interactive mode

\x1b[1mOptions:\x1b[0m
  -n, --name <name>            Plugin name (e.g., @myorg/my-plugin) [required]
  -d, --description <desc>     Short description
  -a, --author <author>        Author name and email
  -l, --license <license>      License: MIT, Apache-2.0, ISC, UNLICENSED (default: MIT)
  -o, --output <path>           Target directory (default: ./<plugin-name>)
  -h, --help                   Show this help message

\x1b[1mExamples:\x1b[0m
  viben plugin create
  viben plugin create --name @myorg/my-plugin --description "My plugin" --license MIT
  viben plugin create -n my-plugin -d "My plugin" -o ./plugins/my-plugin
`)
    return
  }

  const cliArgs = parseCreateArgs(args)
  // --name is consumed by top-level extractInstanceFlags(), recover from process.argv
  if (!cliArgs.name) cliArgs.name = recoverNameFromProcessArgs()

  let pluginName: string
  let description: string
  let author: string
  let license: string

  if (cliArgs.name) {
    // Non-interactive: validate provided args, prompt only for missing required fields
    if (!NAME_REGEX.test(cliArgs.name)) {
      console.error('Error: invalid plugin name. Must be a valid npm package name (lowercase, hyphens, optional @scope/)')
      process.exit(1)
    }
    if (cliArgs.license && !VALID_LICENSES.includes(cliArgs.license)) {
      console.error(`Error: invalid license. Must be one of: ${VALID_LICENSES.join(', ')}`)
      process.exit(1)
    }
    pluginName = cliArgs.name
    description = cliArgs.description ?? ''
    author = cliArgs.author ?? ''
    license = cliArgs.license ?? 'MIT'
  } else {
    // Interactive mode
    p.intro('Create a new Viben plugin')

    const result = await p.group(
      {
        name: () =>
          p.text({
            message: 'Plugin name (e.g., @myorg/adapter-matrix)',
            placeholder: '@myorg/my-plugin',
            validate: (value: string | undefined) => {
              if (!value || !value.trim()) return 'Plugin name is required'
              if (!NAME_REGEX.test(value.trim())) {
                return 'Must be a valid npm package name (lowercase, hyphens, optional @scope/)'
              }
              return undefined
            },
          }),
        description: () =>
          p.text({
            message: 'Description',
            placeholder: 'A short description of your plugin',
          }),
        author: () =>
          p.text({
            message: 'Author',
            placeholder: 'Your Name <email@example.com>',
          }),
        license: () =>
          p.select({
            message: 'License',
            options: [
              { value: 'MIT', label: 'MIT' },
              { value: 'Apache-2.0', label: 'Apache 2.0' },
              { value: 'ISC', label: 'ISC' },
              { value: 'UNLICENSED', label: 'Unlicensed (private)' },
            ],
          }),
      },
      {
        onCancel: () => {
          p.cancel('Plugin creation cancelled.')
          process.exit(0)
        },
      },
    )

    pluginName = (result.name as string).trim()
    description = (result.description as string) || ''
    author = (result.author as string) || ''
    license = result.license as string
  }

  const isInteractive = !cliArgs.name
  const dirName = pluginName.replace(/^@[^/]+\//, '') // strip scope for directory name
  const targetDir = cliArgs.dir ? path.resolve(process.cwd(), cliArgs.dir) : path.resolve(process.cwd(), dirName)

  if (fs.existsSync(targetDir)) {
    if (isInteractive) {
      p.cancel(`Directory "${cliArgs.dir ?? dirName}" already exists.`)
    } else {
      console.error(`Error: directory "${cliArgs.dir ?? dirName}" already exists.`)
    }
    process.exit(1)
  }

  const spinner = isInteractive ? p.spinner() : null
  if (spinner) spinner.start('Scaffolding plugin...')

  // Create directory structure
  fs.mkdirSync(path.join(targetDir, 'src', '__tests__'), { recursive: true })

  // Collect template params
  const params: TemplateParams = {
    pluginName,
    description,
    author,
    license,
    cliVersion: getCurrentVersion(),
  }

  // Generate and write all files
  const files: Array<{ relativePath: string; content: string }> = [
    { relativePath: 'package.json', content: generatePackageJson(params) },
    { relativePath: 'tsconfig.json', content: generateTsconfig() },
    { relativePath: '.gitignore', content: generateGitignore() },
    { relativePath: '.npmignore', content: generateNpmignore() },
    { relativePath: '.editorconfig', content: generateEditorconfig() },
    { relativePath: 'README.md', content: generateReadme(params) },
    { relativePath: 'CLAUDE.md', content: generateClaudeMd(params) },
    { relativePath: 'PLUGIN_GUIDE.md', content: generatePluginGuide(params) },
    { relativePath: path.join('src', 'index.ts'), content: generatePluginSource(params) },
    { relativePath: path.join('src', '__tests__', 'index.test.ts'), content: generatePluginTest(params) },
  ]

  for (const file of files) {
    fs.writeFileSync(path.join(targetDir, file.relativePath), file.content)
  }

  if (spinner) {
    spinner.stop('Plugin scaffolded!')
  }

  const displayDir = cliArgs.dir ?? `./${dirName}`
  if (isInteractive) {
    p.note(
      [
        `cd ${displayDir}`,
        'npm install',
        'npm run build',
        'npm test',
        '',
        '# Start development with hot-reload:',
        `viben dev .`,
      ].join('\n'),
      'Next steps',
    )
    p.outro(`Plugin ${pluginName} created in ${displayDir}`)
  } else {
    console.log(`✅ Plugin ${pluginName} created in ${displayDir}`)
  }
}
