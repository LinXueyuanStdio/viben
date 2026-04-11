import { describe, it, expect, vi } from "vitest";
import { Group } from "three";
import { Button } from "../../../src/ui/components/button";

describe("Button", () => {
  it("creates a Group with box background", () => {
    const btn = new Button({ label: "OK", width: 120, height: 44 });
    expect(btn.root).toBeInstanceOf(Group);
    expect(btn.root.children.length).toBeGreaterThan(0);
  });

  it("fires onTap callback", () => {
    const handler = vi.fn();
    const btn = new Button({ label: "OK", width: 120, height: 44, onTap: handler });
    btn.handleTap();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("updates label text", () => {
    const btn = new Button({ label: "OK", width: 120, height: 44 });
    btn.setLabel("Cancel");
    expect(btn.label).toBe("Cancel");
  });

  it("disposes without error", () => {
    const btn = new Button({ label: "X", width: 80, height: 40 });
    btn.dispose();
  });
});
