import fs from "node:fs";

/**
 * Read a text file, optionally returning only a range of lines.
 *
 * The `line` and `limit` options enable partial file reads — used by the
 * file-service plugin when agents request specific line ranges (e.g.,
 * "read lines 50-100 of config.ts"). This avoids sending entire large
 * files over the ACP protocol when the agent only needs a slice.
 */
export async function readTextFileWithRange(
  filePath: string,
  options?: { line?: number; limit?: number },
): Promise<string> {
  const content = await fs.promises.readFile(filePath, "utf-8");
  if (!options?.line && !options?.limit) return content;
  const lines = content.split("\n");
  // ACP line numbers are 1-based; array indices are 0-based
  const start = Math.max(0, (options.line ?? 1) - 1);
  const end = options.limit ? start + options.limit : lines.length;
  return lines.slice(start, end).join("\n");
}
