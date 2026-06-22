import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPage } from "./pages";

describe("pages gateway module", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends empty_body when creating an empty markdown page", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          page: {
            uid: "0623-blank",
            name: "Untitled",
            type: "markdown",
            permission: ["read", "write"],
            path: "/tmp/workspace/pages/0623-blank",
            skill_content: "",
          },
        }),
        {
          status: 201,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await createPage("http://127.0.0.1:18790", {
      workspace_path: "/tmp/workspace",
      name: "Untitled",
      type: "markdown",
      empty_body: true,
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({
      workspace_path: "/tmp/workspace",
      name: "Untitled",
      type: "markdown",
      empty_body: true,
    });
  });
});
