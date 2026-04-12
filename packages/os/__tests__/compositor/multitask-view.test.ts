import { describe, it, expect, vi } from "vitest";
import { Group, WebGLRenderTarget } from "three";
import { MultitaskView } from "../../src/compositor/multitask-view";
import type { AppSnapshot } from "../../src/compositor/multitask-view";

function makeSnapshots(count: number): AppSnapshot[] {
  const snapshots: AppSnapshot[] = [];
  for (let i = 0; i < count; i++) {
    const rt = new WebGLRenderTarget(800, 600);
    snapshots.push({ id: `app${i + 1}`, texture: rt.texture });
  }
  return snapshots;
}

describe("MultitaskView", () => {
  it("creates a root Group", () => {
    const view = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    expect(view.root).toBeInstanceOf(Group);
    view.dispose();
  });

  it("renders cards for given app snapshots", () => {
    const view = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    const snapshots = makeSnapshots(2);
    view.setCards(snapshots);

    expect(view.root.children.length).toBe(2);
    view.dispose();
  });

  it("scrolls cards horizontally", () => {
    const view = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    const snapshots = makeSnapshots(2);
    view.setCards(snapshots);

    view.scrollBy(100);
    expect(view.scrollOffsetValue).toBe(100);

    view.dispose();
  });

  it("fires onSelectApp when a card index is tapped", () => {
    const view = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    const snapshots = makeSnapshots(2);
    view.setCards(snapshots);

    const handler = vi.fn();
    view.onSelectApp(handler);
    view.selectCard(0);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("app1");

    view.dispose();
  });

  it("fires onDismissApp when a card is dismissed", () => {
    const view = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    const snapshots = makeSnapshots(1);
    view.setCards(snapshots);

    const handler = vi.fn();
    view.onDismissApp(handler);
    view.dismissCard(0);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("app1");
    expect(view.root.children.length).toBe(0);

    view.dispose();
  });

  it("disposes all card meshes", () => {
    const view = new MultitaskView({ screenWidth: 800, screenHeight: 600 });
    const snapshots = makeSnapshots(3);
    view.setCards(snapshots);

    expect(view.root.children.length).toBe(3);

    view.dispose();
    expect(view.root.children.length).toBe(0);
  });
});
