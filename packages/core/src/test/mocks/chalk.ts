/**
 * Shared chalk mock for tests
 *
 * Usage:
 * ```ts
 * vi.mock("chalk", () => chalkMock);
 * ```
 */

const identity = (s: string) => s;

const chalkColors = [
  "bold",
  "green",
  "yellow",
  "red",
  "gray",
  "cyan",
  "blue",
  "dim",
  "white",
  "magenta",
  "underline",
  "italic",
  "strikethrough",
  "inverse",
  "hidden",
  "visible",
  "reset",
  "bgRed",
  "bgGreen",
  "bgYellow",
  "bgBlue",
  "bgMagenta",
  "bgCyan",
  "bgWhite",
] as const;

export const chalkMock = {
  default: Object.fromEntries(chalkColors.map((k) => [k, identity])) as Record<
    (typeof chalkColors)[number],
    typeof identity
  >,
};
