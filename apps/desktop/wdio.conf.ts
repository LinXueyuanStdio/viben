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
    timeout: 60000,
  },

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

  afterTest: async function (test) {
    const fs = await import("fs/promises");
    await fs.mkdir("./test-screenshots", { recursive: true });
    const name = test.title.replace(/[^a-zA-Z0-9]/g, "-");
    await browser.saveScreenshot(`./test-screenshots/${name}.png`);
  },
};
