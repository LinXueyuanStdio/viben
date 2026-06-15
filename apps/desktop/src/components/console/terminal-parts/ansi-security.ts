// biome-ignore lint/suspicious/noControlCharactersInRegex: deliberately matching control chars
const OSC_RE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: deliberately matching control chars
const CSI_RE = /\x1b\[[\d;?]*[A-Za-z@~]/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: deliberately matching control chars
const ESC_OTHER_RE = /\x1b[@-_]/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: deliberately matching control chars
const C0_C1_RE = /[\x00-\x08\x0B-\x1F\x7F]/g;

export function stripAnsi(text: string): string {
  return text
    .replace(OSC_RE, "")
    .replace(CSI_RE, "")
    .replace(ESC_OTHER_RE, "")
    .replace(C0_C1_RE, "");
}

export function formatForTerminal(text: string): string {
  return text.replace(/\t/g, "  ").replace(/\r?\n/g, "\r\n");
}
