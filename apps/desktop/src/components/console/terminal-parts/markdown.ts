const BOLD = "\x1b[1m";
const ITALIC = "\x1b[3m";
const UNDERLINE = "\x1b[4m";
const CYAN = "\x1b[38;2;10;197;179m";
const RESET = "\x1b[0m";

export function formatMarkdown(text: string): string {
  let result = text;

  // Headers: # Header, ## Header, ### Header
  result = result.replace(/^(#{1,3})\s+(.+)$/gm, (_, hashes, content) => {
    return `${hashes} ${BOLD}${CYAN}${content}${RESET}`;
  });

  // Bold: **text** or __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, content) => {
    return `**${BOLD}${content}${RESET}**`;
  });
  result = result.replace(/__([^_]+)__/g, (_, content) => {
    return `__${BOLD}${content}${RESET}__`;
  });

  // Italic: *text* or _text_
  result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, content) => {
    return `*${ITALIC}${content}${RESET}*`;
  });
  result = result.replace(/(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])/g, (_, content) => {
    return `_${ITALIC}${content}${RESET}_`;
  });

  // Inline code: `code`
  result = result.replace(/`([^`\n]+)`/g, (match) => {
    return `${CYAN}${match}${RESET}`;
  });

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, linkText, url) => {
    return `[${linkText}](${UNDERLINE}${CYAN}${url}${RESET})`;
  });

  // Bullet points: - item or * item
  result = result.replace(/^(\s*[-*])\s+/gm, (_, bullet) => {
    return `${CYAN}${bullet}${RESET} `;
  });

  // Numbered lists: 1. item
  result = result.replace(/^(\s*\d+\.)\s+/gm, (_, num) => {
    return `${CYAN}${num}${RESET} `;
  });

  return result;
}

export function colorizeUrls(text: string): string {
  return text.replace(/(https?:\/\/[^\s]+)/g, `${CYAN}${UNDERLINE}$1${RESET}`);
}
