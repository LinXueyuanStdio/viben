import { describe, it, expect, vi } from "vitest";
import { DraftManager } from "../primitives/draft-manager.js";

describe("DraftManager", () => {
  it("returns a new empty draft after finalize removes the old one", async () => {
    const onFlush = vi.fn().mockResolvedValue("msg-1");
    const manager = new DraftManager({
      flushInterval: 10,
      maxLength: 10000,
      onFlush,
    });

    const draft1 = manager.getOrCreate("sess-1");
    draft1.append("hello");
    await manager.finalize("sess-1");

    const draft2 = manager.getOrCreate("sess-1");
    expect(draft2).not.toBe(draft1);
    expect(draft2.isEmpty).toBe(true);

    manager.destroyAll();
  });
});
