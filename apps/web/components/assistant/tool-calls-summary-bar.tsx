"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { cn } from "@/lib/utils";

type StatusWordPair = {
  present: string;
  past: string;
};

const STATUS_WORD_PAIRS: StatusWordPair[] = [
  { present: "statusPonderingPresent", past: "statusPonderingPast" },
  { present: "statusCraftingPresent", past: "statusCraftingPast" },
  { present: "statusVibingPresent", past: "statusVibingPast" },
  { present: "statusSimmeringPresent", past: "statusSimmeringPast" },
  { present: "statusMarinatingPresent", past: "statusMarinatingPast" },
  { present: "statusPhilosophisingPresent", past: "statusPhilosophisingPast" },
  { present: "statusRuminatingPresent", past: "statusRuminatingPast" },
];

function hashString(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }

  return hash;
}

function getStatusWordPair(seed: string | null): StatusWordPair {
  if (!seed) {
    return STATUS_WORD_PAIRS[0];
  }

  return STATUS_WORD_PAIRS[hashString(seed) % STATUS_WORD_PAIRS.length];
}

function formatElapsedTime(seconds: number, t: TFunction): string {
  if (seconds < 60) {
    return t("assistant.toolSummary.timeSeconds", { seconds });
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (secs === 0) {
    return t("assistant.toolSummary.timeMinutes", { minutes: mins });
  }
  return t("assistant.toolSummary.timeMinutesSeconds", {
    minutes: mins,
    seconds: secs,
  });
}

function renderSegments(segments: string[]) {
  return segments.map((segment, i) => (
    <span key={i}>
      <span className="text-muted-foreground/40"> · </span>
      {segment}
    </span>
  ));
}

export function ToolCallsSummaryBar({
  isExpanded,
  onToggle,
  isStreaming,
  toolCallCount,
  changedFiles,
  durationMs,
  startedAt,
  statusWordSeed,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  isStreaming: boolean;
  toolCallCount: number;
  /** Unique file paths modified by write/edit tool calls in this turn. */
  changedFiles: string[];
  /** Final generation duration in ms (for completed messages). */
  durationMs: number | null;
  /** ISO timestamp of when generation started — i.e. the preceding user
   *  message's createdAt — used for a live counter while streaming. */
  startedAt: string | null;
  /** Stable per-message seed used to choose a status word pair. */
  statusWordSeed: string | null;
}) {
  const { t } = useTranslation();

  // ---------------------------------------------------------------------------
  // Elapsed time logic
  //
  // Completed messages  → use the pre-computed durationMs (accurate, static).
  // Streaming messages  → tick a live counter from startedAt (the moment the
  //                        user sent their message).
  // ---------------------------------------------------------------------------
  const startMs = startedAt ? new Date(startedAt).getTime() : null;

  const computeLiveElapsed = () =>
    startMs != null
      ? Math.max(0, Math.floor((Date.now() - startMs) / 1000))
      : 0;

  const [liveElapsed, setLiveElapsed] = useState(computeLiveElapsed);

  useEffect(() => {
    if (!isStreaming) return;

    setLiveElapsed(computeLiveElapsed());
    const interval = setInterval(() => {
      setLiveElapsed(computeLiveElapsed());
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable per startMs
  }, [isStreaming, startMs]);

  // Pick the right elapsed value.
  // When streaming ends for messages created during this session, durationMs
  // will be null (it's only computed server-side for initial DB messages).
  // Fall back to liveElapsed so the timer freezes at the last ticked value
  // instead of dropping to 0.
  const elapsedSeconds = isStreaming
    ? liveElapsed
    : durationMs != null
      ? Math.max(0, Math.round(durationMs / 1000))
      : liveElapsed;

  const statusWordPair = getStatusWordPair(statusWordSeed);
  const statusLabel = isStreaming
    ? `${t(`assistant.toolSummary.${statusWordPair.present}`)}…`
    : t(`assistant.toolSummary.${statusWordPair.past}`);
  const toolCallLabel =
    toolCallCount > 0
      ? t("assistant.toolSummary.toolCallCount", { count: toolCallCount })
      : null;

  const desktopSegments: string[] = [];
  const mobileSegments: string[] = [];

  if (elapsedSeconds > 0) {
    const elapsedLabel = formatElapsedTime(elapsedSeconds, t);
    desktopSegments.push(elapsedLabel);
    mobileSegments.push(elapsedLabel);
  }

  if (toolCallLabel) {
    desktopSegments.push(toolCallLabel);
  }

  if (changedFiles.length > 0) {
    const filesLabel = t("assistant.toolSummary.filesChanged", {
      count: changedFiles.length,
    });
    desktopSegments.push(filesLabel);
  }

  if (toolCallLabel) {
    mobileSegments.push(toolCallLabel);
  }

  const fullSummary = [statusLabel, ...desktopSegments].join(" · ");

  return (
    <div className="my-1.5 border border-transparent py-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-label={fullSummary}
        title={fullSummary}
        className={cn(
          "group flex w-full max-w-full items-center gap-2 rounded-md py-px text-left text-sm text-muted-foreground tabular-nums transition-colors hover:text-foreground sm:inline-flex sm:w-auto",
          isStreaming && "text-foreground/90",
        )}
      >
        <span className="flex size-3.5 shrink-0 items-center justify-center">
          <span
            className={cn(
              "inline-block size-2 rounded-full",
              isStreaming
                ? "animate-pulse bg-muted-foreground"
                : "bg-muted-foreground/50",
            )}
          />
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 overflow-hidden whitespace-nowrap leading-none sm:flex-none sm:overflow-visible sm:whitespace-normal",
            isStreaming && "animate-pulse motion-reduce:animate-none",
          )}
        >
          {statusLabel}
          {mobileSegments.length > 0 && (
            <span className="inline-block max-w-full truncate align-bottom sm:hidden">
              {renderSegments(mobileSegments)}
            </span>
          )}
          {desktopSegments.length > 0 && (
            <span className="hidden sm:inline">
              {renderSegments(desktopSegments)}
            </span>
          )}
        </span>
        <ChevronRight
          className={cn(
            "size-3 shrink-0 text-muted-foreground/50 transition-transform duration-200 ease-out motion-reduce:transition-none",
            isExpanded && "rotate-90",
          )}
        />
      </button>
    </div>
  );
}
