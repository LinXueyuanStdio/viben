import { describe, it, expect, vi } from "vitest";
import { MessageTransformer } from "../message-transformer.js";
import type { AgentEvent } from "../types.js";

describe("MessageTransformer - extended", () => {
  const transformer = new MessageTransformer();

  describe("text event", () => {
    it("transforms with content", () => {
      const event: AgentEvent = { type: "text", content: "Hello world" };
      const result = transformer.transform(event);
      expect(result).toEqual({ type: "text", text: "Hello world" });
    });

    it("transforms with empty content", () => {
      const event: AgentEvent = { type: "text", content: "" };
      const result = transformer.transform(event);
      expect(result).toEqual({ type: "text", text: "" });
    });
  });

  describe("thought event", () => {
    it("transforms with content", () => {
      const event: AgentEvent = { type: "thought", content: "I think..." };
      const result = transformer.transform(event);
      expect(result).toEqual({ type: "thought", text: "I think..." });
    });
  });

  describe("tool_call event", () => {
    it("transforms with full metadata", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "Read file.ts",
        kind: "read",
        status: "running",
        content: "file content",
        locations: [{ path: "/src/file.ts" }],
      };
      const result = transformer.transform(event);
      expect(result.type).toBe("tool_call");
      expect(result.text).toBe("Read file.ts");
      expect(result.metadata).toMatchObject({
        id: "tc-1",
        name: "Read file.ts",
        kind: "read",
        status: "running",
        content: "file content",
      });
    });

    it("handles missing optional fields", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-2",
        name: "Unknown",
        status: "running",
      };
      const result = transformer.transform(event);
      expect(result.metadata).toMatchObject({
        id: "tc-2",
        name: "Unknown",
      });
    });
  });

  describe("tool_update event", () => {
    it("transforms with metadata", () => {
      const event: AgentEvent = {
        type: "tool_update",
        id: "tc-1",
        name: "Read",
        kind: "read",
        status: "completed",
        content: "result",
      };
      const result = transformer.transform(event);
      expect(result.type).toBe("tool_update");
      expect(result.text).toBe("");
      expect(result.metadata).toMatchObject({
        id: "tc-1",
        status: "completed",
      });
    });
  });

  describe("plan event", () => {
    it("transforms with entries", () => {
      const event: AgentEvent = {
        type: "plan",
        entries: [
          { content: "Step 1", status: "completed", priority: "high" },
          { content: "Step 2", status: "in_progress", priority: "medium" },
        ],
      };
      const result = transformer.transform(event);
      expect(result.type).toBe("plan");
      expect(result.metadata?.entries).toHaveLength(2);
    });
  });

  describe("usage event", () => {
    it("transforms with all fields", () => {
      const event: AgentEvent = {
        type: "usage",
        tokensUsed: 1000,
        contextSize: 100000,
        cost: { amount: 0.05, currency: "USD" },
      };
      const result = transformer.transform(event);
      expect(result.type).toBe("usage");
      expect(result.metadata).toMatchObject({
        tokensUsed: 1000,
        contextSize: 100000,
        cost: 0.05,
      });
    });

    it("transforms with partial fields", () => {
      const event: AgentEvent = {
        type: "usage",
        tokensUsed: 500,
      };
      const result = transformer.transform(event);
      expect(result.metadata?.tokensUsed).toBe(500);
    });
  });

  describe("session_end event", () => {
    it("includes reason in text", () => {
      const event: AgentEvent = {
        type: "session_end",
        reason: "user_cancelled",
      };
      const result = transformer.transform(event);
      expect(result).toEqual({
        type: "session_end",
        text: "Done (user_cancelled)",
      });
    });
  });

  describe("error event", () => {
    it("includes message in text", () => {
      const event: AgentEvent = { type: "error", message: "Something broke" };
      const result = transformer.transform(event);
      expect(result).toEqual({ type: "error", text: "Something broke" });
    });
  });

  describe("unknown event type", () => {
    it("returns empty text", () => {
      const event = { type: "unknown_type" } as any;
      const result = transformer.transform(event);
      expect(result).toEqual({ type: "text", text: "" });
    });
  });

  describe("commands_update event", () => {
    it("falls through to default handler", () => {
      const event: AgentEvent = { type: "commands_update", commands: [] };
      const result = transformer.transform(event);
      expect(result).toEqual({ type: "text", text: "" });
    });
  });

  describe("rawInput and _meta forwarding (v2)", () => {
    it("forwards rawInput in tool_call metadata", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "Read",
        kind: "read",
        status: "running",
        rawInput: { file_path: "src/main.ts", limit: 50 },
      };
      const result = transformer.transform(event);
      expect(result.metadata?.rawInput).toEqual({
        file_path: "src/main.ts",
        limit: 50,
      });
    });

    it("forwards rawInput in tool_update metadata", () => {
      const event: AgentEvent = {
        type: "tool_update",
        id: "tc-1",
        name: "Bash",
        kind: "execute",
        status: "completed",
        rawInput: { command: "pnpm test" },
        content: "all tests pass",
      };
      const result = transformer.transform(event);
      expect(result.metadata?.rawInput).toEqual({ command: "pnpm test" });
    });

    it("forwards displaySummary from _meta in tool_call", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "read_file",
        kind: "read",
        status: "running",
        meta: { displaySummary: "📖 Read src/main.ts (50 lines)" },
      };
      const result = transformer.transform(event);
      expect(result.metadata?.displaySummary).toBe(
        "📖 Read src/main.ts (50 lines)",
      );
    });

    it("forwards displayTitle from _meta in tool_call", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "read_file",
        kind: "read",
        status: "running",
        meta: { displayTitle: "src/main.ts" },
      };
      const result = transformer.transform(event);
      expect(result.metadata?.displayTitle).toBe("src/main.ts");
    });

    it("forwards displayKind from _meta in tool_call", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "read_file",
        status: "running",
        meta: { displayKind: "read" },
      };
      const result = transformer.transform(event);
      expect(result.metadata?.displayKind).toBe("read");
    });

    it("forwards all _meta display fields in tool_update", () => {
      const event: AgentEvent = {
        type: "tool_update",
        id: "tc-1",
        name: "read_file",
        status: "completed",
        meta: {
          displaySummary: "📖 Read src/main.ts (50 lines)",
          displayTitle: "src/main.ts",
          displayKind: "read",
        },
      };
      const result = transformer.transform(event);
      expect(result.metadata?.displaySummary).toBe(
        "📖 Read src/main.ts (50 lines)",
      );
      expect(result.metadata?.displayTitle).toBe("src/main.ts");
      expect(result.metadata?.displayKind).toBe("read");
    });

    it("handles missing _meta gracefully", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "Read",
        kind: "read",
        status: "running",
      };
      const result = transformer.transform(event);
      expect(result.metadata?.displaySummary).toBeUndefined();
      expect(result.metadata?.displayTitle).toBeUndefined();
      expect(result.metadata?.displayKind).toBeUndefined();
    });

    it("handles missing rawInput gracefully", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "Read",
        kind: "read",
        status: "running",
      };
      const result = transformer.transform(event);
      expect(result.metadata?.rawInput).toBeUndefined();
    });
  });

  describe("diffStats compatibility", () => {
    it("extracts apply_patch diffStats from rawOutput.metadata.files", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-apply-patch-files",
        name: "apply_patch",
        kind: "other",
        status: "completed",
        rawOutput: {
          metadata: {
            files: [
              { additions: 4, deletions: 1 },
              { additions: 3, deletions: 2 },
            ],
          },
        },
      };

      const result = transformer.transform(event);
      expect(result.metadata?.diffStats).toEqual({ added: 7, removed: 3 });
    });

    it("extracts apply_patch diffStats from rawOutput.metadata additions/deletions", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-apply-patch-direct",
        name: "apply_patch",
        kind: "other",
        status: "completed",
        rawOutput: {
          metadata: {
            additions: 19,
            deletions: 7,
          },
        },
      };

      const result = transformer.transform(event);
      expect(result.metadata?.diffStats).toEqual({ added: 19, removed: 7 });
    });

    it("keeps rawInput-derived diffStats when already available", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-write-existing-diffstats",
        name: "Write",
        kind: "write",
        status: "completed",
        rawInput: {
          old_string: "a\nb",
          new_string: "a\nb\nc",
        },
        rawOutput: {
          metadata: {
            additions: 99,
            deletions: 99,
          },
        },
      };

      const result = transformer.transform(event);
      expect(result.metadata?.diffStats).toEqual({ added: 1, removed: 0 });
    });

    it("builds viewer links for apply_patch from rawOutput metadata files", () => {
      const tunnelStore = {
        storeFile: vi.fn().mockReturnValue("file-id"),
        storeDiff: vi.fn().mockReturnValue("diff-id"),
      };
      const tunnelService = {
        getPublicUrl: vi.fn().mockReturnValue("https://tunnel.example"),
        getStore: vi.fn().mockReturnValue(tunnelStore),
        fileUrl: vi.fn().mockReturnValue("https://tunnel.example/view/file-id"),
        diffUrl: vi.fn().mockReturnValue("https://tunnel.example/diff/diff-id"),
      } as any;
      const t = new MessageTransformer(tunnelService);

      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-apply-patch-viewer",
        name: "apply_patch",
        kind: "other",
        status: "completed",
        rawOutput: {
          metadata: {
            files: [
              {
                filePath: "/ws/src/main.ts",
                before: "const a = 1;",
                after: "const a = 2;",
                additions: 1,
                deletions: 1,
              },
            ],
          },
        },
      };

      const result = t.transform(event, { id: "sess-1", workingDirectory: "/ws" });

      expect(result.metadata?.diffStats).toEqual({ added: 1, removed: 1 });
      expect(result.metadata?.viewerLinks).toEqual({
        file: "https://tunnel.example/view/file-id",
        diff: "https://tunnel.example/diff/diff-id",
      });
      expect(result.metadata?.viewerFilePath).toBe("/ws/src/main.ts");
    });

    it("handles malformed apply_patch rawOutput safely", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-apply-patch-malformed",
        name: "apply_patch",
        kind: "other",
        status: "completed",
        rawOutput: {
          metadata: {
            files: [null, { additions: "x", deletions: -1 }, { filePath: 123 }],
            additions: "bad",
            deletions: null,
          },
        },
      };

      const result = transformer.transform(event);
      expect(result.metadata?.diffStats).toBeUndefined();
      expect(result.metadata?.viewerLinks).toBeUndefined();
    });

    it("handles apply_patch tool_update without name using cached patchText", () => {
      const tunnelStore = {
        storeFile: vi.fn().mockReturnValue("file-id"),
        storeDiff: vi.fn().mockReturnValue("diff-id"),
      };
      const tunnelService = {
        getPublicUrl: vi.fn().mockReturnValue("https://tunnel.example"),
        getStore: vi.fn().mockReturnValue(tunnelStore),
        fileUrl: vi.fn().mockReturnValue("https://tunnel.example/view/file-id"),
        diffUrl: vi.fn().mockReturnValue("https://tunnel.example/diff/diff-id"),
      } as any;
      const t = new MessageTransformer(tunnelService);

      const callEvent: AgentEvent = {
        type: "tool_call",
        id: "tc-apply-patch-update",
        name: "apply_patch",
        kind: "other",
        status: "running",
        rawInput: {
          patchText: "*** Begin Patch\n*** Update File: /ws/src/main.ts\n*** End Patch",
        },
      };
      t.transform(callEvent, { id: "sess-1", workingDirectory: "/ws" });

      const updateEvent: AgentEvent = {
        type: "tool_update",
        id: "tc-apply-patch-update",
        kind: "other",
        status: "completed",
        rawOutput: {
          metadata: {
            files: [
              {
                filePath: "/ws/src/main.ts",
                before: "const a = 1;",
                after: "const a = 2;",
                additions: 1,
                deletions: 1,
              },
            ],
          },
        },
      };

      const result = t.transform(updateEvent, { id: "sess-1", workingDirectory: "/ws" });
      expect(result.metadata?.diffStats).toEqual({ added: 1, removed: 1 });
      expect(result.metadata?.viewerLinks).toEqual({
        file: "https://tunnel.example/view/file-id",
        diff: "https://tunnel.example/diff/diff-id",
      });
    });
  });

  describe("enrichWithViewerLinks (tunnel integration)", () => {
    it("does nothing without tunnelService", () => {
      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "Read",
        kind: "read",
        status: "completed",
        content: "data",
      };
      const result = transformer.transform(event, {
        id: "sess-1",
        workingDirectory: "/ws",
      });
      expect(result.metadata?.viewerLinks).toBeUndefined();
    });

    it("does nothing without sessionContext", () => {
      const tunnelService = {
        getStore: vi.fn().mockReturnValue({
          storeFile: vi.fn().mockReturnValue("id1"),
          storeDiff: vi.fn(),
        }),
        fileUrl: vi.fn().mockReturnValue("https://example.com/view/id1"),
        diffUrl: vi.fn(),
      } as any;
      const t = new MessageTransformer(tunnelService);

      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "Read",
        kind: "read",
        status: "completed",
        content: "data",
      };
      const result = t.transform(event); // no sessionContext
      expect(result.metadata?.viewerLinks).toBeUndefined();
    });

    it("adds viewer links when tunnel available and file info extracted", () => {
      const tunnelStore = {
        storeFile: vi.fn().mockReturnValue("file-id"),
        storeDiff: vi.fn().mockReturnValue("diff-id"),
      };
      const tunnelService = {
        getPublicUrl: vi.fn().mockReturnValue("https://tunnel.example"),
        getStore: vi.fn().mockReturnValue(tunnelStore),
        fileUrl: vi.fn().mockReturnValue("https://tunnel.example/view/file-id"),
        diffUrl: vi.fn().mockReturnValue("https://tunnel.example/diff/diff-id"),
      } as any;
      const t = new MessageTransformer(tunnelService);

      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "Edit",
        kind: "edit",
        status: "completed",
        content: [
          { type: "diff", path: "/ws/file.ts", oldText: "old", newText: "new" },
        ],
      };
      const result = t.transform(event, {
        id: "sess-1",
        workingDirectory: "/ws",
      });
      expect(result.metadata?.viewerLinks).toBeDefined();
    });

    it("skips viewer links when only localhost URL available", () => {
      const tunnelStore = {
        storeFile: vi.fn().mockReturnValue("file-id"),
        storeDiff: vi.fn().mockReturnValue("diff-id"),
      };
      const tunnelService = {
        getPublicUrl: vi.fn().mockReturnValue("http://localhost:3105"),
        getStore: vi.fn().mockReturnValue(tunnelStore),
        fileUrl: vi.fn().mockReturnValue("http://localhost:3105/view/file-id"),
        diffUrl: vi.fn().mockReturnValue("http://localhost:3105/diff/diff-id"),
      } as any;
      const t = new MessageTransformer(tunnelService);

      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "Edit",
        kind: "edit",
        status: "completed",
        content: [
          { type: "diff", path: "/ws/file.ts", oldText: "old", newText: "new" },
        ],
      };
      const result = t.transform(event, { id: "sess-1", workingDirectory: "/ws" });
      expect(result.metadata?.viewerLinks).toBeUndefined();
      expect(tunnelStore.storeFile).not.toHaveBeenCalled();
    });

    it("skips non-file tool kinds", () => {
      const tunnelStore = { storeFile: vi.fn(), storeDiff: vi.fn() };
      const tunnelService = {
        getPublicUrl: vi.fn().mockReturnValue("https://tunnel.example"),
        getStore: vi.fn().mockReturnValue(tunnelStore),
        fileUrl: vi.fn(),
        diffUrl: vi.fn(),
      } as any;
      const t = new MessageTransformer(tunnelService);

      const event: AgentEvent = {
        type: "tool_call",
        id: "tc-1",
        name: "Bash",
        kind: "bash",
        status: "completed",
        content: "output",
      };
      const result = t.transform(event, {
        id: "sess-1",
        workingDirectory: "/ws",
      });
      expect(tunnelStore.storeFile).not.toHaveBeenCalled();
    });

    describe("binary file skip (issue #195 — voice attachments outside workspace)", () => {
      function makeTunnelWithStore() {
        const tunnelStore = { storeFile: vi.fn().mockReturnValue("id"), storeDiff: vi.fn().mockReturnValue("id") };
        const tunnelService = {
          getPublicUrl: vi.fn().mockReturnValue("https://tunnel.example"),
          getStore: vi.fn().mockReturnValue(tunnelStore),
          fileUrl: vi.fn().mockReturnValue("https://tunnel.example/view/id"),
          diffUrl: vi.fn().mockReturnValue("https://tunnel.example/diff/id"),
        } as any;
        return { tunnelStore, tunnelService };
      }

      const binaryExtensions = [".wav", ".ogg", ".mp3", ".m4a", ".mp4", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".pdf", ".zip"];

      for (const ext of binaryExtensions) {
        it(`does not call storeFile for binary extension ${ext}`, () => {
          const { tunnelStore, tunnelService } = makeTunnelWithStore();
          const t = new MessageTransformer(tunnelService);

          const event: AgentEvent = {
            type: "tool_call",
            id: "tc-binary",
            name: "Read",
            kind: "read",
            status: "completed",
            rawInput: { file_path: `/home/user/.viben/files/sess1/voice${ext}` },
            content: "binary data",
          };
          const result = t.transform(event, { id: "sess-1", workingDirectory: "/home/user/project" });
          expect(tunnelStore.storeFile).not.toHaveBeenCalled();
          expect(result.metadata?.viewerLinks).toBeUndefined();
        });
      }

      it("does not call storeFile for voice.wav saved in viben files dir outside workspace", () => {
        // Regression test for issue #195:
        // Telegram voice attachments saved to ~/.viben/files/<sessionId>/voice.wav
        // were causing WARN logs when the agent read them, because the viewer-store
        // rejected the path as outside the workspace.
        const { tunnelStore, tunnelService } = makeTunnelWithStore();
        const t = new MessageTransformer(tunnelService);

        const event: AgentEvent = {
          type: "tool_call",
          id: "tc-voice",
          name: "Read",
          kind: "read",
          status: "completed",
          rawInput: { file_path: "/home/codex/.viben/files/wAmobthop7go/1775184611644-voice.wav" },
          content: "<binary wav data>",
        };
        const result = t.transform(event, {
          id: "wAmobthop7go",
          workingDirectory: "/home/codex/flutter_web_test",
        });

        expect(tunnelStore.storeFile).not.toHaveBeenCalled();
        expect(result.metadata?.viewerLinks).toBeUndefined();
      });

      it("still generates viewer links for text files in viben files dir outside workspace", () => {
        // Text files that happen to be outside the workspace SHOULD be handled by
        // viewer-store (which will silently skip them via DEBUG log), not early-exited.
        // This test ensures we only skip on extension, not on path location.
        const { tunnelStore, tunnelService } = makeTunnelWithStore();
        const t = new MessageTransformer(tunnelService);

        const event: AgentEvent = {
          type: "tool_call",
          id: "tc-text",
          name: "Read",
          kind: "read",
          status: "completed",
          rawInput: { file_path: "/home/codex/project/src/main.ts" },
          content: "const x = 1",
        };
        t.transform(event, {
          id: "sess-1",
          workingDirectory: "/home/codex/project",
        });

        // storeFile IS called for .ts files — path check is handled inside viewer-store
        expect(tunnelStore.storeFile).toHaveBeenCalled();
      });
    });
  });
});
