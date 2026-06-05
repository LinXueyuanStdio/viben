import { describe, expect, test, vi } from "vitest";
import {
  filterSlashCommands,
  findSlashCommand,
  mergeSlashCommands,
  parseSlashCommandInput,
} from "../slash-commands";
import type { SlashCommandDefinition } from "../slash-commands";

describe("slash command utilities", () => {
  test("parses slash command input without prescribing args shape", () => {
    expect(parseSlashCommandInput("/review src/app.tsx --quick")).toEqual({
      name: "review",
      args: "src/app.tsx --quick",
    });
    expect(parseSlashCommandInput("plain text")).toBeNull();
  });

  test("filters commands by name, description, keywords, group, and source", () => {
    const commands = [
      { id: "1", name: "review", description: "Review code", keywords: ["diff"] },
      { id: "2", name: "status", description: "Show details", group: "session" },
      { id: "3", name: "skill:test", source: "skill" },
    ];

    expect(filterSlashCommands(commands, "diff").map((command) => command.name)).toEqual(["review"]);
    expect(filterSlashCommands(commands, "session").map((command) => command.name)).toEqual(["status"]);
    expect(filterSlashCommands(commands, "skill").map((command) => command.name)).toEqual(["skill:test"]);
  });

  test("merges commands by name with later lists taking priority", () => {
    const merged = mergeSlashCommands([
      [{ id: "workspace-clear", name: "clear" }],
      [{ id: "builtin-clear", name: "clear" }],
    ]);

    expect(merged).toEqual([{ id: "builtin-clear", name: "clear" }]);
  });

  test("supports custom context and custom result types", async () => {
    interface CustomContext {
      send: (value: string) => void;
    }
    type CustomResult = { handled: true; value: string };

    const send = vi.fn();
    const command: SlashCommandDefinition<CustomContext, CustomResult> = {
      id: "custom",
      name: "custom",
      execute: async (context, args) => {
        context.send(args);
        return { handled: true, value: args };
      },
    };

    const result = await command.execute?.({ send }, "anything the host wants", command);

    expect(findSlashCommand([command], "custom")).toBe(command);
    expect(send).toHaveBeenCalledWith("anything the host wants");
    expect(result).toEqual({ handled: true, value: "anything the host wants" });
  });
});
