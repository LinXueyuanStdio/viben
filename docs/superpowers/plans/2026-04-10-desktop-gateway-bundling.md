# Desktop Gateway Bundling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bundle viben CLI as Tauri sidecar so desktop app works out-of-box without requiring users to install CLI separately.

**Architecture:** Add "viben" to existing CLI tools detection system, create Tauri sidecar configuration, enhance Rust gateway commands to support bundled binary, and add UI for viben CLI selection (similar to Python onboarding).

**Tech Stack:** Tauri sidecar, Node.js SEA (Single Executable Application), TypeScript, React, Rust

---

## File Structure

| File | Responsibility |
|------|----------------|
| `packages/core/src/gateway/routes/python.ts` | Add "viben" to CliToolName, detection logic |
| `apps/desktop/src-tauri/tauri.conf.json` | Sidecar configuration |
| `apps/desktop/src-tauri/src/commands/gateway.rs` | Bundled sidecar path resolution, enhanced start |
| `apps/desktop/src/stores/app-store.ts` | Add vibenPath state |
| `apps/desktop/src/lib/gateway/types/index.ts` | Update CliToolsInfo type |
| `apps/desktop/src/lib/gateway/modules/system.ts` | Add vibenPath to detectCliTools |
| `apps/desktop/src/hooks/use-viben-cli.ts` | New hook for viben CLI management |
| `apps/desktop/src/pages/settings-gateway.tsx` | Add viben CLI selector UI |
| `packages/core/scripts/build-sidecar.mjs` | Build script for sidecar binary |

---

## Task 1: Add "viben" to CLI Tools Detection (Backend)

**Files:**
- Modify: `packages/core/src/gateway/routes/python.ts:66-108`

- [ ] **Step 1: Add "viben" to CliToolName type**

```typescript
// In packages/core/src/gateway/routes/python.ts, find CliToolName type and add "viben"
export type CliToolName =
  | "python"
  | "git"
  | "gh"
  | "claude"
  | "codex"
  | "aider"
  | "goose"
  | "cline"
  | "continue"
  | "cursor"
  | "viben";  // Add this line
```

- [ ] **Step 2: Add "viben" to CliToolsInfo interface**

```typescript
// Find CliToolsInfo interface and add viben field
export interface CliToolsInfo {
  python: CliToolInfo;
  git: CliToolInfo;
  gh: CliToolInfo;
  claude: CliToolInfo;
  codex: CliToolInfo;
  aider: CliToolInfo;
  goose: CliToolInfo;
  cline: CliToolInfo;
  continue: CliToolInfo;
  cursor: CliToolInfo;
  viben: CliToolInfo;  // Add this line
}
```

- [ ] **Step 3: Add "viben" to CliToolsConfig interface**

```typescript
// Find CliToolsConfig interface and add viben field
export interface CliToolsConfig {
  python?: string;
  git?: string;
  gh?: string;
  claude?: string;
  codex?: string;
  aider?: string;
  goose?: string;
  cline?: string;
  continue?: string;
  cursor?: string;
  viben?: string;  // Add this line
}
```

- [ ] **Step 4: Add viben to TOOL_CONFIGS**

```typescript
// Find TOOL_CONFIGS and add viben configuration
const TOOL_CONFIGS: Record<CliToolName, ToolConfig> = {
  // ... existing configs ...
  viben: {
    versionArg: "--version",
    versionRegex: /viben\/(\d+\.\d+\.\d+)/,
    detectMethod: "npm-global",
  },
};
```

- [ ] **Step 5: Update getCliToolCandidates for viben**

Add platform-specific paths in `getCliToolCandidates` function. Find the function and add a new case:

```typescript
// Inside getCliToolCandidates function, after the cursor paths section
if (tool === "viben") {
  if (process.platform === "darwin") {
    candidates.push(
      "/opt/homebrew/bin/viben",
      "/usr/local/bin/viben",
      join(home, ".npm-global/bin/viben"),
    );
  } else if (process.platform === "win32") {
    candidates.push(
      join(home, "AppData/Roaming/npm/viben.cmd"),
      join(home, "scoop/shims/viben.exe"),
    );
  } else {
    // Linux
    candidates.push(
      "/usr/bin/viben",
      "/usr/local/bin/viben",
      join(home, ".npm-global/bin/viben"),
      "/snap/bin/viben",
    );
  }
}
```

- [ ] **Step 6: Update detectAllCliTools to include viben**

Find `detectAllCliTools` function and add viben detection:

```typescript
async function detectAllCliTools(config?: {
  pythonPath?: string;
  gitPath?: string;
  ghPath?: string;
  claudePath?: string;
  codexPath?: string;
  aiderPath?: string;
  goosePath?: string;
  clinePath?: string;
  continuePath?: string;
  cursorPath?: string;
  vibenPath?: string;  // Add this parameter
}): Promise<CliToolsInfo> {
  const selectedPaths = await readCliToolsConfig();

  const [python, git, gh, claude, codex, aider, goose, cline, continueInfo, cursor, viben] = await Promise.all([
    detectCliTool("python", config?.pythonPath),
    detectCliTool("git", config?.gitPath),
    detectCliTool("gh", config?.ghPath),
    detectCliTool("claude", config?.claudePath),
    detectCliTool("codex", config?.codexPath),
    detectCliTool("aider", config?.aiderPath),
    detectCliTool("goose", config?.goosePath),
    detectCliTool("cline", config?.clinePath),
    detectCliTool("continue", config?.continuePath),
    detectCliTool("cursor", config?.cursorPath),
    detectCliTool("viben", config?.vibenPath),  // Add this line
  ]);

  return {
    python: { ...python, selectedPath: selectedPaths.python },
    git: { ...git, selectedPath: selectedPaths.git },
    gh: { ...gh, selectedPath: selectedPaths.gh },
    claude: { ...claude, selectedPath: selectedPaths.claude },
    codex: { ...codex, selectedPath: selectedPaths.codex },
    aider: { ...aider, selectedPath: selectedPaths.aider },
    goose: { ...goose, selectedPath: selectedPaths.goose },
    cline: { ...cline, selectedPath: selectedPaths.cline },
    continue: { ...continueInfo, selectedPath: selectedPaths.continue },
    cursor: { ...cursor, selectedPath: selectedPaths.cursor },
    viben: { ...viben, selectedPath: selectedPaths.viben },  // Add this line
  };
}
```

- [ ] **Step 7: Update /api/cli-tools/detect route**

Find the route handler and add viben_path query parameter:

```typescript
fastify.get<{
  Querystring: {
    python_path?: string;
    git_path?: string;
    gh_path?: string;
    claude_path?: string;
    codex_path?: string;
    aider_path?: string;
    goose_path?: string;
    cline_path?: string;
    continue_path?: string;
    cursor_path?: string;
    viben_path?: string;  // Add this line
  };
}>("/api/cli-tools/detect", async (request) => {
  const {
    python_path,
    git_path,
    gh_path,
    claude_path,
    codex_path,
    aider_path,
    goose_path,
    cline_path,
    continue_path,
    cursor_path,
    viben_path,  // Add this line
  } = request.query;
  const tools = await detectAllCliTools({
    pythonPath: python_path,
    gitPath: git_path,
    ghPath: gh_path,
    claudePath: claude_path,
    codexPath: codex_path,
    aiderPath: aider_path,
    goosePath: goose_path,
    clinePath: cline_path,
    continuePath: continue_path,
    cursorPath: cursor_path,
    vibenPath: viben_path,  // Add this line
  });
  return tools;
});
```

- [ ] **Step 8: Verify build passes**

Run: `cd packages/core && pnpm typecheck`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/gateway/routes/python.ts
git commit -m "feat(core): add viben to CLI tools detection"
```

---

## Task 2: Update Frontend Types

**Files:**
- Modify: `apps/desktop/src/lib/gateway/types/index.ts`

- [ ] **Step 1: Find and update CliToolsInfo type**

Search for `CliToolsInfo` in the types file and add viben:

```typescript
export interface CliToolsInfo {
  python: CliToolInfo;
  git: CliToolInfo;
  gh: CliToolInfo;
  claude: CliToolInfo;
  codex: CliToolInfo;
  aider: CliToolInfo;
  goose: CliToolInfo;
  cline: CliToolInfo;
  continue: CliToolInfo;
  cursor: CliToolInfo;
  viben: CliToolInfo;  // Add this line
}
```

- [ ] **Step 2: Update CliToolName type**

```typescript
export type CliToolName =
  | "python"
  | "git"
  | "gh"
  | "claude"
  | "codex"
  | "aider"
  | "goose"
  | "cline"
  | "continue"
  | "cursor"
  | "viben";  // Add this line
```

- [ ] **Step 3: Update CliToolsConfig type**

```typescript
export interface CliToolsConfig {
  python?: string;
  git?: string;
  gh?: string;
  claude?: string;
  codex?: string;
  aider?: string;
  goose?: string;
  cline?: string;
  continue?: string;
  cursor?: string;
  viben?: string;  // Add this line
}
```

- [ ] **Step 4: Verify build passes**

Run: `cd apps/desktop && pnpm typecheck`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/gateway/types/index.ts
git commit -m "feat(desktop): add viben to CLI tools types"
```

---

## Task 3: Update Gateway Client

**Files:**
- Modify: `apps/desktop/src/lib/gateway/modules/system.ts`

- [ ] **Step 1: Add vibenPath to detectCliTools config parameter**

```typescript
export async function detectCliTools(
  baseUrl: string,
  config?: {
    pythonPath?: string;
    gitPath?: string;
    ghPath?: string;
    claudePath?: string;
    codexPath?: string;
    aiderPath?: string;
    goosePath?: string;
    clinePath?: string;
    continuePath?: string;
    cursorPath?: string;
    vibenPath?: string;  // Add this line
  }
): Promise<CliToolsInfo> {
  const params = new URLSearchParams();
  if (config?.pythonPath) params.append("python_path", config.pythonPath);
  if (config?.gitPath) params.append("git_path", config.gitPath);
  if (config?.ghPath) params.append("gh_path", config.ghPath);
  if (config?.claudePath) params.append("claude_path", config.claudePath);
  if (config?.codexPath) params.append("codex_path", config.codexPath);
  if (config?.aiderPath) params.append("aider_path", config.aiderPath);
  if (config?.goosePath) params.append("goose_path", config.goosePath);
  if (config?.clinePath) params.append("cline_path", config.clinePath);
  if (config?.continuePath) params.append("continue_path", config.continuePath);
  if (config?.cursorPath) params.append("cursor_path", config.cursorPath);
  if (config?.vibenPath) params.append("viben_path", config.vibenPath);  // Add this line

  // ... rest of function unchanged
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd apps/desktop && pnpm typecheck`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/gateway/modules/system.ts
git commit -m "feat(desktop): add vibenPath to gateway client"
```

---

## Task 4: Add vibenPath to App Store

**Files:**
- Modify: `apps/desktop/src/stores/app-store.ts`

- [ ] **Step 1: Add vibenPath to AppState interface**

Find the CLI Tool Paths section (around line 165-185) and add:

```typescript
// CLI Tool Paths (custom user-configured paths)
pythonPath: string;
setPythonPath: (path: string) => void;
// ... existing paths ...
cursorPath: string;
setCursorPath: (path: string) => void;
vibenPath: string;  // Add this line
setVibenPath: (path: string) => void;  // Add this line
```

- [ ] **Step 2: Add vibenPath implementation**

Find the CLI Tool Paths implementation section (around line 509-529) and add:

```typescript
// CLI Tool Paths
pythonPath: "",
setPythonPath: (path) => set({ pythonPath: path }),
// ... existing implementations ...
cursorPath: "",
setCursorPath: (path) => set({ cursorPath: path }),
vibenPath: "",  // Add this line
setVibenPath: (path) => set({ vibenPath: path }),  // Add this line
```

- [ ] **Step 3: Add vibenPath to partialize**

Find the partialize function (around line 540-576) and add vibenPath:

```typescript
partialize: (state) => ({
  // ... existing fields ...
  cursorPath: state.cursorPath,
  vibenPath: state.vibenPath,  // Add this line
  cliToolsCache: state.cliToolsCache,
}),
```

- [ ] **Step 4: Verify build passes**

Run: `cd apps/desktop && pnpm typecheck`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/stores/app-store.ts
git commit -m "feat(desktop): add vibenPath to app store"
```

---

## Task 5: Create use-viben-cli Hook

**Files:**
- Create: `apps/desktop/src/hooks/use-viben-cli.ts`

- [ ] **Step 1: Create the hook file**

```typescript
/**
 * Viben CLI Management Hook
 *
 * Provides viben CLI detection, selection, and gateway management.
 * Similar pattern to use-python.ts.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { CliToolInfo, CliToolPath } from "@/lib/gateway";
import { getGatewayClient } from "@/lib/gateway";
import { useAppStore } from "@/stores";

/** Cache TTL: 24 hours */
const CACHE_TTL = 24 * 60 * 60 * 1000;

export interface VibenCliInfo {
  path: string;
  version: string | null;
  source: string;
  isBundled: boolean;
}

/**
 * Convert CliToolInfo to VibenCliInfo array
 */
function convertToVibenCliInfos(
  vibenInfo: CliToolInfo | undefined,
  bundledPath: string | null
): VibenCliInfo[] {
  if (!vibenInfo?.found || !vibenInfo.path) return [];

  const result: VibenCliInfo[] = [];

  // Add bundled path first if available
  if (bundledPath) {
    result.push({
      path: bundledPath,
      version: null, // Will be detected
      source: "bundled",
      isBundled: true,
    });
  }

  // Add primary detected path (if not same as bundled)
  if (vibenInfo.path !== bundledPath) {
    result.push({
      path: vibenInfo.path,
      version: vibenInfo.version || null,
      source: vibenInfo.source,
      isBundled: false,
    });
  }

  // Add alternatives
  if (vibenInfo.alternatives) {
    for (const alt of vibenInfo.alternatives) {
      if (alt.path !== bundledPath) {
        result.push({
          path: alt.path,
          version: alt.version || null,
          source: alt.source,
          isBundled: false,
        });
      }
    }
  }

  return result;
}

/**
 * Hook for viben CLI detection and management
 */
export function useVibenCli() {
  const {
    cliToolsCache,
    setCliToolsCache,
    vibenPath: userSelectedVibenPath,
    setVibenPath,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bundledPath, setBundledPath] = useState<string | null>(null);
  const [checkingCustom, setCheckingCustom] = useState(false);

  // Get viben info from CLI tools cache
  const vibenCliInfo = cliToolsCache?.data?.viben;

  // Convert to VibenCliInfo array
  const vibenClis: VibenCliInfo[] = useMemo(() => {
    return convertToVibenCliInfos(vibenCliInfo, bundledPath);
  }, [vibenCliInfo, bundledPath]);

  // Currently selected viben CLI
  const selectedViben: VibenCliInfo | null = useMemo(() => {
    if (vibenClis.length === 0) return null;

    // If user has selected a path, use it
    if (userSelectedVibenPath) {
      const found = vibenClis.find((v) => v.path === userSelectedVibenPath);
      if (found) return found;
    }

    // Otherwise use first (bundled if available)
    return vibenClis[0];
  }, [vibenClis, userSelectedVibenPath]);

  // Check if cache is valid
  const isCacheValid = useCallback(() => {
    if (!cliToolsCache?.data || !cliToolsCache.timestamp) return false;
    return Date.now() - cliToolsCache.timestamp < CACHE_TTL;
  }, [cliToolsCache]);

  // Detect viben CLI paths
  const detectVibenCli = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && isCacheValid()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getGatewayClient();
      const result = await client.detectCliTools({
        vibenPath: userSelectedVibenPath || undefined,
      });
      setCliToolsCache(result);
    } catch (err) {
      console.error("[useVibenCli] Detection error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [userSelectedVibenPath, isCacheValid, setCliToolsCache]);

  // Check a custom viben path
  const checkVibenPath = useCallback(async (path: string): Promise<CliToolInfo> => {
    setCheckingCustom(true);
    try {
      const client = getGatewayClient();
      return await client.checkCliToolPath("viben", path);
    } finally {
      setCheckingCustom(false);
    }
  }, []);

  // Select a viben CLI path
  const selectVibenPath = useCallback(async (path: string) => {
    setVibenPath(path);
    // Also save to config file
    try {
      const client = getGatewayClient();
      await client.updateCliToolPath("viben", path);
    } catch (err) {
      console.error("[useVibenCli] Failed to save viben path:", err);
    }
  }, [setVibenPath]);

  // Auto-detect on mount if no valid cache
  useEffect(() => {
    if (!isCacheValid()) {
      detectVibenCli(true);
    }
  }, []);

  return {
    vibenClis,
    selectedViben,
    bundledPath,
    loading,
    error,
    checkingCustom,
    detectVibenCli,
    checkVibenPath,
    selectVibenPath,
    isCacheValid,
  };
}
```

- [ ] **Step 2: Export from hooks index**

Edit `apps/desktop/src/hooks/index.ts` and add:

```typescript
export { useVibenCli } from "./use-viben-cli";
```

- [ ] **Step 3: Verify build passes**

Run: `cd apps/desktop && pnpm typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/hooks/use-viben-cli.ts apps/desktop/src/hooks/index.ts
git commit -m "feat(desktop): add useVibenCli hook"
```

---

## Task 6: Add Viben CLI Selector to Gateway Settings UI

**Files:**
- Modify: `apps/desktop/src/pages/settings-gateway.tsx`

- [ ] **Step 1: Import useVibenCli hook**

Add to the imports at the top:

```typescript
import { useGateway, useVibenCli } from "@/hooks";
```

- [ ] **Step 2: Add hook usage in component**

After the `useGateway` call, add:

```typescript
const {
  vibenClis,
  selectedViben,
  loading: vibenLoading,
  error: vibenError,
  checkingCustom,
  detectVibenCli,
  checkVibenPath,
  selectVibenPath,
} = useVibenCli();

const [customVibenPath, setCustomVibenPath] = useState("");
const [customVibenError, setCustomVibenError] = useState<string | null>(null);
```

- [ ] **Step 3: Add handler for custom path check**

```typescript
const handleCustomVibenPath = async () => {
  if (!customVibenPath.trim()) return;

  setCustomVibenError(null);
  try {
    const info = await checkVibenPath(customVibenPath.trim());
    if (info.found) {
      await selectVibenPath(customVibenPath.trim());
      setCustomVibenPath("");
      toast.success(t("settings.vibenPathSaved", "Viben CLI 路径已保存"));
    } else {
      setCustomVibenError(t("settings.invalidVibenPath", "无效的 Viben CLI 路径"));
    }
  } catch (err) {
    setCustomVibenError(err instanceof Error ? err.message : String(err));
  }
};
```

- [ ] **Step 4: Add Viben CLI selector card**

Add after the Configuration Card section (before the closing `</div>`):

```typescript
{/* Viben CLI Selector Card */}
<div className="rounded-xl border bg-card p-4 space-y-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-muted">
        <Terminal className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">
          {t("settings.vibenCli", "Viben CLI")}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("settings.vibenCliDescription", "选择用于启动网关的 Viben CLI")}
        </p>
      </div>
    </div>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => detectVibenCli(true)}
      disabled={vibenLoading}
    >
      {vibenLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
    </Button>
  </div>

  {vibenError && (
    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{vibenError}</span>
    </div>
  )}

  {/* Detected CLI paths */}
  <div className="pt-3 border-t space-y-2">
    <Label className="text-xs text-muted-foreground">
      {t("settings.detectedPaths", "检测到的路径")}
    </Label>

    {vibenLoading && vibenClis.length === 0 ? (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("settings.detecting", "检测中...")}
      </div>
    ) : vibenClis.length === 0 ? (
      <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        {t("settings.noVibenFound", "未检测到 Viben CLI，请手动指定路径或安装: npm install -g @viben/cli")}
      </div>
    ) : (
      <div className="space-y-1">
        {vibenClis.map((cli) => (
          <button
            key={cli.path}
            onClick={() => selectVibenPath(cli.path)}
            className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
              selectedViben?.path === cli.path
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  cli.isBundled
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-green-500/10 text-green-500"
                }`}
              >
                {selectedViben?.path === cli.path ? (
                  <Check className="h-4 w-4" />
                ) : cli.isBundled ? (
                  <Package className="h-4 w-4" />
                ) : (
                  <Terminal className="h-4 w-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {cli.isBundled ? t("settings.bundled", "内置") : cli.source}
                  </span>
                  {cli.version && (
                    <span className="text-xs px-1.5 py-0.5 bg-muted rounded">
                      v{cli.version}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                  {cli.path}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>

  {/* Custom path input */}
  <div className="pt-3 border-t space-y-2">
    <Label className="text-xs text-muted-foreground">
      {t("settings.customPath", "自定义路径")}
    </Label>
    <div className="flex gap-2">
      <Input
        placeholder={t("settings.vibenPathPlaceholder", "/path/to/viben")}
        value={customVibenPath}
        onChange={(e) => setCustomVibenPath(e.target.value)}
        disabled={checkingCustom}
        className="flex-1 h-9 font-mono text-sm"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleCustomVibenPath}
        disabled={checkingCustom || !customVibenPath.trim()}
      >
        {checkingCustom ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          t("common.check", "检查")
        )}
      </Button>
    </div>
    {customVibenError && (
      <p className="text-sm text-destructive">{customVibenError}</p>
    )}
  </div>
</div>
```

- [ ] **Step 5: Add missing imports**

Add to the lucide-react imports:

```typescript
import {
  // ... existing imports ...
  Terminal,
  Package,
  Check,
} from "lucide-react";
```

- [ ] **Step 6: Verify build passes**

Run: `cd apps/desktop && pnpm typecheck`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/pages/settings-gateway.tsx
git commit -m "feat(desktop): add viben CLI selector to gateway settings"
```

---

## Task 7: Enhance Rust Gateway Commands for Bundled Sidecar

**Files:**
- Modify: `apps/desktop/src-tauri/src/commands/gateway.rs`

- [ ] **Step 1: Add get_bundled_viben_path command**

Add after the existing `find_gateway_binary` function:

```rust
/// Get the path to the bundled viben sidecar binary
#[tauri::command]
pub fn get_bundled_viben_path(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri::Manager;

    // Try to resolve the sidecar binary path
    // Tauri sidecar binaries are named: binaries/viben-<target-triple>
    let sidecar_name = if cfg!(target_os = "windows") {
        "viben"
    } else {
        "viben"
    };

    match app_handle.path().resource_dir() {
        Ok(resource_dir) => {
            // Check multiple possible locations
            let possible_paths = vec![
                resource_dir.join("binaries").join(sidecar_name),
                resource_dir.join(sidecar_name),
            ];

            for path in possible_paths {
                if path.exists() {
                    return Ok(Some(path.to_string_lossy().to_string()));
                }
            }

            Ok(None)
        }
        Err(_) => Ok(None),
    }
}
```

- [ ] **Step 2: Update find_gateway_binary to accept custom path**

Modify the function signature and add custom path support:

```rust
/// Find the gateway binary path
/// Priority: custom_path > bundled sidecar > which viben > known paths > npx viben
fn find_gateway_binary(custom_path: Option<&str>, app_handle: Option<&tauri::AppHandle>) -> Option<(PathBuf, Vec<String>)> {
    // 1. If custom path provided, use it
    if let Some(path) = custom_path {
        let pb = PathBuf::from(path);
        if pb.exists() {
            return Some((pb, vec!["gateway".to_string()]));
        }
    }

    // 2. Try bundled sidecar if app_handle available
    if let Some(handle) = app_handle {
        use tauri::Manager;
        if let Ok(resource_dir) = handle.path().resource_dir() {
            let sidecar_path = resource_dir.join("binaries").join("viben");
            if sidecar_path.exists() {
                return Some((sidecar_path, vec!["gateway".to_string()]));
            }
        }
    }

    // 3. Rest of existing logic (which viben, known paths, npx)
    // ... keep existing code ...
}
```

- [ ] **Step 3: Update start_gateway to use custom path**

Modify the function to accept an optional viben_path parameter:

```rust
/// Start the gateway process
#[tauri::command]
pub async fn start_gateway(
    state: State<'_, GatewayState>,
    app_handle: tauri::AppHandle,
    viben_path: Option<String>,
) -> Result<GatewayStatus, String> {
    let config = state.config.read().await.clone();
    let mut process_guard = state.process.write().await;

    // Check if already running
    if let Some(ref proc) = *process_guard {
        if ping_gateway(&config.host, proc.port).await {
            return Ok(GatewayStatus {
                running: true,
                pid: Some(proc.pid),
                port: proc.port,
                url: format!("http://{}:{}", config.host, proc.port),
                error: None,
            });
        }
        *process_guard = None;
    }

    // Find the gateway binary with custom path support
    let (binary_path, base_args) = find_gateway_binary(
        viben_path.as_deref(),
        Some(&app_handle),
    ).ok_or_else(|| {
        "Gateway binary not found. Please install viben CLI: npm install -g @viben/cli".to_string()
    })?;

    // ... rest of existing start logic ...
}
```

- [ ] **Step 4: Register new command in lib.rs**

Edit `apps/desktop/src-tauri/src/lib.rs` and add the new command to the invoke handler:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing handlers ...
    commands::gateway::get_bundled_viben_path,
])
```

- [ ] **Step 5: Verify build passes**

Run: `cd apps/desktop/src-tauri && cargo check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src-tauri/src/commands/gateway.rs apps/desktop/src-tauri/src/lib.rs
git commit -m "feat(desktop): add bundled sidecar support to gateway commands"
```

---

## Task 8: Configure Tauri Sidecar

**Files:**
- Modify: `apps/desktop/src-tauri/tauri.conf.json`

- [ ] **Step 1: Add externalBin configuration**

Find the `bundle` section and add `externalBin`:

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "externalBin": [
      "binaries/viben"
    ]
  }
}
```

- [ ] **Step 2: Create binaries directory placeholder**

```bash
mkdir -p apps/desktop/src-tauri/binaries
echo "# Sidecar binaries are built during CI/CD" > apps/desktop/src-tauri/binaries/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/binaries/.gitkeep
git commit -m "feat(desktop): configure Tauri sidecar for viben CLI"
```

---

## Task 9: Create Sidecar Build Script

**Files:**
- Create: `packages/core/scripts/build-sidecar.mjs`

- [ ] **Step 1: Create the build script**

```javascript
#!/usr/bin/env node
/**
 * Build viben CLI as a standalone sidecar binary for Tauri
 *
 * Uses Node.js SEA (Single Executable Application) to create
 * platform-native binaries.
 *
 * Usage:
 *   node scripts/build-sidecar.mjs [--target <target>]
 *
 * Targets:
 *   - aarch64-apple-darwin (macOS Apple Silicon)
 *   - x86_64-apple-darwin (macOS Intel)
 *   - x86_64-pc-windows-msvc (Windows)
 *   - x86_64-unknown-linux-gnu (Linux)
 */

import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, existsSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const distDir = join(rootDir, "dist");
const outputDir = join(rootDir, "..", "..", "apps", "desktop", "src-tauri", "binaries");

// Get target from args or detect current platform
const args = process.argv.slice(2);
const targetIndex = args.indexOf("--target");
let target = null;

if (targetIndex !== -1 && args[targetIndex + 1]) {
  target = args[targetIndex + 1];
} else {
  // Detect current platform
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "darwin") {
    target = arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  } else if (platform === "win32") {
    target = "x86_64-pc-windows-msvc";
  } else {
    target = "x86_64-unknown-linux-gnu";
  }
}

const isWindows = target.includes("windows");
const outputName = isWindows ? `viben-${target}.exe` : `viben-${target}`;
const outputPath = join(outputDir, outputName);

console.log(`Building sidecar for target: ${target}`);
console.log(`Output: ${outputPath}`);

// Ensure output directory exists
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// Step 1: Build the CLI with esbuild
console.log("\n1. Building CLI bundle...");
execSync("pnpm build", { cwd: rootDir, stdio: "inherit" });

// Step 2: Create SEA config
console.log("\n2. Creating SEA configuration...");
const seaConfig = {
  main: join(distDir, "cli", "bin.js"),
  output: join(distDir, "sea-prep.blob"),
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: true,
};

const seaConfigPath = join(distDir, "sea-config.json");
writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));

// Step 3: Generate SEA blob
console.log("\n3. Generating SEA blob...");
execSync(`node --experimental-sea-config "${seaConfigPath}"`, {
  cwd: rootDir,
  stdio: "inherit",
});

// Step 4: Copy node binary
console.log("\n4. Preparing node binary...");
const nodeBinary = process.execPath;
const tempBinary = join(distDir, outputName);
copyFileSync(nodeBinary, tempBinary);

// Step 5: Inject SEA blob (platform-specific)
console.log("\n5. Injecting SEA blob...");
const blobPath = join(distDir, "sea-prep.blob");

if (process.platform === "darwin") {
  // macOS: Use postject with codesign removal
  execSync(`codesign --remove-signature "${tempBinary}"`, { stdio: "inherit" });
  execSync(
    `npx postject "${tempBinary}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA`,
    { cwd: rootDir, stdio: "inherit" }
  );
  // Re-sign for macOS
  execSync(`codesign --sign - "${tempBinary}"`, { stdio: "inherit" });
} else if (process.platform === "win32") {
  // Windows: Use postject
  execSync(
    `npx postject "${tempBinary}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
    { cwd: rootDir, stdio: "inherit" }
  );
} else {
  // Linux: Use postject
  execSync(
    `npx postject "${tempBinary}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
    { cwd: rootDir, stdio: "inherit" }
  );
}

// Step 6: Move to output directory
console.log("\n6. Moving to output directory...");
copyFileSync(tempBinary, outputPath);
unlinkSync(tempBinary);

// Make executable on Unix
if (!isWindows) {
  execSync(`chmod +x "${outputPath}"`);
}

console.log(`\nSidecar built successfully: ${outputPath}`);
console.log("\nTo test:");
console.log(`  ${outputPath} --version`);
```

- [ ] **Step 2: Add postject dev dependency**

Edit `packages/core/package.json` and add to devDependencies:

```json
{
  "devDependencies": {
    "postject": "^1.0.0-alpha.6"
  }
}
```

- [ ] **Step 3: Add build script to package.json**

Add to scripts section in `packages/core/package.json`:

```json
{
  "scripts": {
    "build:sidecar": "node scripts/build-sidecar.mjs"
  }
}
```

- [ ] **Step 4: Install dependencies**

Run: `cd packages/core && pnpm install`

- [ ] **Step 5: Commit**

```bash
git add packages/core/scripts/build-sidecar.mjs packages/core/package.json pnpm-lock.yaml
git commit -m "feat(core): add sidecar build script for Tauri"
```

---

## Task 10: Update useGateway Hook for Custom viben Path

**Files:**
- Modify: `apps/desktop/src/hooks/use-gateway.ts`

- [ ] **Step 1: Import useAppStore**

Add to imports:

```typescript
import { useAppStore } from "@/stores";
```

- [ ] **Step 2: Get vibenPath from store**

Inside the `useGateway` function, add:

```typescript
const { vibenPath } = useAppStore();
```

- [ ] **Step 3: Pass vibenPath to startGateway**

Update the `startGateway` callback to pass vibenPath:

```typescript
const startGateway = useCallback(async () => {
  setIsActioning(true);
  setError(null);
  try {
    const result = await invoke<GatewayStatus>("start_gateway", {
      vibenPath: vibenPath || null,
    });
    setStatus(result);
    if (result.error) {
      setError(result.error);
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setIsActioning(false);
  }
}, [vibenPath]);
```

- [ ] **Step 4: Verify build passes**

Run: `cd apps/desktop && pnpm typecheck`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/hooks/use-gateway.ts
git commit -m "feat(desktop): pass vibenPath to gateway start command"
```

---

## Task 11: Integration Test

**Files:**
- None (manual testing)

- [ ] **Step 1: Build packages**

Run: `pnpm build`
Expected: All packages build successfully

- [ ] **Step 2: Start gateway manually**

Run: `viben gateway`
Expected: Gateway starts on port 18790

- [ ] **Step 3: Start desktop app**

Run: `cd apps/desktop && pnpm tauri dev`
Expected: App launches without errors

- [ ] **Step 4: Test viben CLI detection**

1. Open Settings > Gateway
2. Verify "Viben CLI" section shows detected paths
3. Verify current gateway status is shown

- [ ] **Step 5: Test custom path**

1. Enter a custom path in the input
2. Click "Check"
3. Verify validation works

- [ ] **Step 6: Test gateway start/stop with selected CLI**

1. Stop gateway if running
2. Select a detected viben CLI path
3. Click "Start"
4. Verify gateway starts successfully

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "test: verify desktop gateway bundling integration"
```

---

## Summary

| Task | Description | Est. Time |
|------|-------------|-----------|
| 1 | Add "viben" to CLI tools detection (backend) | 15 min |
| 2 | Update frontend types | 5 min |
| 3 | Update gateway client | 5 min |
| 4 | Add vibenPath to app store | 5 min |
| 5 | Create use-viben-cli hook | 15 min |
| 6 | Add viben CLI selector UI | 20 min |
| 7 | Enhance Rust gateway commands | 20 min |
| 8 | Configure Tauri sidecar | 5 min |
| 9 | Create sidecar build script | 15 min |
| 10 | Update useGateway hook | 5 min |
| 11 | Integration test | 15 min |
| **Total** | | **~2 hours** |
