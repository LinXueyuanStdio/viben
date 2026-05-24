/**
 * TimelineView Component
 *
 * Displays spans in a waterfall/timeline visualization
 */
import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { TraceSpanNode } from "./types";

const ROW_HEIGHT = 32;

export interface TimelineViewProps {
  spans: TraceSpanNode[];
  traceStartTime: number;
  totalDuration: number;
  formatDuration: (ms: number) => string;
  selectedSpan: TraceSpanNode | null;
  onSelectSpan: (span: TraceSpanNode) => void;
}

export function TimelineView({
  spans,
  traceStartTime,
  totalDuration,
  formatDuration,
  selectedSpan,
  onSelectSpan,
}: TimelineViewProps) {
  const { t } = useTranslation();

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: spans.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  if (spans.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{t("observability.noSpansFound")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Time scale header */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3 pb-2 border-b">
        <div className="w-48 flex-shrink-0">{t("observability.spanName")}</div>
        <div className="flex-1 flex justify-between">
          <span>{t("observability.zeroMs", "0ms")}</span>
          <span>{formatDuration(totalDuration / 4)}</span>
          <span>{formatDuration(totalDuration / 2)}</span>
          <span>{formatDuration((totalDuration * 3) / 4)}</span>
          <span>{formatDuration(totalDuration)}</span>
        </div>
        <div className="w-20 text-right">{t("observability.duration")}</div>
      </div>

      {/* Virtualized span rows */}
      <div
        ref={parentRef}
        className="overflow-auto"
        style={{ height: Math.min(spans.length * ROW_HEIGHT, 400) }}
      >
        <div
          style={{
            height: virtualizer.getTotalSize(),
            width: "100%",
            position: "relative",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const span = spans[virtualItem.index];
            const offsetPercent = ((span.startTime - traceStartTime) / totalDuration) * 100;
            const widthPercent = (span.duration / totalDuration) * 100;
            const isSelected = selectedSpan?.spanId === span.spanId;

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: virtualItem.size,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <div
                  className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-muted/50 ${
                    isSelected ? "bg-primary/10 ring-1 ring-primary/50" : ""
                  }`}
                  onClick={() => onSelectSpan(span)}
                >
                  <div className="w-48 flex-shrink-0 flex items-center gap-1.5">
                    {span.status.code === 1 ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />
                    ) : span.status.code === 2 ? (
                      <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />
                    ) : (
                      <div className="h-3 w-3 rounded-full bg-yellow-500 flex-shrink-0" />
                    )}
                    <span className="truncate text-sm">{span.displayName}</span>
                  </div>

                  <div className="flex-1 h-6 bg-muted rounded relative">
                    <div
                      className={`absolute top-1 bottom-1 rounded ${
                        span.status.code === 2
                          ? "bg-red-500"
                          : span.status.code === 1
                          ? "bg-green-500"
                          : "bg-yellow-500"
                      }`}
                      style={{
                        left: `${offsetPercent}%`,
                        width: `${Math.max(widthPercent, 0.5)}%`,
                      }}
                    />
                  </div>

                  <div className="w-20 text-right text-sm text-muted-foreground">
                    {formatDuration(span.duration)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
