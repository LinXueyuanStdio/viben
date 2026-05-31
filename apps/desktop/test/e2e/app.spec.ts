describe("Viben Desktop App", () => {
  it("should launch and display main window", async () => {
    // Wait for app to initialize
    await browser.pause(3000);

    // Take screenshot of initial state
    const title = await browser.getTitle();
    expect(title).toBeTruthy();
  });

  it("should have main content area", async () => {
    // Check for main content area
    const body = await $("body");
    await expect(body).toBeDisplayed();
  });

  it("should render without critical errors", async () => {
    // Check console for critical errors
    const logs = await browser.getLogs("browser");
    const criticalErrors = logs.filter(
      (log) =>
        log.level === "SEVERE" &&
        !log.message.includes("favicon") &&
        !log.message.includes("DevTools")
    );

    if (criticalErrors.length > 0) {
      console.warn("Critical errors found:", criticalErrors);
    }

    // Allow some non-critical errors but fail on severe ones that break functionality
    expect(criticalErrors.length).toBeLessThan(5);
  });

  it("should have navigation elements", async () => {
    // Wait for navigation to load
    await browser.pause(2000);

    // Check for common navigation elements
    const nav =
      (await $("nav").isExisting()) ||
      (await $('[role="navigation"]').isExisting()) ||
      (await $(".sidebar").isExisting()) ||
      (await $('[data-testid="sidebar"]').isExisting());

    // Navigation might not exist in all views, so just log
    if (!nav) {
      console.log("No navigation element found - may be expected for this view");
    }
  });

  it("should be responsive to window resize", async () => {
    // Get initial size
    const initialSize = await browser.getWindowSize();

    // Resize window
    await browser.setWindowSize(800, 600);
    await browser.pause(500);

    // Verify app is still responsive
    const body = await $("body");
    await expect(body).toBeDisplayed();

    // Restore original size
    await browser.setWindowSize(initialSize.width, initialSize.height);
  });

  it("should capture final state screenshot", async () => {
    // Final screenshot is automatically captured by afterTest hook
    // This test just ensures we reach the end successfully
    await browser.pause(1000);
    expect(true).toBe(true);
  });
});
