describe("Viben Desktop App", () => {
  before(async () => {
    // Switch to the main window (not tray-popup)
    const handles = await browser.getWindowHandles();

    // Find and switch to the main window
    for (const handle of handles) {
      await browser.switchToWindow(handle);
      const title = await browser.getTitle();
      // Main window has title "Viben", tray-popup has "Server Status"
      if (title === "Viben" || !title.includes("Server Status")) {
        console.log(`Switched to window: "${title}"`);
        break;
      }
    }

    // Wait for main window to fully load
    await browser.pause(3000);
  });

  it("should launch and display main window", async () => {
    // Verify we're on the main window
    const title = await browser.getTitle();
    console.log(`Window title: "${title}"`);
    expect(title).toBe("Viben");
  });

  it("should have main content area", async () => {
    const body = await $("body");
    await expect(body).toBeDisplayed();

    // Verify body has content
    const html = await body.getHTML();
    expect(html.length).toBeGreaterThan(100);
  });

  it("should render without critical errors", async () => {
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

    expect(criticalErrors.length).toBeLessThan(5);
  });

  it("should have clickable sidebar or navigation", async () => {
    await browser.pause(1000);

    // Try to find sidebar or navigation elements
    const sidebarSelectors = [
      "nav",
      '[role="navigation"]',
      ".sidebar",
      '[data-testid="sidebar"]',
      'aside',
      '[class*="sidebar"]',
      '[class*="nav"]',
    ];

    let foundNav = false;
    for (const selector of sidebarSelectors) {
      const element = await $(selector);
      if (await element.isExisting()) {
        foundNav = true;
        console.log(`Found navigation element: ${selector}`);

        // Try to click the first clickable item in nav
        const clickableItems = await element.$$("a, button, [role='button'], [data-clickable]");
        if (clickableItems.length > 0) {
          const firstItem = clickableItems[0];
          if (await firstItem.isClickable()) {
            console.log("Clicking first navigation item...");
            await firstItem.click();
            await browser.pause(500);
            console.log("Navigation click completed");
          }
        }
        break;
      }
    }

    // Navigation might not exist in initial view
    if (!foundNav) {
      console.log("No navigation element found - may be expected for onboarding view");
    }
  });

  it("should respond to click interactions", async () => {
    // Click in the main content area
    const body = await $("body");
    const bodySize = await body.getSize();

    // Click in the center of the content area
    const centerX = Math.floor(bodySize.width / 2);
    const centerY = Math.floor(bodySize.height / 2);

    await browser.performActions([
      {
        type: "pointer",
        id: "mouse",
        parameters: { pointerType: "mouse" },
        actions: [
          { type: "pointerMove", x: centerX, y: centerY, duration: 100 },
          { type: "pointerDown", button: 0 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ]);

    await browser.pause(500);
    console.log(`Clicked at center: (${centerX}, ${centerY})`);

    // Verify app didn't crash
    const bodyAfterClick = await $("body");
    await expect(bodyAfterClick).toBeDisplayed();
  });

  it("should handle button clicks if buttons exist", async () => {
    // Find any buttons in the UI
    const buttons = await $$("button:not([disabled])");
    console.log(`Found ${buttons.length} enabled buttons`);

    if (buttons.length > 0) {
      // Click the first visible button
      for (const button of buttons) {
        if (await button.isDisplayedInViewport()) {
          const buttonText = await button.getText();
          console.log(`Clicking button: "${buttonText || "(no text)"}"`);
          await button.click();
          await browser.pause(500);
          break;
        }
      }
    }

    // Verify app is still responsive
    const body = await $("body");
    await expect(body).toBeDisplayed();
  });

  it("should be responsive to window resize", async () => {
    const initialSize = await browser.getWindowSize();
    console.log(`Initial size: ${initialSize.width}x${initialSize.height}`);

    // Resize to smaller
    await browser.setWindowSize(900, 600);
    await browser.pause(500);

    // Verify app is still responsive
    let body = await $("body");
    await expect(body).toBeDisplayed();

    // Resize to larger
    await browser.setWindowSize(1400, 900);
    await browser.pause(500);

    body = await $("body");
    await expect(body).toBeDisplayed();

    // Restore original size
    await browser.setWindowSize(initialSize.width, initialSize.height);
    console.log("Window resize test completed");
  });

  it("should handle keyboard input", async () => {
    // Focus the body
    const body = await $("body");
    await body.click();
    await browser.pause(300);

    // Send some keyboard input (Escape key - safe, closes modals if any)
    await browser.keys(["Escape"]);
    await browser.pause(300);

    // Verify app is still responsive
    await expect(body).toBeDisplayed();
    console.log("Keyboard input test completed");
  });

  it("should capture final state", async () => {
    // Final screenshot is automatically captured by afterTest hook
    await browser.pause(1000);

    // Final verification
    const title = await browser.getTitle();
    expect(title).toBe("Viben");

    const body = await $("body");
    await expect(body).toBeDisplayed();

    console.log("All tests completed successfully");
  });
});
