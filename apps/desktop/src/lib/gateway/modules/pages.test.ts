import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyPageTemplate, createPage } from "./pages";

describe("pages gateway module", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("omits title and initial content when creating an empty markdown page", async () => {
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
      type: "markdown",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({
      workspace_path: "/tmp/workspace",
      type: "markdown",
    });
  });

  it("posts snake_case body when applying a page template", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          page: {
            uid: "0623-blank",
            name: "",
            type: "markdown",
            permission: ["read", "write"],
            path: "/tmp/workspace/pages/0623-blank",
            skill_content: "## Getting Started",
          },
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await applyPageTemplate("http://127.0.0.1:18790", {
      workspace_path: "/tmp/workspace",
      uid: "0623-blank",
      template_id: "markdown-docs",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:18790/api/page/apply-template",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          workspace_path: "/tmp/workspace",
          uid: "0623-blank",
          template_id: "markdown-docs",
        }),
      })
    );
  });
});
