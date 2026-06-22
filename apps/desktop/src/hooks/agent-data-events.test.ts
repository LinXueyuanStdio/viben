import { describe, expect, it, vi } from "vitest";
import {
  emitAgentDataChanged,
  shouldRefreshAgentList,
  subscribeAgentDataChanged,
} from "./agent-data-events";

describe("agent data events", () => {
  it("notifies other hook instances when agent data changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAgentDataChanged(listener);

    emitAgentDataChanged({ workspace_path: "/workspace" });
    unsubscribe();

    expect(listener).toHaveBeenCalledWith({ workspace_path: "/workspace" });
  });

  it("refreshes matching workspace agent lists", () => {
    expect(shouldRefreshAgentList({ workspace_path: "/workspace" }, "/workspace")).toBe(true);
    expect(shouldRefreshAgentList({ workspace_path: "/other" }, "/workspace")).toBe(false);
    expect(shouldRefreshAgentList({}, "/workspace")).toBe(true);
  });
});
