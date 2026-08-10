import { act, renderHook } from "@testing-library/react";
import { expect, test } from "vitest";
import { useTextAttachments } from "./use-text-attachments";

test("restores multiple existing text attachments after a failed send", () => {
  const { result } = renderHook(useTextAttachments);

  act(() => {
    result.current.addTextAttachments([
      {
        id: "attachment-a",
        content: "one",
        filename: "one.txt",
        lineCount: 1,
        byteSize: 3,
      },
      {
        id: "attachment-b",
        content: "two",
        filename: "two.txt",
        lineCount: 1,
        byteSize: 3,
      },
    ]);
  });

  expect(result.current.textAttachments.map((item) => item.id)).toEqual([
    "attachment-a",
    "attachment-b",
  ]);
});
