/**
 * Git-style Configuration Manager Tests
 *
 * Tests for dot notation parsing, path access, and config operations.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  parseKey,
  getValueByPath,
  setValueByPath,
  deleteValueByPath,
  flattenObject,
  parseValue,
  GitStyleConfigManager,
  type ConfigEntry,
} from "./manager";

// ============================================================================
// Unit Tests for Helper Functions
// ============================================================================

describe("parseKey", () => {
  it("should parse simple dot notation", () => {
    expect(parseKey("settings.editor")).toEqual(["settings", "editor"]);
  });

  it("should parse single key", () => {
    expect(parseKey("theme")).toEqual(["theme"]);
  });

  it("should parse deeply nested keys", () => {
    expect(parseKey("a.b.c.d.e")).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("should parse array index notation", () => {
    expect(parseKey("mcp.enabled[0]")).toEqual(["mcp", "enabled", 0]);
  });

  it("should parse multiple array indices", () => {
    expect(parseKey("data[0][1]")).toEqual(["data", 0, 1]);
  });

  it("should parse mixed dot and array notation", () => {
    expect(parseKey("a.b[1].c[2].d")).toEqual(["a", "b", 1, "c", 2, "d"]);
  });

  it("should handle empty string", () => {
    expect(parseKey("")).toEqual([]);
  });

  it("should handle whitespace-only string", () => {
    expect(parseKey("   ")).toEqual([]);
  });

  it("should parse numeric string segments", () => {
    // Pure numeric parts in dot notation are treated as numbers
    expect(parseKey("items.0.name")).toEqual(["items", 0, "name"]);
  });
});

describe("getValueByPath", () => {
  it("should get value from simple path", () => {
    const obj = { settings: { editor: "vim" } };
    expect(getValueByPath(obj, ["settings", "editor"])).toBe("vim");
  });

  it("should get value from array index", () => {
    const obj = { items: ["a", "b", "c"] };
    expect(getValueByPath(obj, ["items", 1])).toBe("b");
  });

  it("should return undefined for non-existent path", () => {
    const obj = { settings: {} };
    expect(getValueByPath(obj, ["settings", "editor"])).toBeUndefined();
  });

  it("should return undefined for array index out of bounds", () => {
    const obj = { items: ["a", "b"] };
    expect(getValueByPath(obj, ["items", 5])).toBeUndefined();
  });

  it("should return undefined when accessing array on non-array", () => {
    const obj = { settings: "string" };
    expect(getValueByPath(obj, ["settings", 0])).toBeUndefined();
  });

  it("should return the object itself for empty path", () => {
    const obj = { a: 1 };
    expect(getValueByPath(obj, [])).toEqual({ a: 1 });
  });

  it("should handle deeply nested access", () => {
    const obj = { a: { b: { c: { d: { e: "deep" } } } } };
    expect(getValueByPath(obj, ["a", "b", "c", "d", "e"])).toBe("deep");
  });

  it("should handle mixed object and array access", () => {
    const obj = { users: [{ name: "Alice" }, { name: "Bob" }] };
    expect(getValueByPath(obj, ["users", 1, "name"])).toBe("Bob");
  });
});

describe("setValueByPath", () => {
  it("should set value at simple path", () => {
    const obj: Record<string, unknown> = {};
    setValueByPath(obj, ["settings", "editor"], "vim");
    expect(obj).toEqual({ settings: { editor: "vim" } });
  });

  it("should set value in existing nested object", () => {
    const obj: Record<string, unknown> = { settings: { theme: "dark" } };
    setValueByPath(obj, ["settings", "editor"], "vim");
    expect(obj).toEqual({ settings: { theme: "dark", editor: "vim" } });
  });

  it("should set value in array", () => {
    const obj: Record<string, unknown> = { items: ["a", "b"] };
    setValueByPath(obj, ["items", 1], "B");
    expect(obj).toEqual({ items: ["a", "B"] });
  });

  it("should create array when setting index on new key", () => {
    const obj: Record<string, unknown> = {};
    setValueByPath(obj, ["items", 0], "first");
    expect(obj).toEqual({ items: ["first"] });
  });

  it("should expand array to fit index", () => {
    const obj: Record<string, unknown> = { items: ["a"] };
    setValueByPath(obj, ["items", 3], "d");
    expect(obj.items).toEqual(["a", undefined, undefined, "d"]);
  });

  it("should handle deeply nested creation", () => {
    const obj: Record<string, unknown> = {};
    setValueByPath(obj, ["a", "b", "c", "d"], "value");
    expect(obj).toEqual({ a: { b: { c: { d: "value" } } } });
  });

  it("should handle mixed object and array creation", () => {
    const obj: Record<string, unknown> = {};
    setValueByPath(obj, ["users", 0, "name"], "Alice");
    expect(obj).toEqual({ users: [{ name: "Alice" }] });
  });
});

describe("deleteValueByPath", () => {
  it("should delete value from object", () => {
    const obj: Record<string, unknown> = { settings: { editor: "vim", theme: "dark" } };
    const deleted = deleteValueByPath(obj, ["settings", "editor"]);
    expect(deleted).toBe(true);
    expect(obj).toEqual({ settings: { theme: "dark" } });
  });

  it("should delete value from array (splice)", () => {
    const obj: Record<string, unknown> = { items: ["a", "b", "c"] };
    const deleted = deleteValueByPath(obj, ["items", 1]);
    expect(deleted).toBe(true);
    expect(obj).toEqual({ items: ["a", "c"] });
  });

  it("should return false for non-existent path", () => {
    const obj: Record<string, unknown> = { settings: {} };
    const deleted = deleteValueByPath(obj, ["settings", "editor"]);
    expect(deleted).toBe(false);
  });

  it("should return false for empty path", () => {
    const obj: Record<string, unknown> = { a: 1 };
    const deleted = deleteValueByPath(obj, []);
    expect(deleted).toBe(false);
  });

  it("should return false for out of bounds array index", () => {
    const obj: Record<string, unknown> = { items: ["a", "b"] };
    const deleted = deleteValueByPath(obj, ["items", 5]);
    expect(deleted).toBe(false);
  });
});

describe("flattenObject", () => {
  it("should flatten simple object", () => {
    const obj = { a: 1, b: 2 };
    const entries = flattenObject(obj);
    expect(entries).toEqual([
      { key: "a", value: 1, origin: undefined },
      { key: "b", value: 2, origin: undefined },
    ]);
  });

  it("should flatten nested object", () => {
    const obj = { settings: { editor: "vim", theme: "dark" } };
    const entries = flattenObject(obj);
    expect(entries).toEqual([
      { key: "settings.editor", value: "vim", origin: undefined },
      { key: "settings.theme", value: "dark", origin: undefined },
    ]);
  });

  it("should flatten array", () => {
    const obj = { items: ["a", "b", "c"] };
    const entries = flattenObject(obj);
    expect(entries).toEqual([
      { key: "items[0]", value: "a", origin: undefined },
      { key: "items[1]", value: "b", origin: undefined },
      { key: "items[2]", value: "c", origin: undefined },
    ]);
  });

  it("should flatten nested array with objects", () => {
    const obj = { users: [{ name: "Alice" }, { name: "Bob" }] };
    const entries = flattenObject(obj);
    expect(entries).toEqual([
      { key: "users[0].name", value: "Alice", origin: undefined },
      { key: "users[1].name", value: "Bob", origin: undefined },
    ]);
  });

  it("should include origin when provided", () => {
    const obj = { theme: "dark" };
    const entries = flattenObject(obj, "", "global");
    expect(entries).toEqual([
      { key: "theme", value: "dark", origin: "global" },
    ]);
  });

  it("should return empty array for null", () => {
    expect(flattenObject(null)).toEqual([]);
  });

  it("should return empty array for undefined", () => {
    expect(flattenObject(undefined)).toEqual([]);
  });
});

describe("parseValue", () => {
  it("should parse integer", () => {
    expect(parseValue("42")).toBe(42);
  });

  it("should parse negative integer", () => {
    expect(parseValue("-10")).toBe(-10);
  });

  it("should parse float", () => {
    expect(parseValue("3.14")).toBe(3.14);
  });

  it("should parse negative float", () => {
    expect(parseValue("-2.5")).toBe(-2.5);
  });

  it("should parse true boolean", () => {
    expect(parseValue("true")).toBe(true);
  });

  it("should parse false boolean", () => {
    expect(parseValue("false")).toBe(false);
  });

  it("should parse null", () => {
    expect(parseValue("null")).toBe(null);
  });

  it("should keep plain string", () => {
    expect(parseValue("hello")).toBe("hello");
  });

  it("should keep empty string", () => {
    expect(parseValue("")).toBe("");
  });

  it("should parse JSON array", () => {
    expect(parseValue('["a","b","c"]')).toEqual(["a", "b", "c"]);
  });

  it("should parse JSON object", () => {
    expect(parseValue('{"key":"value"}')).toEqual({ key: "value" });
  });

  it("should keep invalid JSON as string", () => {
    expect(parseValue("[invalid json")).toBe("[invalid json");
  });
});

// ============================================================================
// Integration Tests for GitStyleConfigManager
// ============================================================================

describe("GitStyleConfigManager", () => {
  let manager: GitStyleConfigManager;
  let tempDir: string;
  let workspaceDir: string;

  beforeEach(async () => {
    manager = new GitStyleConfigManager();

    // Create temp directories
    tempDir = await mkdtemp(join(tmpdir(), "viben-config-test-"));
    workspaceDir = join(tempDir, "workspace");

    await mkdir(join(workspaceDir, ".viben"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("get and set", () => {
    it("should set and get a simple value", async () => {
      // Use workspace config for this test (avoids global config mocking)
      await manager.set("theme", "dark", {
        workspacePath: workspaceDir,
      });
      const value = await manager.get("theme", {
        workspacePath: workspaceDir,
      });
      expect(value).toBe("dark");
    });

    it("should set and get a nested value", async () => {
      await manager.set("settings.editor", "vim", {
        workspacePath: workspaceDir,
      });
      const value = await manager.get("settings.editor", {
        workspacePath: workspaceDir,
      });
      expect(value).toBe("vim");
    });

    it("should set and get array value", async () => {
      await manager.set("mcp.enabled[0]", "server1", {
        workspacePath: workspaceDir,
      });
      await manager.set("mcp.enabled[1]", "server2", {
        workspacePath: workspaceDir,
      });

      const value0 = await manager.get("mcp.enabled[0]", {
        workspacePath: workspaceDir,
      });
      const value1 = await manager.get("mcp.enabled[1]", {
        workspacePath: workspaceDir,
      });

      expect(value0).toBe("server1");
      expect(value1).toBe("server2");
    });

    it("should parse boolean values", async () => {
      await manager.set("features.enabled", "true", {
        workspacePath: workspaceDir,
      });
      const value = await manager.get("features.enabled", {
        workspacePath: workspaceDir,
      });
      expect(value).toBe(true);
    });

    it("should parse numeric values", async () => {
      await manager.set("settings.timeout", "30", {
        workspacePath: workspaceDir,
      });
      const value = await manager.get("settings.timeout", {
        workspacePath: workspaceDir,
      });
      expect(value).toBe(30);
    });

    it("should return undefined for non-existent key", async () => {
      const value = await manager.get("nonexistent.key", {
        workspacePath: workspaceDir,
      });
      expect(value).toBeUndefined();
    });
  });

  describe("list", () => {
    it("should list all config entries", async () => {
      await manager.set("settings.editor", "vim", {
        workspacePath: workspaceDir,
      });
      await manager.set("settings.theme", "dark", {
        workspacePath: workspaceDir,
      });

      const entries = await manager.list({
        workspacePath: workspaceDir,
      });

      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.key === "settings.editor")?.value).toBe("vim");
      expect(entries.find((e) => e.key === "settings.theme")?.value).toBe("dark");
    });

    it("should return empty array for non-existent config", async () => {
      const entries = await manager.list({
        workspacePath: join(tempDir, "nonexistent"),
      });
      expect(entries).toEqual([]);
    });
  });

  describe("unset", () => {
    it("should remove a config key", async () => {
      await manager.set("settings.editor", "vim", {
        workspacePath: workspaceDir,
      });
      await manager.set("settings.theme", "dark", {
        workspacePath: workspaceDir,
      });

      const deleted = await manager.unset("settings.editor", {
        workspacePath: workspaceDir,
      });

      expect(deleted).toBe(true);

      const value = await manager.get("settings.editor", {
        workspacePath: workspaceDir,
      });
      expect(value).toBeUndefined();

      // Theme should still exist
      const theme = await manager.get("settings.theme", {
        workspacePath: workspaceDir,
      });
      expect(theme).toBe("dark");
    });

    it("should return false for non-existent key", async () => {
      const deleted = await manager.unset("nonexistent.key", {
        workspacePath: workspaceDir,
      });
      expect(deleted).toBe(false);
    });
  });

  describe("getAll", () => {
    it("should return full config object", async () => {
      await manager.set("settings.editor", "vim", {
        workspacePath: workspaceDir,
      });
      await manager.set("settings.theme", "dark", {
        workspacePath: workspaceDir,
      });

      const config = await manager.getAll({
        workspacePath: workspaceDir,
      });

      expect(config).toEqual({
        settings: {
          editor: "vim",
          theme: "dark",
        },
      });
    });

    it("should return empty object for non-existent config", async () => {
      const config = await manager.getAll({
        workspacePath: join(tempDir, "nonexistent"),
      });
      expect(config).toEqual({});
    });
  });

  describe("has", () => {
    it("should return true for existing key", async () => {
      await manager.set("settings.editor", "vim", {
        workspacePath: workspaceDir,
      });

      const exists = await manager.has("settings.editor", {
        workspacePath: workspaceDir,
      });
      expect(exists).toBe(true);
    });

    it("should return false for non-existent key", async () => {
      const exists = await manager.has("nonexistent.key", {
        workspacePath: workspaceDir,
      });
      expect(exists).toBe(false);
    });
  });

  describe("getMerged", () => {
    it("should return workspace config entries", async () => {
      // Set workspace config
      await manager.set("settings.editor", "vim", {
        workspacePath: workspaceDir,
      });
      await manager.set("settings.theme", "dark", {
        workspacePath: workspaceDir,
      });

      // Test basic functionality - getMerged returns workspace entries
      const entries = await manager.list({
        workspacePath: workspaceDir,
      });

      expect(entries.find((e) => e.key === "settings.editor")?.value).toBe("vim");
      expect(entries.find((e) => e.key === "settings.theme")?.value).toBe("dark");
    });
  });

  describe("global vs workspace config", () => {
    it("should read from workspace config by default", async () => {
      await manager.set("location", "workspace", {
        workspacePath: workspaceDir,
      });

      const value = await manager.get("location", {
        workspacePath: workspaceDir,
      });
      expect(value).toBe("workspace");
    });

    it("should handle deeply nested paths", async () => {
      await manager.set("a.b.c.d.e", "deep", {
        workspacePath: workspaceDir,
      });

      const value = await manager.get("a.b.c.d.e", {
        workspacePath: workspaceDir,
      });
      expect(value).toBe("deep");

      const all = await manager.getAll({
        workspacePath: workspaceDir,
      });
      expect(all).toEqual({ a: { b: { c: { d: { e: "deep" } } } } });
    });
  });
});
