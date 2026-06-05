import { describe, it, expect } from "vitest";
import { cleanSystemTags, isSkillPrompt, isNoiseMessage } from "../entire/message-cleaner.js";

describe("MessageCleaner", () => {
  describe("cleanSystemTags", () => {
    it("strips system-reminder tags", () => {
      const input = "<system-reminder>some system text</system-reminder>Hello user";
      expect(cleanSystemTags(input)).toBe("Hello user");
    });

    it("strips ide_selection tags", () => {
      const input = "<ide_selection>The user selected lines 1-10</ide_selection>Fix this bug";
      expect(cleanSystemTags(input)).toBe("Fix this bug");
    });

    it("strips ide_opened_file tags", () => {
      const input = "<ide_opened_file>User opened foo.ts</ide_opened_file>Check this";
      expect(cleanSystemTags(input)).toBe("Check this");
    });

    it("strips task-notification tags", () => {
      const input = "<task-notification><task-id>abc</task-id></task-notification>Continue";
      expect(cleanSystemTags(input)).toBe("Continue");
    });

    it("extracts command-args as user input", () => {
      const input = '<command-name>/brainstorm</command-name><command-args>fix the login bug</command-args>';
      expect(cleanSystemTags(input)).toBe("fix the login bug");
    });

    it("preserves code/JSX tags", () => {
      const input = "Check this component <Badge variant='pill'>Skill</Badge>";
      expect(cleanSystemTags(input)).toBe("Check this component <Badge variant='pill'>Skill</Badge>");
    });

    it("preserves TypeScript generics", () => {
      const input = "Type Map<string, T> is wrong";
      expect(cleanSystemTags(input)).toBe("Type Map<string, T> is wrong");
    });

    it("handles multiple system tags", () => {
      const input = "<system-reminder>x</system-reminder><local-command-caveat>y</local-command-caveat>Real text";
      expect(cleanSystemTags(input)).toBe("Real text");
    });

    it("returns empty string when only system tags", () => {
      const input = "<system-reminder>foo</system-reminder><local-command-stdout>bar</local-command-stdout>";
      expect(cleanSystemTags(input)).toBe("");
    });

    it("handles case-insensitive noise detection", () => {
      expect(isNoiseMessage("Ready")).toBe(true);
      expect(isNoiseMessage("READY")).toBe(true);
    });
  });

  describe("isSkillPrompt", () => {
    it("detects HARD-GATE marker", () => {
      expect(isSkillPrompt("Some text <HARD-GATE> Do not code </HARD-GATE>")).toBe(true);
    });

    it("detects skill base directory", () => {
      expect(isSkillPrompt("Base directory for this skill: /path/to/skill")).toBe(true);
    });

    it("detects long markdown with many headers", () => {
      const longText = "x".repeat(2001) + "## A\n## B\n## C";
      expect(isSkillPrompt(longText)).toBe(true);
    });

    it("does not flag normal user messages", () => {
      expect(isSkillPrompt("fix the login bug please")).toBe(false);
    });

    it("does not flag short messages with code headers", () => {
      expect(isSkillPrompt("## My Title\nSome text")).toBe(false);
    });
  });

  describe("isNoiseMessage", () => {
    it("detects 'ready'", () => {
      expect(isNoiseMessage("ready")).toBe(true);
    });

    it("detects model switch", () => {
      expect(isNoiseMessage("opus[1m]")).toBe(true);
    });

    it("detects deprecated skill redirect", () => {
      expect(isNoiseMessage("Tell your human partner that this command is deprecated and will be removed")).toBe(true);
    });

    it("detects subagent output retrieval", () => {
      expect(isNoiseMessage("Read the output file to retrieve the result: /tmp/file")).toBe(true);
    });

    it("does not flag real user messages", () => {
      expect(isNoiseMessage("fix the pagination bug")).toBe(false);
    });

    it("returns true for empty after cleaning", () => {
      expect(isNoiseMessage("<system-reminder>x</system-reminder>")).toBe(true);
    });
  });
});
