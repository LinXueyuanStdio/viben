import type { AcpErrorDetail } from "../types";

const DETAIL_KEYS = [
  "code",
  "exitCode",
  "signal",
  "stdout",
  "stderr",
  "details",
  "claudePath",
  "claudeConfigDir",
  "path",
  "errno",
  "syscall",
  "command",
  "args",
  "cwd",
  "cwdExists",
  "hint",
  "resolution",
  "requestedCommand",
  "resolvedCommand",
  "resolvedArgs",
  "attemptedPackage",
  "attemptedPackageEntry",
  "packageResolveError",
  "localBin",
  "localBinExists",
  "pathEnv",
  "installHint",
  "output",
  "status",
];

export class AcpPromptError extends Error {
  readonly detail: AcpErrorDetail;

  constructor(detail: AcpErrorDetail) {
    super(detail.message);
    this.name = "AcpPromptError";
    this.detail = detail;
  }
}

export function normalizeAcpError(error: unknown): AcpErrorDetail {
  return normalizeAcpErrorInternal(error, new WeakSet<object>());
}

export function createAcpErrorDetail(message: string, extras: Record<string, unknown> = {}): AcpErrorDetail {
  const detail: AcpErrorDetail = {
    message,
  };
  for (const [key, value] of Object.entries(extras)) {
    if (value !== undefined) {
      detail[key] = normalizeValue(value, new WeakSet<object>());
    }
  }
  return detail;
}

export function getAcpErrorDetail(error: unknown): AcpErrorDetail {
  if (error instanceof AcpPromptError) {
    return error.detail;
  }
  return normalizeAcpError(error);
}

function normalizeAcpErrorInternal(error: unknown, seen: WeakSet<object>): AcpErrorDetail {
  if (error instanceof Error) {
    if (seen.has(error)) {
      return { message: error.message };
    }
    seen.add(error);

    const detail: AcpErrorDetail = {
      message: error.message,
      name: error.name,
    };
    if (error.stack) {
      detail.stack = error.stack;
    }

    const errorRecord = error as Error & Record<string, unknown> & { cause?: unknown };
    for (const key of DETAIL_KEYS) {
      const value = errorRecord[key];
      if (value !== undefined) {
        detail[key] = normalizeValue(value, seen);
      }
    }
    if (errorRecord.cause !== undefined) {
      detail.cause = normalizeAcpErrorInternal(errorRecord.cause, seen);
    }
    if (errorRecord.error !== undefined) {
      detail.error = normalizeValue(errorRecord.error, seen);
    }

    return detail;
  }

  if (typeof error === "object" && error !== null) {
    if (seen.has(error)) {
      return { message: "[Circular error]" };
    }
    seen.add(error);

    const record = error as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message : safeStringify(error);
    const detail: AcpErrorDetail = { message };

    for (const [key, value] of Object.entries(record)) {
      if (value !== undefined) {
        detail[key] = key === "cause"
          ? normalizeAcpErrorInternal(value, seen)
          : normalizeValue(value, seen);
      }
    }
    if (typeof record.name === "string") {
      detail.name = record.name;
    }

    return detail;
  }

  return { message: String(error) };
}

function normalizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value instanceof Error) {
    return normalizeAcpErrorInternal(value, seen);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item, seen));
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    normalized[key] = normalizeValue(item, seen);
  }
  return normalized;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
