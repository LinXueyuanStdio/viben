/** A single option in the interactive menu. */
export interface MenuOption {
  /** Single character key the user presses to select this option. */
  key: string
  label: string
  action: () => Promise<void> | void
}

// Strip ANSI escape codes to compute the visual width of a string for column alignment.
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}

/**
 * Display a single-keypress menu on TTY and wait for the user to choose an option.
 *
 * Uses raw mode (`setRawMode(true)`) to read individual keystrokes without requiring Enter.
 * Options are displayed in two columns for compact layout. Ctrl+C exits the process.
 * Returns true if a menu was shown and an option was selected, false if non-TTY (allows
 * callers to fall back to a plain text hint for piped/scripted contexts).
 */
export function showInteractiveMenu(options: MenuOption[]): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return Promise.resolve(false)
  }

  // Print options in two columns: first half on the left, second half on the right
  const half = Math.ceil(options.length / 2)
  for (let i = 0; i < half; i++) {
    const left = options[i]!
    const right = options[i + half]
    const leftStr = `  \x1b[1m[${left.key}]\x1b[0m ${left.label}`
    if (right) {
      const rightStr = `\x1b[1m[${right.key}]\x1b[0m ${right.label}`
      const visualLen = stripAnsi(leftStr).length
      const padding = Math.max(34 - visualLen, 2)
      console.log(`${leftStr}${' '.repeat(padding)}${rightStr}`)
    } else {
      console.log(leftStr)
    }
  }
  console.log('')

  return new Promise((resolve) => {
    process.stdin.setRawMode(true)
    process.stdin.resume()

    const onData = async (buf: Buffer) => {
      const ch = buf.toString().toLowerCase()

      // Handle Ctrl+C — restore terminal state before exiting
      if (ch === '\x03') {
        cleanup()
        process.exit(0)
      }

      const option = options.find(o => o.key === ch)
      if (option) {
        cleanup()
        console.log('')
        try {
          await option.action()
        } catch (err) {
          console.error(err)
          process.exit(1)
        }
        resolve(true)
      }
      // Ignore unrecognized keys
    }

    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }

    process.stdin.on('data', onData)
  })
}
