/**
 * Startup issue dialog for system-level problems
 *
 * Qclaw 参考: /Users/lxy/Documents/GitHub/others/Qclaw/src/pages/EnvCheck.tsx (StartupIssueDialog)
 */

import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw, ExternalLink, Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CliInstallerIssueKind } from "@/lib/onboarding/installer-issues";

// ============================================================================
// Props
// ============================================================================

interface StartupIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issueKind: CliInstallerIssueKind;
  onRetry: () => void;
  isRetrying?: boolean;
}

// ============================================================================
// Issue Content
// ============================================================================

interface IssueContent {
  titleKey: string;
  descriptionKey: string;
  stepsKeys: string[];
  showTerminalHint?: boolean;
  externalLink?: { url: string; labelKey: string };
}

function getIssueContent(kind: CliInstallerIssueKind): IssueContent {
  switch (kind) {
    case "xcode-clt-pending":
      return {
        titleKey: "onboarding.issues.xcodeClt.title",
        descriptionKey: "onboarding.issues.xcodeClt.description",
        stepsKeys: [
          "onboarding.issues.xcodeClt.step1",
          "onboarding.issues.xcodeClt.step2",
          "onboarding.issues.xcodeClt.step3",
          "onboarding.issues.xcodeClt.step4",
        ],
        showTerminalHint: true,
      };

    case "missing-node":
      return {
        titleKey: "onboarding.issues.missingNode.title",
        descriptionKey: "onboarding.issues.missingNode.description",
        stepsKeys: [
          "onboarding.issues.missingNode.step1",
          "onboarding.issues.missingNode.step2",
          "onboarding.issues.missingNode.step3",
          "onboarding.issues.missingNode.step4",
        ],
        externalLink: {
          url: "https://nodejs.org/",
          labelKey: "onboarding.issues.missingNode.downloadLabel",
        },
      };

    case "permission-denied":
      return {
        titleKey: "onboarding.issues.permissionDenied.title",
        descriptionKey: "onboarding.issues.permissionDenied.description",
        stepsKeys: [
          "onboarding.issues.permissionDenied.step1",
          "onboarding.issues.permissionDenied.step2",
          "onboarding.issues.permissionDenied.step3",
        ],
        showTerminalHint: true,
        externalLink: {
          url: "https://github.com/nvm-sh/nvm",
          labelKey: "onboarding.issues.permissionDenied.nvmLabel",
        },
      };

    case "network-error":
    case "npm-registry-error":
      return {
        titleKey: "onboarding.issues.networkError.title",
        descriptionKey: "onboarding.issues.networkError.description",
        stepsKeys: [
          "onboarding.issues.networkError.step1",
          "onboarding.issues.networkError.step2",
          "onboarding.issues.networkError.step3",
          "onboarding.issues.networkError.step4",
        ],
      };

    default:
      return {
        titleKey: "onboarding.issues.unknown.title",
        descriptionKey: "onboarding.issues.unknown.description",
        stepsKeys: [
          "onboarding.issues.unknown.step1",
          "onboarding.issues.unknown.step2",
          "onboarding.issues.unknown.step3",
        ],
        externalLink: {
          url: "https://github.com/LinXueyuanStdio/viben/issues",
          labelKey: "onboarding.issues.unknown.reportLabel",
        },
      };
  }
}

// ============================================================================
// Component
// ============================================================================

export function StartupIssueDialog({
  open,
  onOpenChange,
  issueKind,
  onRetry,
  isRetrying,
}: StartupIssueDialogProps) {
  const { t } = useTranslation();
  const content = getIssueContent(issueKind);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            </div>
            <DialogTitle>{t(content.titleKey)}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            {t(content.descriptionKey)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Steps */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("onboarding.issues.stepsTitle")}</p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-muted-foreground">
              {content.stepsKeys.map((stepKey, index) => (
                <li key={index}>{t(stepKey)}</li>
              ))}
            </ol>
          </div>

          {/* Terminal hint */}
          {content.showTerminalHint && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {t("onboarding.issues.terminalHint")}{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  xcode-select --install
                </code>
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {content.externalLink && (
            <Button variant="outline" asChild>
              <a
                href={content.externalLink.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                {t(content.externalLink.labelKey)}
              </a>
            </Button>
          )}
          <Button onClick={onRetry} disabled={isRetrying}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
            />
            {isRetrying ? t("onboarding.issues.detecting") : t("onboarding.issues.retryDetect")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
