import { describe, it, expect } from "vitest";
import { ThemeManager, lightTheme } from "../../src/ui/theme";

describe("ThemeManager", () => {
  it("defaults to dark theme", () => {
    const tm = new ThemeManager();
    expect(tm.current.name).toBe("dark");
  });

  it("switches to light theme", () => {
    const tm = new ThemeManager();
    tm.setTheme("light");
    expect(tm.current.name).toBe("light");
    expect(tm.current.colors.background).toBe(lightTheme.colors.background);
  });

  it("notifies listeners on theme change", () => {
    const tm = new ThemeManager();
    const calls: string[] = [];
    tm.onChange((theme) => calls.push(theme.name));
    tm.setTheme("light");
    tm.setTheme("dark");
    expect(calls).toEqual(["light", "dark"]);
  });

  it("provides color, font, spacing tokens", () => {
    const tm = new ThemeManager();
    const t = tm.current;
    expect(t.colors.primary).toBeDefined();
    expect(t.colors.surface).toBeDefined();
    expect(t.fonts.body).toBeDefined();
    expect(t.spacing.sm).toBeGreaterThan(0);
    expect(t.radii.md).toBeGreaterThan(0);
  });
});
