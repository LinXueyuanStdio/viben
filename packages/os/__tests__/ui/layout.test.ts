import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { YogaContext, YogaNode } from "../../src/ui/layout";
import { Object3D } from "three";

describe("YogaContext + YogaNode", () => {
  beforeAll(async () => {
    await YogaContext.init();
  });

  afterEach(() => {
    YogaContext.reset();
  });

  it("initializes yoga WASM", async () => {
    await YogaContext.init();
    expect(YogaContext.isReady).toBe(true);
  });

  it("creates a root node with fixed size", async () => {
    await YogaContext.init();
    const obj = new Object3D();
    const node = new YogaNode(obj);
    node.setWidth(400);
    node.setHeight(300);
    node.calculateLayout();
    expect(node.computedWidth).toBe(400);
    expect(node.computedHeight).toBe(300);
    node.dispose();
  });

  it("lays out children in column direction", async () => {
    await YogaContext.init();
    const root = new YogaNode(new Object3D());
    root.setWidth(400);
    root.setHeight(300);
    root.setFlexDirection("column");

    const child1 = new YogaNode(new Object3D());
    child1.setHeight(100);
    root.addChild(child1);

    const child2 = new YogaNode(new Object3D());
    child2.setHeight(100);
    root.addChild(child2);

    root.calculateLayout();

    expect(child1.computedTop).toBe(0);
    expect(child1.computedWidth).toBe(400);
    expect(child2.computedTop).toBe(100);

    root.dispose();
  });

  it("syncs computed layout to Object3D position", async () => {
    await YogaContext.init();
    const rootObj = new Object3D();
    const childObj = new Object3D();
    rootObj.add(childObj);

    const root = new YogaNode(rootObj);
    root.setWidth(400);
    root.setHeight(300);
    root.setPadding("all", 10);

    const child = new YogaNode(childObj);
    child.setWidth(100);
    child.setHeight(50);
    root.addChild(child);

    root.calculateLayout();
    root.syncToObject3D();

    expect(childObj.position.x).toBe(10);
    expect(childObj.position.y).toBe(-10);

    root.dispose();
  });

  it("supports flexGrow", async () => {
    await YogaContext.init();
    const root = new YogaNode(new Object3D());
    root.setWidth(400);
    root.setHeight(300);
    root.setFlexDirection("column");

    const child = new YogaNode(new Object3D());
    child.setFlexGrow(1);
    root.addChild(child);

    root.calculateLayout();
    expect(child.computedHeight).toBe(300);

    root.dispose();
  });
});
