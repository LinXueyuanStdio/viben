/**
 * Installer issue types and error classification
 *
 * Qclaw reference: /Users/lxy/Documents/GitHub/others/Qclaw/src/shared/node-installer-issues.ts
 */

import i18next from "i18next";

// ============================================================================
// CLI Installer Issue Types (14 types)
// ============================================================================

export type CliInstallerIssueKind =
  | "missing-cli"              // CLI not installed
  | "version-too-low"          // Version too low
  | "version-too-high"         // Version too high (may be incompatible)
  | "missing-node"             // Node.js not installed
  | "node-version-mismatch"    // Node.js version mismatch
  | "npm-not-found"            // npm not found
  | "npm-registry-error"       // npm registry error
  | "download-failed"          // Download failed
  | "install-failed"           // Install failed
  | "permission-denied"        // Permission denied
  | "user-cancelled"           // User cancelled
  | "network-error"            // Network error
  | "xcode-clt-pending"        // macOS: Xcode CLT pending installation
  | "unknown-error";           // Unknown error

// ============================================================================
// CLI Installer Issue Structure
// ============================================================================

export interface CliInstallerIssue {
  kind: CliInstallerIssueKind;
  title: string;
  message: string;
  details?: string;
  /** Whether it blocks the flow */
  blocking: boolean;
  /** Suggested actions */
  suggestedActions: SuggestedAction[];
}

export type SuggestedAction =
  | { type: "retry" }
  | { type: "skip" }
  | { type: "manual-download"; url: string }
  | { type: "open-link"; url: string; label: string }
  | { type: "run-command"; command: string; label: string }
  | { type: "contact-support" };

// ============================================================================
// Issue Factory
// ============================================================================

export function createCliInstallerIssue(
  kind: CliInstallerIssueKind,
  details?: string
): CliInstallerIssue {
  return {
    kind,
    ...getIssueContent(kind),
    details,
    blocking: isBlockingIssue(kind),
    suggestedActions: getSuggestedActions(kind),
  };
}

function getIssueContent(kind: CliInstallerIssueKind): { title: string; message: string } {
  const t = i18next.t.bind(i18next);
  switch (kind) {
    case "missing-cli":
      return {
        title: t("onboarding.installerIssues.missingCli.title", "Viben CLI not installed"),
        message: t("onboarding.installerIssues.missingCli.message", "Viben CLI needs to be installed to continue. The system will attempt automatic installation."),
      };
    case "version-too-low":
      return {
        title: t("onboarding.installerIssues.versionTooLow.title", "Viben CLI version too low"),
        message: t("onboarding.installerIssues.versionTooLow.message", "The installed Viben CLI version does not meet minimum requirements and needs to be upgraded."),
      };
    case "version-too-high":
      return {
        title: t("onboarding.installerIssues.versionTooHigh.title", "Viben CLI version too high"),
        message: t("onboarding.installerIssues.versionTooHigh.message", "The installed Viben CLI version may not be compatible with this application."),
      };
    case "missing-node":
      return {
        title: t("onboarding.installerIssues.missingNode.title", "Node.js not installed"),
        message: t("onboarding.installerIssues.missingNode.message", "Viben CLI requires Node.js runtime. Please install Node.js first."),
      };
    case "node-version-mismatch":
      return {
        title: t("onboarding.installerIssues.nodeVersionMismatch.title", "Node.js version mismatch"),
        message: t("onboarding.installerIssues.nodeVersionMismatch.message", "Current Node.js version does not meet requirements. Recommend using Node.js 18 or higher."),
      };
    case "npm-not-found":
      return {
        title: t("onboarding.installerIssues.npmNotFound.title", "npm not found"),
        message: t("onboarding.installerIssues.npmNotFound.message", "Cannot find npm command. Please ensure Node.js is installed correctly."),
      };
    case "npm-registry-error":
      return {
        title: t("onboarding.installerIssues.npmRegistryError.title", "npm registry error"),
        message: t("onboarding.installerIssues.npmRegistryError.message", "Cannot connect to npm registry. Will try using mirror sources."),
      };
    case "download-failed":
      return {
        title: t("onboarding.installerIssues.downloadFailed.title", "Download failed"),
        message: t("onboarding.installerIssues.downloadFailed.message", "Failed to download Viben CLI. Please check network connection and retry."),
      };
    case "install-failed":
      return {
        title: t("onboarding.installerIssues.installFailed.title", "Install failed"),
        message: t("onboarding.installerIssues.installFailed.message", "Failed to install Viben CLI. Please check detailed error information."),
      };
    case "permission-denied":
      return {
        title: t("onboarding.installerIssues.permissionDenied.title", "Permission denied"),
        message: t("onboarding.installerIssues.permissionDenied.message", "Installation requires higher permissions. Please run as administrator or install manually."),
      };
    case "user-cancelled":
      return {
        title: t("onboarding.installerIssues.userCancelled.title", "Cancelled"),
        message: t("onboarding.installerIssues.userCancelled.message", "Installation was cancelled."),
      };
    case "network-error":
      return {
        title: t("onboarding.installerIssues.networkError.title", "Network error"),
        message: t("onboarding.installerIssues.networkError.message", "Network connection failed. Please check network settings and retry."),
      };
    case "xcode-clt-pending":
      return {
        title: t("onboarding.installerIssues.xcodeCltPending.title", "Waiting for Xcode Command Line Tools installation"),
        message: t("onboarding.installerIssues.xcodeCltPending.message", "Xcode command line tools installation has been triggered. Please complete the installation in the system dialog, then click retry."),
      };
    case "unknown-error":
    default:
      return {
        title: t("onboarding.installerIssues.unknownError.title", "Unknown error"),
        message: t("onboarding.installerIssues.unknownError.message", "An unknown error occurred. Please check details or contact support."),
      };
  }
}

function isBlockingIssue(kind: CliInstallerIssueKind): boolean {
  // These errors do not block the flow, can be skipped
  const nonBlockingIssues: CliInstallerIssueKind[] = [
    "version-too-high",
    "user-cancelled",
  ];
  return !nonBlockingIssues.includes(kind);
}

function getSuggestedActions(kind: CliInstallerIssueKind): SuggestedAction[] {
  switch (kind) {
    case "missing-cli":
    case "version-too-low":
      return [{ type: "retry" }];
    case "version-too-high":
      return [{ type: "skip" }, { type: "retry" }];
    case "missing-node":
      return [
        { type: "open-link", url: "https://nodejs.org/", label: i18next.t("onboarding.installerIssues.downloadNodejs", "Download Node.js") },
        { type: "retry" },
      ];
    case "npm-registry-error":
    case "network-error":
    case "download-failed":
      return [{ type: "retry" }];
    case "install-failed":
    case "permission-denied":
      return [
        { type: "manual-download", url: "https://github.com/LinXueyuanStdio/viben" },
        { type: "retry" },
      ];
    case "user-cancelled":
      return [{ type: "retry" }, { type: "skip" }];
    case "xcode-clt-pending":
      return [{ type: "retry" }];
    case "unknown-error":
    default:
      return [{ type: "retry" }, { type: "contact-support" }];
  }
}

// ============================================================================
// Error Classification from Raw Error
// ============================================================================

/**
 * Classify error type from raw error message
 *
 * Qclaw reference: classifyMacNodeInstallerFailure in node-installer-issues.ts:176-230
 */
export function classifyInstallerError(rawError: string): CliInstallerIssueKind {
  const normalized = rawError.toLowerCase();

  // User cancelled
  if (normalized.includes("user canceled") || normalized.includes("(-128)") || normalized.includes("cancelled")) {
    return "user-cancelled";
  }

  // Permission issues
  if (normalized.includes("permission denied") || normalized.includes("eacces") || normalized.includes("eperm")) {
    return "permission-denied";
  }

  // Network issues
  if (
    normalized.includes("network") ||
    normalized.includes("enotfound") ||
    normalized.includes("etimedout") ||
    normalized.includes("econnrefused") ||
    normalized.includes("econnreset")
  ) {
    return "network-error";
  }

  // npm registry issues
  if (normalized.includes("npm err") || normalized.includes("registry")) {
    return "npm-registry-error";
  }

  // Xcode CLT (macOS)
  if (
    normalized.includes("xcode-select") ||
    normalized.includes("command line tools") ||
    normalized.includes("developer tools")
  ) {
    return "xcode-clt-pending";
  }

  // Download failed
  if (normalized.includes("download") || normalized.includes("fetch")) {
    return "download-failed";
  }

  return "unknown-error";
}
