import { isMainDesktopWindowUrl } from "./window-selection";

describe("Viben Desktop App", () => {
  before(async () => {
    // Wait for app to initialize
    await browser.pause(3000);

    // Get all window handles
    const handles = await browser.getWindowHandles();
    console.log(`Found ${handles.length} window handle(s)`);

    // Find the main window by checking URL (main window loads /index.html)
    let mainWindowHandle: string | undefined;
    const inspectedWindows: string[] = [];

    for (const handle of handles) {
      await browser.switchToWindow(handle);
      const title = await browser.getTitle();
      const url = await browser.getUrl();
      inspectedWindows.push(`"${title}" ${url}`);
      console.log(`Window: "${title}" URL: ${url}`);

      // Main window loads index.html. Auxiliary windows have their own entrypoints.
      if (isMainDesktopWindowUrl(url)) {
        // Double check by looking at content
        const html = await $("body").getHTML();
        if (!html.includes("Server Status") && !html.includes("No MCP Servers")) {
          mainWindowHandle = handle;
          console.log(`  -> Selected as main window (verified by content)`);
          break;
        } else {
          console.log(`  -> Has auxiliary window content, skipping`);
        }
      }
    }

    if (!mainWindowHandle) {
      throw new Error(`Could not find main desktop window. Inspected windows: ${inspectedWindows.join(", ")}`);
    }

    // Switch to main window
    await browser.switchToWindow(mainWindowHandle);

    // Force resize the window
    console.log("Setting window size to 1200x800...");
    await browser.setWindowSize(1200, 800);
    await browser.pause(1000);

    const finalTitle = await browser.getTitle();
    const finalUrl = await browser.getUrl();
    console.log(`Final window: "${finalTitle}" URL: ${finalUrl}`);

    await browser.pause(2000);
  });

  it("should launch and display main window", async () => {
    const title = await browser.getTitle();
    const url = await browser.getUrl();
    console.log(`Window title: "${title}", URL: ${url}`);

    // We should be on a Viben window
    expect(title).toBeTruthy();
  });

  it("should have visible content", async () => {
    const body = await $("body");
    await expect(body).toBeDisplayed();

    const html = await body.getHTML();
    expect(html.length).toBeGreaterThan(100);
    console.log("Content loaded, length:", html.length);
  });

  it("should respond to window resize", async () => {
    await browser.setWindowSize(900, 600);
    await browser.pause(500);

    let body = await $("body");
    await expect(body).toBeDisplayed();

    await browser.setWindowSize(1200, 800);
    await browser.pause(500);

    body = await $("body");
    await expect(body).toBeDisplayed();
    console.log("Window resize test completed");
  });

  it("should remain stable", async () => {
    await browser.pause(1000);

    const body = await $("body");
    await expect(body).toBeDisplayed();

    console.log("Stability test completed");
  });
});
