import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  InputHistoryService,
  createInputHistoryEntry,
} from "./input-history";

describe("InputHistoryService", () => {
  let tempDir: string;
  let service: InputHistoryService;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "viben-input-history-test-"));
    service = new InputHistoryService(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("appends non-empty input entries to input_history.jsonl", async () => {
    await service.addEntry(createInputHistoryEntry("first prompt", { source: "desktop_acp_chat" }));
    await service.addEntry(createInputHistoryEntry("second prompt", { source: "desktop_acp_chat" }));

    const historyPath = join(tempDir, "input_history.jsonl");
    expect(existsSync(historyPath)).toBe(true);

    const raw = await readFile(historyPath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toMatchObject({
      text: "first prompt",
      source: "desktop_acp_chat",
    });
    expect(JSON.parse(lines[1])).toMatchObject({
      text: "second prompt",
      source: "desktop_acp_chat",
    });
  });

  it("reads entries in append order while ignoring invalid and empty lines", async () => {
    await writeFile(
      join(tempDir, "input_history.jsonl"),
      [
        JSON.stringify(createInputHistoryEntry("first prompt")),
        "not json",
        JSON.stringify(createInputHistoryEntry("   ")),
        JSON.stringify(createInputHistoryEntry("second prompt")),
        "",
      ].join("\n"),
      "utf-8"
    );

    await expect(service.listEntries()).resolves.toEqual([
      expect.objectContaining({ text: "first prompt" }),
      expect.objectContaining({ text: "second prompt" }),
    ]);
  });

  it("returns recent input text values oldest-to-newest within the limit", async () => {
    await service.addEntry(createInputHistoryEntry("first"));
    await service.addEntry(createInputHistoryEntry("second"));
    await service.addEntry(createInputHistoryEntry("third"));

    await expect(service.listText({ limit: 2 })).resolves.toEqual(["second", "third"]);
  });

  it("does not create a file for blank input", async () => {
    await service.addEntry(createInputHistoryEntry("   "));

    expect(existsSync(join(tempDir, "input_history.jsonl"))).toBe(false);
  });
});
