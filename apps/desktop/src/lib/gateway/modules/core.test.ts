import { describe, expect, it } from "vitest";
import { parseErrorMessage } from "./core";

describe("parseErrorMessage", () => {
  it("includes gateway error details when present", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        error: "Failed to publish page",
        details: {
          error: "Failed to publish page",
          details: "column users.user_slug does not exist",
        },
      }),
      {
        status: 500,
        statusText: "Internal Server Error",
        headers: { "content-type": "application/json" },
      }
    );

    await expect(parseErrorMessage(response)).resolves.toBe(
      "Failed to publish page: column users.user_slug does not exist"
    );
  });
});
