import { mkdtemp, mkdir, symlink, writeFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { describe, expect, it } from "vitest";
import { getPreviewInstallPlan } from "./preview";

async function createTempProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), "viben-preview-"));
}

describe("preview dependency installation", () => {
  it("runs pnpm install when pnpm preview command has broken node_modules links", async () => {
    const workDir = await createTempProject();
    await writeFile(
      join(workDir, "package.json"),
      JSON.stringify({
        scripts: { dev: "next dev" },
        dependencies: { next: "^15.3.2" },
      }),
    );
    await mkdir(join(workDir, "node_modules"), { recursive: true });
    await symlink(join(workDir, "missing-pnpm-store", "next"), join(workDir, "node_modules", "next"));

    const plan = await getPreviewInstallPlan(workDir, "pnpm dev");

    expect(plan.needsInstall).toBe(true);
    expect(plan.packageManager).toBe("pnpm");
    expect(plan.command).toBe("pnpm");
    expect(plan.args).toEqual(["install", "--ignore-workspace"]);
    expect(plan.reason).toContain("next");
  });

  it("skips install when package dependencies resolve from local node_modules", async () => {
    const workDir = await createTempProject();
    await writeFile(
      join(workDir, "package.json"),
      JSON.stringify({
        scripts: { dev: "next dev" },
        dependencies: { next: "^15.3.2" },
      }),
    );
    await mkdir(join(workDir, "node_modules", "next"), { recursive: true });
    await writeFile(join(workDir, "node_modules", "next", "package.json"), "{}");

    const plan = await getPreviewInstallPlan(workDir, "pnpm dev");

    expect(plan.needsInstall).toBe(false);
    expect(plan.packageManager).toBe("pnpm");
  });
});
