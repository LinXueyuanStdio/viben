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
          { name: "review", description: "Review target", input: null },
          { name: "status", description: "Show status", input: null },
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

    expect(onSelect).toHaveBeenCalledWith({ name: "review", description: "Review target", input: null });
    expect(result.current.isOpen).toBe(false);
  });

  test("updates selected index on hover", () => {
    const { result } = renderHook(() =>
      useSlashCommandMenu({
        commands: [
          { name: "review", description: "Review target", input: null },
          { name: "status", description: "Show status", input: null },
        ],
        onSelect: vi.fn(),
      })
    );

    act(() => {
      result.current.handleContentChange("/");
      result.current.handleHover(1);
    });

    expect(result.current.selectedIndex).toBe(1);

    act(() => {
      result.current.handleHover(5);
    });

    expect(result.current.selectedIndex).toBe(1);
  });
});
