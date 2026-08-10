import type { FileUIPart } from "ai";
import { describe, expect, test } from "vitest";
import { buildChatMessagePayload } from "./chat-message-payload";

const image: FileUIPart = {
  type: "file",
  mediaType: "image/png",
  url: "data:image/png;base64,AA==",
  filename: "preview.png",
};

describe("buildChatMessagePayload", () => {
  test("keeps the compact text and files shape when there are no snippets", () => {
    expect(
      buildChatMessagePayload({
        text: "Look at this",
        files: [image],
        textAttachments: [],
      }),
    ).toEqual({
      text: "Look at this",
      files: [image],
    });
  });

  test("omits an empty files collection from a text-only message", () => {
    expect(
      buildChatMessagePayload({
        text: "Text only",
        files: [],
        textAttachments: [],
      }),
    ).toEqual({ text: "Text only", files: undefined });
  });

  test("uses ordered parts when text snippets are present", () => {
    expect(
      buildChatMessagePayload({
        text: "Review this",
        files: [image],
        textAttachments: [
          {
            id: "snippet-1",
            content: "const answer = 42;",
            filename: "answer.ts",
            lineCount: 1,
            byteSize: 18,
          },
        ],
      }),
    ).toEqual({
      parts: [
        { type: "text", text: "Review this" },
        image,
        {
          type: "data-snippet",
          id: "snippet-1",
          data: {
            content: "const answer = 42;",
            filename: "answer.ts",
          },
        },
      ],
    });
  });
});
