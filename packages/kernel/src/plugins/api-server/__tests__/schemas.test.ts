import { describe, it, expect } from "vitest";
import {
  CreateSessionBodySchema,
  PromptBodySchema,
} from "../schemas/sessions.js";

describe("CreateSessionBodySchema", () => {
  describe("workspace field", () => {
    it("accepts relative workspace name", () => {
      const result = CreateSessionBodySchema.safeParse({ workspace: "my-project" });
      expect(result.success).toBe(true);
    });

    it("accepts absolute path", () => {
      const result = CreateSessionBodySchema.safeParse({ workspace: "/Users/lucas/code/accnest" });
      expect(result.success).toBe(true);
    });

    it("accepts tilde path", () => {
      const result = CreateSessionBodySchema.safeParse({ workspace: "~/projects/myapp" });
      expect(result.success).toBe(true);
    });

    it("accepts undefined workspace", () => {
      const result = CreateSessionBodySchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });
});

describe("PromptBodySchema - attachments", () => {
  describe("fileName validation", () => {
    it("accepts simple alphanumeric name", () => {
      const result = PromptBodySchema.safeParse({
        prompt: "hello",
        attachments: [{ fileName: "report.pdf", mimeType: "application/pdf", data: "dGVzdA==" }],
      });
      expect(result.success).toBe(true);
    });

    it("accepts filename with spaces", () => {
      const result = PromptBodySchema.safeParse({
        prompt: "hello",
        attachments: [{ fileName: "my report.pdf", mimeType: "application/pdf", data: "dGVzdA==" }],
      });
      expect(result.success).toBe(true);
    });

    it("accepts Vietnamese filename", () => {
      const result = PromptBodySchema.safeParse({
        prompt: "hello",
        attachments: [{ fileName: "báo cáo tháng 3.pdf", mimeType: "application/pdf", data: "dGVzdA==" }],
      });
      expect(result.success).toBe(true);
    });

    it("accepts filename with parentheses and brackets", () => {
      const result = PromptBodySchema.safeParse({
        prompt: "hello",
        attachments: [{ fileName: "file (1).jpg", mimeType: "image/jpeg", data: "dGVzdA==" }],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty filename", () => {
      const result = PromptBodySchema.safeParse({
        prompt: "hello",
        attachments: [{ fileName: "", mimeType: "application/pdf", data: "dGVzdA==" }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects filename over 255 chars", () => {
      const result = PromptBodySchema.safeParse({
        prompt: "hello",
        attachments: [{ fileName: "a".repeat(256), mimeType: "application/pdf", data: "dGVzdA==" }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("mimeType validation", () => {
    it("accepts valid MIME types", () => {
      for (const mimeType of ["image/jpeg", "application/pdf", "text/plain", "audio/wav"]) {
        const result = PromptBodySchema.safeParse({
          prompt: "hello",
          attachments: [{ fileName: "file.txt", mimeType, data: "dGVzdA==" }],
        });
        expect(result.success, `Expected ${mimeType} to be valid`).toBe(true);
      }
    });

    it("rejects invalid MIME type format", () => {
      const result = PromptBodySchema.safeParse({
        prompt: "hello",
        attachments: [{ fileName: "file.txt", mimeType: "not-a-mime", data: "dGVzdA==" }],
      });
      expect(result.success).toBe(false);
    });
  });
});
