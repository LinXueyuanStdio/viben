import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

const PAGES_DIR = "pages";
const ASSETS_DIR = "_assets";

export function assertSafePageUid(uid: string): void {
  if (
    !uid ||
    uid === "." ||
    uid === ".." ||
    uid.includes("..") ||
    uid.includes("/") ||
    uid.includes("\\")
  ) {
    throw new Error(`Invalid page uid: ${uid}`);
  }
}

export function assertInside(parent: string, child: string, label: string): void {
  const relativePath = relative(resolve(parent), resolve(child));
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
    return;
  }
  throw new Error(`${label} escapes page directory`);
}

function assertRealInside(parent: string, child: string, label: string): void {
  const realParent = realpathSync(parent);
  const realChild = realpathSync(child);
  const relativePath = relative(realParent, realChild);
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
    return;
  }
  throw new Error(`${label} escapes page directory`);
}

export function resolvePageDir(workspacePath: string, uid: string): string {
  assertSafePageUid(uid);
  const pagesDir = resolve(workspacePath, PAGES_DIR);
  const pageDir = resolve(pagesDir, uid);
  assertInside(pagesDir, pageDir, "Page directory");
  return pageDir;
}

export function resolveExistingPageDir(workspacePath: string, uid: string): string {
  const pagesDir = resolve(workspacePath, PAGES_DIR);
  const pageDir = resolvePageDir(workspacePath, uid);
  if (!existsSync(pageDir)) {
    throw new Error(`Page directory does not exist: ${uid}`);
  }
  assertRealInside(pagesDir, pageDir, "Page directory");
  return pageDir;
}

export function resolvePageRelativePath(pageDir: string, filePath: string): string {
  if (!filePath || isAbsolute(filePath)) {
    throw new Error(`Template file path must be a relative path: ${filePath}`);
  }
  const target = resolve(pageDir, filePath);
  assertInside(pageDir, target, "Template file path");
  const parent = resolve(target, "..");
  mkdirSync(parent, { recursive: true });
  assertRealInside(pageDir, parent, "Template file path");
  return target;
}

export function resolvePageAssetPath(
  pageDir: string,
  filename: string
): { assetsDir: string; filePath: string; filename: string } {
  if (
    !filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("..") ||
    isAbsolute(filename)
  ) {
    throw new Error(`Invalid asset filename: ${filename}`);
  }
  const uniqueFilename = `${Date.now()}-${filename}`;
  const filePath = resolvePageRelativePath(pageDir, `${ASSETS_DIR}/${uniqueFilename}`);
  const assetsDir = dirname(filePath);
  return { assetsDir, filePath, filename: uniqueFilename };
}
