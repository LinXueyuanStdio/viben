import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const desktopRoot = resolve(__dirname, "..");

function readDesktopFile(path: string) {
  return readFileSync(resolve(desktopRoot, path), "utf8");
}

describe("tray popup entry", () => {
  it("uses a dedicated HTML document and React entry outside the main app router", () => {
    expect(existsSync(resolve(desktopRoot, "tray-popup.html"))).toBe(true);

    const html = readDesktopFile("tray-popup.html");
    expect(html).toContain('<script type="module" src="/src/tray-popup-main.tsx"></script>');

    const viteConfig = readDesktopFile("vite.config.ts");
    expect(viteConfig).toContain("trayPopup");
    expect(viteConfig).toContain("./tray-popup.html");

    const tauriConfig = JSON.parse(readDesktopFile("src-tauri/tauri.conf.json")) as {
      app: { windows: Array<{ label: string; url?: string }> };
    };
    const trayWindow = tauriConfig.app.windows.find((window) => window.label === "tray-popup");
    expect(trayWindow?.url).toBe("/tray-popup.html");

    const app = readDesktopFile("src/App.tsx");
    expect(app).not.toContain("TrayPopupPage");
    expect(app).not.toContain('path="/tray-popup"');
  });
});
