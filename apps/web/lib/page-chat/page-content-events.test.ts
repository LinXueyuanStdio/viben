import { describe, expect, test, vi } from "vitest";
import {
  emitPageContentChanged,
  subscribePageContentChanged,
} from "./page-content-events";

describe("page content events", () => {
  test("publishes and unsubscribes typed page content events", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePageContentChanged(listener);

    emitPageContentChanged({ publishedPageId: "page-1", chatId: "chat-1" });

    expect(listener).toHaveBeenCalledWith({
      publishedPageId: "page-1",
      chatId: "chat-1",
    });

    unsubscribe();
    emitPageContentChanged({ publishedPageId: "page-1", chatId: "chat-1" });

    expect(listener).toHaveBeenCalledOnce();
  });
});
