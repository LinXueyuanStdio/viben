/**
 * SpanNode Component
 *
 * Renders a single span in the trace tree view with expandable children
 */
import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronDown,
  Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "react-i18next";
import type { TraceSpanNode } from "./types";
import { getSpanKindIcon, hasDetailData } from "./utils";

export interface SpanNodeProps {
  node: TraceSpanNode;
  formatDuration: (ms: number) => string;
  traceStartTime: number;
  totalDuration: number;
  depth?: number;
  selectedSpan: TraceSpanNode | null;
  onSelectSpan: (span: TraceSpanNode) => void;
  onOpenDetail?: (span: TraceSpanNode) => void;
  searchQuery: string;
}

export function SpanNode({
  node,
  formatDuration,
  traceStartTime,
  totalDuration,
  depth = 0,
  selectedSpan,
  onSelectSpan,
  onOpenDetail,
  searchQuery,
}: SpanNodeProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedSpan?.spanId === node.spanId;

  // Check if this span matches search
  const matchesSearch = searchQuery
    ? node.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.name.toLowerCase().includes(searchQuery.toLowerCase())
    : true;

  const statusIcon =
    node.status.code === 1 ? (
      <CheckCircle2 className="h-3 w-3 text-green-400" />
    ) : node.status.code === 2 ? (
      <XCircle className="h-3 w-3 text-red-400" />
    ) : (
      <div className="h-3 w-3 rounded-full bg-gray-500" />
    );

  const textColor =
    node.status.code === 2
      ? "text-red-400"
      : node.status.code === 1
      ? "text-gray-300"
      : "text-yellow-400";

  // Calculate timeline bar position
  const offsetPercent = ((node.startTime - traceStartTime) / totalDuration) * 100;
  const widthPercent = (node.duration / totalDuration) * 100;

  // HTTP info extraction
  const httpMethod = node.attributes["http.method"] as string | undefined;
  const httpStatusCode = node.attributes["http.status_code"] as number | undefined;

  return (
    <div className={!matchesSearch ? "opacity-40" : ""}>
      <div
        className={`flex items-center gap-2 py-1.5 hover:bg-white/5 rounded px-1 cursor-pointer ${textColor} ${
          isSelected ? "bg-blue-500/20 ring-1 ring-blue-500/50" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectSpan(node);
        }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(!expanded);
          }}
          className="flex-shrink-0"
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3 w-3 text-gray-500" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-500" />
            )
          ) : (
            <div className="w-3" />
          )}
        </button>
        {statusIcon}
        <span className="text-gray-500">{getSpanKindIcon(node.kind)}</span>
        <span className="flex-1 truncate">{node.displayName}</span>

        {/* HTTP badges */}
        {httpMethod && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1 py-0 h-4 ${
              httpMethod === "GET"
                ? "border-blue-500/50 text-blue-400"
                : httpMethod === "POST"
                ? "border-green-500/50 text-green-400"
                : httpMethod === "PUT"
                ? "border-yellow-500/50 text-yellow-400"
                : httpMethod === "DELETE"
                ? "border-red-500/50 text-red-400"
                : "border-gray-500/50 text-gray-400"
            }`}
          >
            {httpMethod}
          </Badge>
        )}
        {httpStatusCode && (
          <Badge
            variant="outline"
            className={`text-[10px] px-1 py-0 h-4 ${
              httpStatusCode >= 200 && httpStatusCode < 300
                ? "border-green-500/50 text-green-400"
                : httpStatusCode >= 400 && httpStatusCode < 500
                ? "border-yellow-500/50 text-yellow-400"
                : httpStatusCode >= 500
                ? "border-red-500/50 text-red-400"
                : "border-gray-500/50 text-gray-400"
            }`}
          >
            {httpStatusCode}
          </Badge>
        )}

        {/* Events count badge */}
        {node.events && node.events.length > 0 && (
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 h-4 border-purple-500/50 text-purple-400"
          >
            {node.events.length} {t("observability.events")}
          </Badge>
        )}

        {/* Detail button for spans with request/response data */}
        {hasDetailData(node) && onOpenDetail && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDetail(node);
                  }}
                  className="flex-shrink-0 p-1 hover:bg-white/10 rounded"
                >
                  <Eye className="h-3 w-3 text-blue-400" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("observability.viewDetails")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Mini timeline bar */}
        <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden flex-shrink-0">
          <div
            className={`h-full ${
              node.status.code === 2
                ? "bg-red-500"
                : node.status.code === 1
                ? "bg-green-500"
                : "bg-yellow-500"
            }`}
            style={{
              marginLeft: `${offsetPercent}%`,
              width: `${Math.max(widthPercent, 2)}%`,
            }}
          />
        </div>

        <span className="text-yellow-400 text-xs w-16 text-right flex-shrink-0">
          {formatDuration(node.duration)}
        </span>
      </div>

      {hasChildren && expanded && (
        <div className="ml-4 border-l border-gray-700 pl-2">
          {node.children.map((child) => (
            <SpanNode
              key={child.spanId}
              node={child}
              formatDuration={formatDuration}
              traceStartTime={traceStartTime}
              totalDuration={totalDuration}
              depth={depth + 1}
              selectedSpan={selectedSpan}
              onSelectSpan={onSelectSpan}
              onOpenDetail={onOpenDetail}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}
