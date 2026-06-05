import { describe, expect, test } from "vitest";
import {
  filterSlashCommands,
  findSlashCommand,
  mergeSlashCommands,
  parseSlashCommandInput,
} from "../slash-commands";

describe("slash command utilities", () => {
  test("parses slash command input without prescribing args shape", () => {
    expect(parseSlashCommandInput("/review src/app.tsx --quick")).toEqual({
      name: "review",
      args: "src/app.tsx --quick",
    });
    expect(parseSlashCommandInput("plain text")).toBeNull();
  });

  test("filters commands by name and description", () => {
    const commands = [
      { name: "review", description: "Review code", input: null },
      { name: "status", description: "Show session details", input: null },
      { name: "skill:test", description: "Run a skill", input: { hint: "" } },
    ];

    expect(filterSlashCommands(commands, "review").map((command) => command.name)).toEqual(["review"]);
    expect(filterSlashCommands(commands, "session").map((command) => command.name)).toEqual(["status"]);
    expect(filterSlashCommands(commands, "skill").map((command) => command.name)).toEqual(["skill:test"]);
  });

  test("merges commands by name with later lists taking priority", () => {
    const merged = mergeSlashCommands([
      [{ name: "clear", description: "Workspace clear", input: null }],
      [{ name: "clear", description: "Builtin clear", input: null }],
    ]);

    expect(merged).toEqual([{ name: "clear", description: "Builtin clear", input: null }]);
  });

  test("finds commands by name", () => {
    const command = {
      name: "custom",
      description: "Host command",
      input: { hint: "[target]" },
    };

    expect(findSlashCommand([command], "custom")).toBe(command);
    expect(filterSlashCommands([command], "target")).toEqual([]);
  });
});
