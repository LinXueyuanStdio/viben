import type { Options } from "@wdio/types";

export const config: Options.Testrunner = {
  runner: "local",
  port: 4444, // tauri-driver default port

  specs: ["./test/e2e/**/*.spec.ts"],

  capabilities: [
    {
      "tauri:options": {
        application: process.env.TAURI_APP_PATH,
      },
    },
  ],

  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 120000, // 2 minutes per test
  },

  // Connection timeout for WebDriver
  connectionRetryTimeout: 30000,
  connectionRetryCount: 3,

  reporters: [
    "spec",
    [
      "junit",
      {
        outputDir: "./",
        outputFileFormat: () => "wdio-results.xml",
      },
    ],
  ],

  afterTest: async function (test, _context, result) {
    const fs = await import("fs/promises");
    await fs.mkdir("./test-screenshots", { recursive: true });
    const name = test.title.replace(/[^a-zA-Z0-9]/g, "-");

    // Try to take screenshot, but don't fail the test if it times out
    try {
      // Set a shorter timeout for screenshots
      const screenshotPromise = browser.saveScreenshot(
        `./test-screenshots/${name}.png`
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Screenshot timeout")), 5000)
      );

      await Promise.race([screenshotPromise, timeoutPromise]);
    } catch (err) {
      console.warn(
        `Warning: Could not save screenshot for "${test.title}":`,
        (err as Error).message
      );
    }

    // If test failed, log the error
    if (result.error) {
      console.error(`Test "${test.title}" failed:`, result.error.message);
    }
  },
};
