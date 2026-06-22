import Fastify from "fastify";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";
import { registerPageRoutes } from "./page";

const workspaces: string[] = [];

function createWorkspace(): string {
  const workspacePath = mkdtempSync(join(tmpdir(), "viben-page-route-"));
  workspaces.push(workspacePath);
  return workspacePath;
}

afterEach(() => {
  for (const workspacePath of workspaces.splice(0)) {
    rmSync(workspacePath, { recursive: true, force: true });
  }
});

describe("page routes", () => {
  it("POST /api/page/create creates an empty markdown page by default", async () => {
    const app = Fastify({ logger: false });
    registerPageRoutes(app);
    await app.ready();
    const workspacePath = createWorkspace();

    const response = await app.inject({
      method: "POST",
      url: "/api/page/create",
      payload: {
        workspace_path: workspacePath,
        slug: "blank-doc",
        type: "markdown",
      },
    });

    try {
      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.page.skill_content).toBe("");

      const raw = readFileSync(join(body.page.path, "SKILL.md"), "utf-8");
      expect(matter(raw).content.trim()).toBe("");
    } finally {
      await app.close();
    }
  });
});
