import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Check, AlertCircle, Loader2, Terminal, Copy, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePython } from "@/hooks/use-python";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PythonInfo } from "@/types";

interface StepPythonProps {
  onComplete: () => void;
  onBack?: () => void;
}

export function StepPython({ onComplete, onBack }: StepPythonProps) {
  const { t } = useTranslation();
  const {
    pythons,
    selectedPython,
    browseMcpInfo,
    loading,
    error,
    detectPython,
    checkPythonPath,
    checkBrowseMcp,
    getInstallCommand,
  } = usePython();

  const { setPythonPath } = useAppStore();

  const [customPath, setCustomPath] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [checkingCustom, setCheckingCustom] = useState(false);
  const [installCommand, setInstallCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch install command when Python is selected but package not installed
  useEffect(() => {
    if (selectedPython?.path && browseMcpInfo && !browseMcpInfo.installed) {
      getInstallCommand(selectedPython.path).then(setInstallCommand);
    } else {
      setInstallCommand(null);
    }
  }, [selectedPython, browseMcpInfo, getInstallCommand]);

  const handleSelectPython = async (python: PythonInfo) => {
    // Update the selected Python path in store (triggers usePython to update)
    setPythonPath(python.path);
    await checkBrowseMcp(python.path);
  };

  const handleCustomPath = async () => {
    if (!customPath.trim()) return;

    setCheckingCustom(true);
    setCustomError(null);

    try {
      const info = await checkPythonPath(customPath.trim());
      if (info.is_valid) {
        // Update the selected Python path in store
        setPythonPath(info.path);
        await checkBrowseMcp(info.path);
      } else {
        setCustomError(t("onboarding.python.invalidPath"));
      }
    } catch (err) {
      setCustomError(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckingCustom(false);
    }
  };

  const handleCopy = async () => {
    if (!installCommand) return;
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleContinue = () => {
    // Python path is already persisted in store via setPythonPath
    onComplete();
  };

  const canContinue = selectedPython?.is_valid && browseMcpInfo?.installed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{t("onboarding.python.title")}</h2>
        <p className="mt-2 text-muted-foreground">{t("onboarding.python.description")}</p>
      </div>

      {/* Error display */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Python list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t("onboarding.python.detected")}</Label>
          <Button variant="ghost" size="sm" onClick={() => detectPython(true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.refresh")}
          </Button>
        </div>

        {loading && pythons.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t("onboarding.python.detecting")}
          </div>
        ) : pythons.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            {t("onboarding.python.noPython")}
          </div>
        ) : (
          <div className="space-y-2">
            {pythons.map((python) => (
              <button
                key={python.path}
                onClick={() => handleSelectPython(python)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                  selectedPython?.path === python.path
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50",
                  !python.is_valid && "opacity-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      python.is_valid ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {python.is_valid ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  </div>
                  <div>
                    <div className="font-medium">
                      Python {python.version || t("common.unknown")}
                    </div>
                    <div className="text-xs text-muted-foreground">{python.path}</div>
                  </div>
                </div>
                {!python.is_valid && (
                  <span className="text-xs text-muted-foreground">{t("settings.requires310")}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom path input */}
      <div className="space-y-2">
        <Label>{t("onboarding.python.customPath")}</Label>
        <div className="flex gap-2">
          <Input
            placeholder={t("settings.customPathPlaceholder")}
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            disabled={checkingCustom}
          />
          <Button onClick={handleCustomPath} disabled={checkingCustom || !customPath.trim()}>
            {checkingCustom ? <Loader2 className="h-4 w-4 animate-spin" /> : t("onboarding.python.check")}
          </Button>
        </div>
        {customError && (
          <p className="text-sm text-destructive">{customError}</p>
        )}
      </div>

      {/* Package status */}
      {selectedPython && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">browse-mcp</span>
            {browseMcpInfo?.installed ? (
              <span className="flex items-center gap-1 text-sm text-green-500">
                <CheckCircle2 className="h-4 w-4" />
                {t("settings.installedVersion", { version: browseMcpInfo.version })}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{t("common.notInstalled")}</span>
            )}
          </div>

          {!browseMcpInfo?.installed && installCommand && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("onboarding.python.installHint")}</p>
              <div className="flex items-center gap-2 rounded bg-muted p-2">
                <Terminal className="h-4 w-4 shrink-0 text-muted-foreground" />
                <code className="flex-1 text-sm">{installCommand}</code>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Continue button */}
      <div className="flex justify-between">
        <div>
          {onBack && (
            <Button variant="ghost" onClick={onBack}>
              {t("common.back")}
            </Button>
          )}
        </div>
        <Button onClick={handleContinue} disabled={!canContinue}>
          {t("common.next")}
        </Button>
      </div>

      {/* Skip hint */}
      {!canContinue && selectedPython?.is_valid && !browseMcpInfo?.installed && (
        <p className="text-center text-sm text-muted-foreground">
          {t("onboarding.python.installRequired")}
        </p>
      )}
    </div>
  );
}
