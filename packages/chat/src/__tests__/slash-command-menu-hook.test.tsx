// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useSlashCommandMenu } from "../chat-input/hooks";

describe("useSlashCommandMenu", () => {
  test("opens, filters, and selects slash commands", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useSlashCommandMenu({
        commands: [
          { id: "review", name: "review", description: "Review target" },
          { id: "status", name: "status", description: "Show status" },
        ],
        onSelect,
      })
    );

    act(() => {
      result.current.handleContentChange("/rev");
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.filteredCommands.map((command) => command.name)).toEqual(["review"]);

    act(() => {
      result.current.handleSelect(result.current.filteredCommands[0]);
    });

    expect(onSelect).toHaveBeenCalledWith({ id: "review", name: "review", description: "Review target" });
    expect(result.current.isOpen).toBe(false);
  });
});
