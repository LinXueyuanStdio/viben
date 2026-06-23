import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
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

  it("POST /api/page/apply-template applies a template to an empty markdown page", async () => {
    const app = Fastify({ logger: false });
    registerPageRoutes(app);
    await app.ready();
    const workspacePath = createWorkspace();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/page/create",
      payload: {
        workspace_path: workspacePath,
        slug: "template-doc",
        type: "markdown",
      },
    });
    const created = createResponse.json();

    const response = await app.inject({
      method: "POST",
      url: "/api/page/apply-template",
      payload: {
        workspace_path: workspacePath,
        uid: created.page.uid,
        template_id: "markdown-docs",
      },
    });

    try {
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.page.skill_content).toContain("## Getting Started");
    } finally {
      await app.close();
    }
  });

  it("POST /api/page/apply-template rejects unsafe page uids", async () => {
    const app = Fastify({ logger: false });
    registerPageRoutes(app);
    await app.ready();
    const workspacePath = createWorkspace();

    const response = await app.inject({
      method: "POST",
      url: "/api/page/apply-template",
      payload: {
        workspace_path: workspacePath,
        uid: "../secret",
        template_id: "markdown-docs",
      },
    });

    try {
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("Invalid page uid");
    } finally {
      await app.close();
    }
  });

  it("POST /api/page/asset/upload rejects unsafe filenames", async () => {
    const app = Fastify({ logger: false });
    await app.register(fastifyMultipart, { preservePath: true });
    registerPageRoutes(app);
    await app.ready();
    const workspacePath = createWorkspace();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/page/create",
      payload: {
        workspace_path: workspacePath,
        slug: "asset-doc",
        type: "markdown",
      },
    });
    const created = createResponse.json();

    const form = new FormData();
    form.append("workspace_path", workspacePath);
    form.append("uid", created.page.uid);
    form.append("file", new Blob(["x"], { type: "image/png" }), "../secret.png");

    const response = await app.inject({
      method: "POST",
      url: "/api/page/asset/upload",
      payload: form,
    });

    try {
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain("Invalid asset filename");
    } finally {
      await app.close();
    }
  });
});
