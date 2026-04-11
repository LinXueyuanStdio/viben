import { describe, it, expect } from "vitest";
import { Spring, Tween } from "../../src/ui/animation";

describe("Spring", () => {
  it("starts at the from value", () => {
    const s = new Spring({ from: 0, to: 100 });
    expect(s.value).toBe(0);
    expect(s.done).toBe(false);
  });

  it("approaches the target after many updates", () => {
    const s = new Spring({ from: 0, to: 100, stiffness: 200, damping: 20 });
    for (let i = 0; i < 300; i++) s.update(1 / 60);
    expect(s.value).toBeCloseTo(100, 0);
    expect(s.done).toBe(true);
  });

  it("can retarget mid-animation", () => {
    const s = new Spring({ from: 0, to: 100 });
    for (let i = 0; i < 30; i++) s.update(1 / 60);
    s.setTarget(200);
    expect(s.done).toBe(false);
    for (let i = 0; i < 300; i++) s.update(1 / 60);
    expect(s.value).toBeCloseTo(200, 0);
  });
});

describe("Tween", () => {
  it("starts at from value", () => {
    const t = new Tween({ from: 0, to: 100, duration: 0.5 });
    expect(t.value).toBe(0);
    expect(t.done).toBe(false);
  });

  it("reaches to value after duration", () => {
    const t = new Tween({ from: 0, to: 100, duration: 0.5 });
    t.update(0.25);
    expect(t.value).toBeGreaterThan(0);
    expect(t.value).toBeLessThan(100);
    t.update(0.25);
    expect(t.value).toBe(100);
    expect(t.done).toBe(true);
  });

  it("supports custom easing", () => {
    const t = new Tween({ from: 0, to: 100, duration: 1, easing: (t) => t });
    t.update(0.5);
    expect(t.value).toBeCloseTo(50, 1);
  });
});
