import { describe, it, expect, vi } from "vitest";
import { MenuRegistry, type MenuItem } from "../menu-registry.js";

function makeItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: "test:item",
    label: "Test",
    priority: 100,
    action: { type: "command", command: "/test" },
    ...overrides,
  };
}

describe("MenuRegistry", () => {
  it("registers and retrieves items sorted by priority", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({ id: "b", priority: 20 }));
    reg.register(makeItem({ id: "a", priority: 10 }));
    reg.register(makeItem({ id: "c", priority: 30 }));
    const items = reg.getItems();
    expect(items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("unregisters items", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({ id: "x" }));
    expect(reg.getItem("x")).toBeDefined();
    reg.unregister("x");
    expect(reg.getItem("x")).toBeUndefined();
    expect(reg.getItems()).toHaveLength(0);
  });

  it("filters by visible()", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({ id: "show", visible: () => true }));
    reg.register(makeItem({ id: "hide", visible: () => false }));
    reg.register(makeItem({ id: "nocheck" }));
    expect(reg.getItems().map((i) => i.id)).toEqual(["show", "nocheck"]);
  });

  it("catches visible() errors and hides item", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({
      id: "broken",
      visible: () => { throw new Error("boom"); },
    }));
    expect(reg.getItems()).toHaveLength(0);
  });

  it("getItem returns specific item by id", () => {
    const reg = new MenuRegistry();
    const item = makeItem({ id: "find-me", label: "Found" });
    reg.register(item);
    expect(reg.getItem("find-me")?.label).toBe("Found");
  });

  it("overwrite replaces existing item", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({ id: "same", label: "V1" }));
    reg.register(makeItem({ id: "same", label: "V2" }));
    expect(reg.getItem("same")?.label).toBe("V2");
    expect(reg.getItems()).toHaveLength(1);
  });

  it("stable sort for same priority", () => {
    const reg = new MenuRegistry();
    reg.register(makeItem({ id: "first", priority: 10 }));
    reg.register(makeItem({ id: "second", priority: 10 }));
    const items = reg.getItems();
    expect(items[0].id).toBe("first");
    expect(items[1].id).toBe("second");
  });
});
