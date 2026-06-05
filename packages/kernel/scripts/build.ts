import { mkdir, copyFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
      }
    })
  })
}

await run('tsc', [])
await mkdir(join(root, 'dist', 'data'), { recursive: true })
await copyFile(
  join(root, 'src', 'data', 'registry-snapshot.json'),
  join(root, 'dist', 'data', 'registry-snapshot.json'),
)
