import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolvePageRelativePath } from "./page-paths";

const SKILL_FILE = "SKILL.md";

export function writeTemplateFilesToPageDir(
  pageDir: string,
  files: Map<string, string>
): void {
  const plannedFiles = Array.from(files, ([filePath, content]) => {
    const outputPath = filePath === SKILL_FILE ? SKILL_FILE : filePath;
    return {
      outputPath,
      content,
      finalPath: resolvePageRelativePath(pageDir, outputPath),
    };
  });

  const stagingDir = mkdtempSync(join(pageDir, ".template-staging-"));
  const backups = plannedFiles.map((file) => ({
    finalPath: file.finalPath,
    existed: existsSync(file.finalPath),
    content: existsSync(file.finalPath) ? readFileSync(file.finalPath) : undefined,
  }));
  const stagedFiles: Array<{ stagedPath: string; finalPath: string }> = [];

  try {
    for (const file of plannedFiles) {
      const stagedPath = join(stagingDir, file.outputPath);
      const parentDir = dirname(stagedPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      writeFileSync(stagedPath, file.content, "utf-8");
      stagedFiles.push({ stagedPath, finalPath: file.finalPath });
    }

    for (const { stagedPath, finalPath } of stagedFiles) {
      const parentDir = dirname(finalPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      renameSync(stagedPath, finalPath);
    }
  } catch (error) {
    for (const backup of backups) {
      if (backup.existed && backup.content) {
        writeFileSync(backup.finalPath, backup.content);
      } else {
        rmSync(backup.finalPath, { force: true });
      }
    }
    throw error;
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}
