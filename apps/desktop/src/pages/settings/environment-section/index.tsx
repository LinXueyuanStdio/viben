import { useState, useCallback, useEffect } from "react";
import {
  RefreshCw,
  Loader2,
  Copy,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/stores";
import { getGatewayClient } from "@/lib/gateway";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { CliToolConfig } from "./constants";
import { CLI_TOOLS } from "./constants";

export function EnvironmentSection() {
  const { t } = useTranslation();

  const appStore = useAppStore();
  const {
    pythonPath, setPythonPath,
    gitPath, setGitPath,
    ghPath, setGhPath,
    claudePath, setClaudePath,
    codexPath, setCodexPath,
    aiderPath, setAiderPath,
    goosePath, setGoosePath,
    clinePath, setClinePath,
    continuePath, setContinuePath,
    cursorPath, setCursorPath,
    cliToolsCache, setCliToolsCache,
  } = appStore;

  // Map tool key to path getter/setter
  const pathMap: Record<string, { value: string; setter: (v: string) => void }> = {
    python: { value: pythonPath, setter: setPythonPath },
    git: { value: gitPath, setter: setGitPath },
    gh: { value: ghPath, setter: setGhPath },
    claude: { value: claudePath, setter: setClaudePath },
    codex: { value: codexPath, setter: setCodexPath },
    aider: { value: aiderPath, setter: setAiderPath },
    goose: { value: goosePath, setter: setGoosePath },
    cline: { value: clinePath, setter: setClinePath },
    continue: { value: continuePath, setter: setContinuePath },
    cursor: { value: cursorPath, setter: setCursorPath },
  };

  // CLI Tools detection state - initialize from cache if available
  const [cliToolsInfo, setCliToolsInfo] = useState<Record<string, { found: boolean; path?: string; version?: string; source: string; message?: string; alternatives?: Array<{ path: string; version?: string; source: string }> } | null>>(() => {
    // Initialize from cache if available (within 24 hours)
    const cacheAge = Date.now() - (cliToolsCache?.timestamp || 0);
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    if (cliToolsCache?.data && cacheAge < CACHE_TTL) {
      return cliToolsCache.data as unknown as Record<string, { found: boolean; path?: string; version?: string; source: string; message?: string; alternatives?: Array<{ path: string; version?: string; source: string }> } | null>;
    }
    return {};
  });
  const [cliToolsLoading, setCliToolsLoading] = useState(false);
  // Note: setCheckingTool removed - not currently used after removing checkCliToolPath
  const [checkingTool] = useState<string | null>(null);

  // Detect CLI tools and update cache
  const detectCliTools = useCallback(async (forceRefresh = false) => {
    // Skip if we have valid cache and not forcing refresh
    const cacheAge = Date.now() - (cliToolsCache?.timestamp || 0);
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    if (!forceRefresh && cliToolsCache?.data && cacheAge < CACHE_TTL) {
      setCliToolsInfo(cliToolsCache.data as unknown as Record<string, { found: boolean; path?: string; version?: string; source: string; message?: string; alternatives?: Array<{ path: string; version?: string; source: string }> } | null>);
      return;
    }

    setCliToolsLoading(true);
    try {
      const client = getGatewayClient();
      const result = await client.detectCliTools({
        pythonPath: pythonPath || undefined,
        gitPath: gitPath || undefined,
        ghPath: ghPath || undefined,
        claudePath: claudePath || undefined,
        codexPath: codexPath || undefined,
        aiderPath: aiderPath || undefined,
        goosePath: goosePath || undefined,
        clinePath: clinePath || undefined,
        continuePath: continuePath || undefined,
        cursorPath: cursorPath || undefined,
      });
      setCliToolsInfo(result as unknown as Record<string, { found: boolean; path?: string; version?: string; source: string; message?: string; alternatives?: Array<{ path: string; version?: string; source: string }> } | null>);
      // Save to cache
      setCliToolsCache(result);
    } catch (err) {
      console.error("[EnvironmentSection] CLI tools detection error:", err);
    } finally {
      setCliToolsLoading(false);
    }
  }, [pythonPath, gitPath, ghPath, claudePath, codexPath, aiderPath, goosePath, clinePath, continuePath, cursorPath, cliToolsCache, setCliToolsCache]);

  // Auto-detect on mount if no valid cache
  useEffect(() => {
    const cacheAge = Date.now() - (cliToolsCache?.timestamp || 0);
    const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
    if (!cliToolsCache?.data || cacheAge >= CACHE_TTL) {
      detectCliTools(true);
    }
  }, []);

  // Helper to translate source names
  const getSourceLabel = (source: string): string => {
    const sourceLabels: Record<string, string> = {
      "user-config": t("settings.cliTools.sourceUserConfig", { defaultValue: "User Configuration" }),
      homebrew: t("settings.cliTools.sourceHomebrew", { defaultValue: "Homebrew" }),
      nvm: t("settings.cliTools.sourceNvm", { defaultValue: "NVM" }),
      pyenv: t("settings.cliTools.sourcePyenv", { defaultValue: "pyenv" }),
      pip: t("settings.cliTools.sourcePip", { defaultValue: "pip" }),
      npm: t("settings.cliTools.sourceNpm", { defaultValue: "npm" }),
      cargo: t("settings.cliTools.sourceCargo", { defaultValue: "cargo" }),
      "system-path": t("settings.cliTools.sourceSystemPath", { defaultValue: "System PATH" }),
      fallback: t("settings.cliTools.sourceFallback", { defaultValue: "Fallback" }),
    };
    return sourceLabels[source] || source;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Render a single CLI tool row with dropdown
  const renderToolRow = (config: CliToolConfig, isFirst: boolean) => {
    const info = cliToolsInfo[config.key];
    const { value: customPath, setter: setCustomPath } = pathMap[config.key] || { value: "", setter: () => {} };
    const Icon = config.icon;
    const isChecking = checkingTool === config.key;
    const isFound = info?.found === true;
    const isLoading = cliToolsLoading || isChecking;

    // Get all discovered paths (primary + alternatives)
    // Backend already returns deduplicated alternatives (excluding primary)
    let allPaths = isFound && info?.path ? [
      { path: info.path, version: info.version, source: info.source },
      ...(info.alternatives || [])
    ] : [];

    // If user has a saved custom path, ensure it's in the list (may have been selected in a previous session)
    if (customPath && !allPaths.some(p => p.path === customPath)) {
      // Add the saved path at the beginning so it shows as selected
      allPaths = [
        { path: customPath, version: undefined, source: "user-config" as const },
        ...allPaths
      ];
    }

    // Determine current selection - use customPath if set, otherwise use primary detected path
    const currentValue = customPath || (isFound ? info?.path || "not-installed" : "not-installed");

    // Find the currently selected path info
    const selectedPathInfo = allPaths.find(p => p.path === currentValue);

    const handleValueChange = (value: string) => {
      if (value === "not-installed") {
        // Do nothing, just show the state
      } else {
        // Always save the selected path
        setCustomPath(value);
      }
    };

    return (
      <div key={config.key} className={cn("flex items-center gap-3 py-2", !isFirst && "border-t")}>
        {/* Status indicator */}
        <div className="flex-shrink-0">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : isFound ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
        </div>

        {/* Tool name and icon */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">
            {t(`settings.cliTools.${config.key}Name`, { defaultValue: config.key.charAt(0).toUpperCase() + config.key.slice(1) })}
          </span>
        </div>

        {/* Dropdown or status */}
        <div className="flex-1">
          <Select value={currentValue} onValueChange={handleValueChange} disabled={isLoading}>
            <SelectTrigger className="h-8 rounded-lg text-xs">
              <SelectValue>
                {isLoading ? (
                  <span className="text-muted-foreground">{t("settings.cliTools.detecting", { defaultValue: "Detecting..." })}</span>
                ) : isFound && selectedPathInfo ? (
                  <span className="text-green-600 truncate max-w-[280px] font-mono text-[11px]">{selectedPathInfo.path}</span>
                ) : (
                  <span className="text-destructive">{t("settings.cliTools.notInstalled", { defaultValue: "Not installed" })}</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-w-[450px]">
              {/* Show all discovered paths */}
              {allPaths.map((pathInfo, index) => (
                <SelectItem key={pathInfo.path} value={pathInfo.path}>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                      <span className="text-xs font-mono truncate max-w-[320px]">{pathInfo.path}</span>
                      {index === 0 && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded flex-shrink-0">
                          {t("settings.cliTools.recommended", { defaultValue: "Recommended" })}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground ml-5">
                      <span>v{pathInfo.version || "?"}</span>
                      <span>•</span>
                      <span>{getSourceLabel(pathInfo.source)}</span>
                    </span>
                  </div>
                </SelectItem>
              ))}
              {/* Show not installed state */}
              {!isFound && (
                <SelectItem value="not-installed" disabled>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-destructive" />
                    <span>{t("settings.cliTools.notInstalled", { defaultValue: "Not installed" })}</span>
                  </div>
                </SelectItem>
              )}
              {/* Show count of discovered paths */}
              {allPaths.length > 1 && (
                <div className="px-2 py-1.5 text-[11px] text-muted-foreground border-t mt-1">
                  {t("settings.cliTools.foundCount", { count: allPaths.length, defaultValue: "{{count}} locations found" })}
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Version badge (when found) */}
        {isFound && !isLoading && selectedPathInfo && (
          <span className="flex-shrink-0 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            v{selectedPathInfo.version || "?"}
          </span>
        )}

        {/* Install hint (when not found) */}
        {!isFound && !isLoading && config.installHint && (
          <Button
            variant="ghost"
            size="sm"
            className="flex-shrink-0 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => copyToClipboard(config.installHint!)}
          >
            <Copy className="h-3 w-3 mr-1" />
            {config.installHint}
          </Button>
        )}
      </div>
    );
  };

  const coreTools = CLI_TOOLS.filter(t => t.category === "core");
  const aiTools = CLI_TOOLS.filter(t => t.category === "ai-assistant");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold font-serif mb-1">
          {t("settings.sections.environment")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("settings.environmentDescription", { defaultValue: "Command-line tools and environment configuration" })}
        </p>
      </div>

      {/* CLI Tools - Core */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">{t("settings.cliTools.coreTitle", { defaultValue: "Core Tools" })}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.cliTools.coreDescription", { defaultValue: "Python, Git, and GitHub CLI" })}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => detectCliTools(true)} disabled={cliToolsLoading}>
            {cliToolsLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t("settings.detect")}
          </Button>
        </div>

        <div className="divide-y">
          {coreTools.map((tool, index) => renderToolRow(tool, index === 0))}
        </div>
      </div>

      {/* CLI Tools - AI Assistants */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">{t("settings.cliTools.aiTitle", { defaultValue: "AI Coding Assistants" })}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("settings.cliTools.aiDescription", { defaultValue: "Claude, Codex, Aider, and other AI tools" })}
            </p>
          </div>
          {/* Show count of installed AI tools */}
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {aiTools.filter(tool => cliToolsInfo[tool.key]?.found).length}/{aiTools.length} {t("settings.cliTools.installed", { defaultValue: "installed" })}
          </span>
        </div>

        <div className="divide-y">
          {aiTools.map((tool, index) => renderToolRow(tool, index === 0))}
        </div>
      </div>
    </div>
  );
}
