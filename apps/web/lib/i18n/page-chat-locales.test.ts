import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const localesDir = path.join(process.cwd(), "lib/i18n/locales");
const localeFiles = fs
  .readdirSync(localesDir)
  .filter((file) => file.endsWith(".json"))
  .sort();

const requiredKeys = [
  "assistant.sidebar.pages",
  "assistant.pageChat.tab",
  "assistant.pageChat.placeholder",
  "assistant.pageChat.newConversation",
  "assistant.pageChat.openFullConversation",
  "assistant.pageChat.preview",
  "assistant.pageChat.openPage",
  "assistant.pageChat.pageUnavailable",
  "assistant.pageChat.retry",
  "assistant.pageChat.restoreError",
  "assistant.pageChat.loadConversationError",
  "assistant.pageChat.emptyTitle",
  "assistant.pageChat.emptyDescription",
  "assistant.pageChat.authorPrompts.multilingual",
  "assistant.pageChat.authorPrompts.seo",
  "assistant.pageChat.authorPrompts.accessibility",
  "assistant.pageChat.readerPrompts.summary",
  "assistant.pageChat.readerPrompts.keyPoints",
  "assistant.pageChat.readerPrompts.explain",
];

const pageChatComponentFiles = [
  "components/layout/read-drawer.tsx",
  "components/pages/page-assistant-panel.tsx",
  "components/assistant/page-session-header.tsx",
  "components/assistant/page-preview-panel.tsx",
  "components/assistant/inbox-sidebar.tsx",
];

const forbiddenExactLiterals = [
  "Pages",
  "Preview",
  "Open page",
  "New conversation",
  "Open full conversation",
  "Page unavailable",
  "Ask about this page",
];

function readLocale(file: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(localesDir, file), "utf8"));
}

function getValue(source: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, source);
}

describe("page chat locales", () => {
  test.each(localeFiles)("%s contains every page chat key", (file) => {
    const locale = readLocale(file);
    for (const key of requiredKeys) {
      expect(getValue(locale, key), `${file}:${key}`).toEqual(
        expect.any(String),
      );
    }
  });

  test.each(pageChatComponentFiles)(
    "%s does not contain hardcoded page chat UI literals",
    (file) => {
      const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
      for (const literal of forbiddenExactLiterals) {
        const quotedLiteral = new RegExp(
          `(["'\`])${literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\1`,
        );
        expect(source, `${file}:${literal}`).not.toMatch(quotedLiteral);
      }
    },
  );
});
