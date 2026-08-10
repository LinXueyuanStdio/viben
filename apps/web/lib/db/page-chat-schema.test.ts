import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { sessions } from "./schema";

describe("page chat session schema", () => {
  test("exposes a work-defaulted agent type and nullable page context", () => {
    expect(sessions.agentType.enumValues).toEqual(["work", "chat"]);
    expect(sessions.agentType.notNull).toBe(true);
    expect(sessions.agentType.default).toBe("work");
    expect(sessions.publishedPageId).toBeDefined();
    expect(sessions.pageUserSlug).toBeDefined();
    expect(sessions.pageSlug).toBeDefined();
  });

  test("migration preserves history and prevents duplicate active page sessions", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "lib/db/migrations/0005_page_chat_sessions.sql"),
      "utf8",
    );
    expect(sql).toContain("ON DELETE SET NULL");
    expect(sql).toContain("sessions_active_page_chat_unique_idx");
    expect(sql).toContain("WHERE agent_type = 'chat' AND status <> 'archived'");
  });
});
