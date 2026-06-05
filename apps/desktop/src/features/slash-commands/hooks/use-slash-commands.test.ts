import { describe, expect, it } from "vitest";
import type { DesktopSlashCommand } from "../types";
import { toChatSlashCommandData } from "../slash-command-data";

describe("toChatSlashCommandData", () => {
  it("only exposes protocol slash command data to chat", async () => {
    const command: DesktopSlashCommand & { payload: Record<string, unknown> } = {
      id: "review",
      name: "review",
      description: "Review current changes",
      icon: "icon",
      category: "workspace",
      source: "builtin",
      input: { hint: "[target]" },
      args: [{ name: "target" }],
      payload: { desktopOnly: true },
      execute: async () => ({ type: "action" }),
    };

    expect(toChatSlashCommandData(command)).toEqual({
      name: "review",
      description: "Review current changes",
      input: { hint: "[target]" },
    });
  });

  it("derives an input hint from legacy args without leaking args", async () => {
    const command: DesktopSlashCommand = {
      id: "compact",
      name: "compact",
      description: "Compact history",
      category: "session",
      source: "builtin",
      args: [{ name: "instructions" }],
      execute: async () => ({ type: "action" }),
    };

    expect(toChatSlashCommandData(command)).toEqual({
      name: "compact",
      description: "Compact history",
      input: { hint: "[instructions]" },
    });
  });
});
