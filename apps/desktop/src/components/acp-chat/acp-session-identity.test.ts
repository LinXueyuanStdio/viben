import { describe, expect, it } from "vitest";
import {
  buildAcpSessionKey,
  createUiSession,
  normalizeAcpSessionListItem,
  resolveAcpSessionStateKey,
} from "./acp-chat-state";

describe("ACP session list identity", () => {
  it("builds a composite key when executor_type is available", () => {
    expect(buildAcpSessionKey("shared", "CODEX")).toBe("CODEX:shared");
    expect(buildAcpSessionKey("shared")).toBe("shared");
  });

  it("keeps duplicate session ids distinct across executor types", () => {
    const codex = normalizeAcpSessionListItem({
      sessionId: "shared",
      executor_type: "CODEX",
      title: "Codex",
    });
    const claude = normalizeAcpSessionListItem({
      sessionId: "shared",
      executor_type: "CLAUDE_CODE",
      title: "Claude",
    });

    expect(codex).toMatchObject({
      sessionKey: "CODEX:shared",
      sessionId: "shared",
      executorType: "CODEX",
    });
    expect(claude).toMatchObject({
      sessionKey: "CLAUDE_CODE:shared",
      sessionId: "shared",
      executorType: "CLAUDE_CODE",
    });
  });

  it("resolves bare session updates to the active matching session first", () => {
    const sessionsById = {
      "CODEX:shared": createUiSession(
        "shared",
        "/tmp/codex",
        null,
        undefined,
        { sessionKey: "CODEX:shared", executorType: "CODEX" }
      ),
      "CLAUDE_CODE:shared": createUiSession(
        "shared",
        "/tmp/claude",
        null,
        undefined,
        { sessionKey: "CLAUDE_CODE:shared", executorType: "CLAUDE_CODE" }
      ),
    };

    expect(resolveAcpSessionStateKey(sessionsById, "shared", "CLAUDE_CODE:shared")).toBe("CLAUDE_CODE:shared");
  });

  it("resolves bare session updates to the unique matching session", () => {
    const sessionsById = {
      "CODEX:shared": createUiSession(
        "shared",
        "/tmp/codex",
        null,
        undefined,
        { sessionKey: "CODEX:shared", executorType: "CODEX" }
      ),
    };

    expect(resolveAcpSessionStateKey(sessionsById, "shared", null)).toBe("CODEX:shared");
  });

  it("falls back to bare session id when no known session matches", () => {
    expect(resolveAcpSessionStateKey({}, "legacy-session", null)).toBe("legacy-session");
  });
});
