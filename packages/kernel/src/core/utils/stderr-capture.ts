/**
 * Rolling buffer that captures the last N lines of an agent subprocess's stderr.
 *
 * Agent stdout carries the ACP protocol (JSON-RPC); stderr is used for
 * debug/diagnostic output. This capture provides context when the agent
 * crashes or errors — the last lines of stderr are included in error
 * messages shown to the user.
 */
export class StderrCapture {
  private lines: string[] = []

  constructor(private maxLines: number = 50) {}

  /** Append a chunk of stderr output, splitting on newlines and trimming to maxLines. */
  append(chunk: string): void {
    this.lines.push(...chunk.split('\n').filter(Boolean))
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines)
    }
  }

  /** Return all captured lines joined as a single string. */
  getLastLines(): string {
    return this.lines.join('\n')
  }
}
