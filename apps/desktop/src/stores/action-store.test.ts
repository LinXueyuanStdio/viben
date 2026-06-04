import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActionStore } from "./action-store";
import type { ActionDef } from "@/lib/action-system/types";

function action(name: string): ActionDef {
  return {
    name,
    description: `${name} description`,
    execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
  };
}

describe("action-store logging", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useActionStore.setState({ registry: new Map() });
  });

  it("logs register, update, unregister, and namespace conflicts", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    useActionStore.getState().register("provider-a", "demo", [action("open")]);
    useActionStore.getState().register("provider-a", "demo", [action("close")]);
    useActionStore.getState().register("provider-b", "demo", [action("close")]);
    useActionStore.getState().unregister("provider-a");

    expect(info).toHaveBeenCalledWith(
      "[ActionStore] register",
      expect.objectContaining({
        providerId: "provider-a",
        namespace: "demo",
        actions: ["demo.open"],
      })
    );
    expect(info).toHaveBeenCalledWith(
      "[ActionStore] update",
      expect.objectContaining({
        providerId: "provider-a",
        namespace: "demo",
        actions: ["demo.close"],
      })
    );
    expect(warn).toHaveBeenCalledWith(
      "[ActionStore] conflict",
      expect.objectContaining({
        providerId: "provider-b",
        existingProviderId: "provider-a",
        action: "demo.close",
      })
    );
    expect(info).toHaveBeenCalledWith(
      "[ActionStore] unregister",
      expect.objectContaining({
        providerId: "provider-a",
        namespace: "demo",
        actions: ["demo.close"],
      })
    );
  });
});
