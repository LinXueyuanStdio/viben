import { describe, it, expect, vi } from "vitest";
import { Group } from "three";
import { ScrollView } from "../../../src/ui/components/scroll-view";
import { List } from "../../../src/ui/components/list";

describe("ScrollView", () => {
  it("creates a root Group", () => {
    const sv = new ScrollView({ width: 300, height: 400 });
    expect(sv.root).toBeInstanceOf(Group);
  });

  it("adds content to scroll container", () => {
    const sv = new ScrollView({ width: 300, height: 400 });
    const child = new Group();
    sv.addContent(child);
    expect(sv.contentContainer.children).toContain(child);
  });

  it("clamps scroll offset", () => {
    const sv = new ScrollView({ width: 300, height: 400, contentHeight: 1000 });
    sv.scrollTo(9999);
    expect(sv.scrollOffset).toBeLessThanOrEqual(600);
    sv.scrollTo(-100);
    expect(sv.scrollOffset).toBe(0);
  });

  it("scrollBy adjusts offset incrementally", () => {
    const sv = new ScrollView({ width: 300, height: 400, contentHeight: 1000 });
    sv.scrollBy(50);
    expect(sv.scrollOffset).toBe(50);
    sv.scrollBy(50);
    expect(sv.scrollOffset).toBe(100);
  });
});

describe("List", () => {
  it("creates items from data", () => {
    const list = new List<string>({
      width: 300, height: 400, itemHeight: 44,
      data: ["A", "B", "C"],
      renderItem: (item) => { const g = new Group(); g.name = item; return g; },
    });
    expect(list.root).toBeInstanceOf(Group);
  });

  it("updates data", () => {
    const render = vi.fn((_item: string) => new Group());
    const list = new List<string>({
      width: 300, height: 400, itemHeight: 44, data: ["A"], renderItem: render,
    });
    list.setData(["A", "B", "C"]);
    expect(render.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
