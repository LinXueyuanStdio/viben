import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

describe("built-in SDK MCP servers", () => {
  it("use static zod imports so ESM bundles do not emit dynamic require calls", async () => {
    const serverFiles = ["presentation.ts", "gui-action.ts"];

    for (const file of serverFiles) {
      const source = await readFile(resolve(currentDir, file), "utf-8");

      expect(source).not.toContain('require("zod")');
      expect(source).not.toContain("require('zod')");
      expect(source).toMatch(/import \{ z \} from ["']zod["'];/);
    }
  });
});
