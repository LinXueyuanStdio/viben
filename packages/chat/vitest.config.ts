import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@emoji-mart/data/sets/15/native.json",
        replacement: "/root/viben/packages/chat/src/__tests__/fixtures/emoji-data.ts",
      },
      {
        find: "@emoji-mart/data",
        replacement: "/root/viben/packages/chat/src/__tests__/fixtures/emoji-data.ts",
      },
    ],
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.{ts,tsx}", "src/**/__tests__/**/*.test.{ts,tsx}"],
  },
});
