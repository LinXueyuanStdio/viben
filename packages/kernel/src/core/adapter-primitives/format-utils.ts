/** Renders a text-based progress bar (e.g., "▓▓▓▓░░░░░░") for token usage display. */
export function progressBar(ratio: number, length = 10): string {
  const filled = Math.round(Math.min(ratio, 1) * length);
  return "▓".repeat(filled) + "░".repeat(length - filled);
}

/** Formats a token count with SI suffixes (e.g., 1500 -> "1.5k", 2000000 -> "2M"). */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${parseFloat(m.toFixed(1))}M`;
  }
  if (n >= 1000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${k}k` : `${parseFloat(k.toFixed(1))}k`;
  }
  return String(n);
}

/** Strips markdown code fences (```lang ... ```) from text, leaving only the content. */
export function stripCodeFences(text: string): string {
  return text
    .replace(/```\w*\n?/g, "")
    .replace(/```$/gm, "")
    .trim();
}

/** Truncates text to maxLen characters, appending a truncation marker if cut. */
export function truncateContent(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "\n… (truncated)";
}

/**
 * Splits a long message into chunks that fit within maxLength.
 *
 * Splitting strategy:
 * 1. Prefer paragraph boundaries (\n\n), then line boundaries (\n)
 * 2. If remaining text is only slightly over the limit (< 1.3x), split
 *    near the midpoint to avoid leaving a tiny trailing chunk
 * 3. Avoid splitting inside markdown code fences — extend past the closing
 *    fence if it doesn't exceed 2x maxLength
 */
export function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // If splitting would leave a very small trailing chunk, split closer
    // to the middle to produce two balanced chunks instead.
    const wouldLeaveSmall = remaining.length < maxLength * 1.3;
    const searchLimit = wouldLeaveSmall
      ? Math.floor(remaining.length / 2) + 300
      : maxLength;

    // Find the best split point: paragraph > line > hard limit
    const threshold = maxLength * 0.2;
    let splitAt = remaining.lastIndexOf("\n\n", searchLimit);
    if (splitAt === -1 || splitAt < threshold) {
      splitAt = remaining.lastIndexOf("\n", searchLimit);
    }
    if (splitAt === -1 || splitAt < threshold) {
      splitAt = searchLimit;
    }

    // If we'd split inside an open code fence, extend to include the closing fence
    const candidate = remaining.slice(0, splitAt);
    const fences = candidate.match(/```/g);
    if (fences && fences.length % 2 !== 0) {
      const closingFence = remaining.indexOf("```", splitAt);
      if (closingFence !== -1) {
        const afterFence = remaining.indexOf("\n", closingFence + 3);
        const fenceSplit =
          afterFence !== -1 ? afterFence + 1 : closingFence + 3;
        if (fenceSplit <= maxLength * 2) {
          splitAt = fenceSplit;
        }
      }
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).replace(/^\n+/, "");
  }
  return chunks;
}
