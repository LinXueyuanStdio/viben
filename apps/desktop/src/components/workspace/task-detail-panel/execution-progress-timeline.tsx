"use client";

import { useCallback, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock,
  ClipboardList,
  Code2,
  GitPullRequest,
  Loader2,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Badge, cn } from "@viben/ui";
import { formatDuration } from "@/lib/utils";

interface ActionConfig {
  Icon: LucideIcon;
  color: string;
  bgColor: string;
  textColor: string;
  ringColor: string;
}

const ACTION_CONFIGS: Record<string, ActionConfig> = {
  plan: {
    Icon: ClipboardList,
    color: "blue",
    bgColor: "bg-blue-500",
    textColor: "text-blue-500",
    ringColor: "ring-blue-500/20",
  },
  implement: {
    Icon: Code2,
    color: "purple",
    bgColor: "bg-purple-500",
    textColor: "text-purple-500",
    ringColor: "ring-purple-500/20",
  },
  check: {
    Icon: ShieldCheck,
    color: "green",
    bgColor: "bg-green-500",
    textColor: "text-green-500",
    ringColor: "ring-green-500/20",
  },
  finish: {
    Icon: Target,
    color: "orange",
    bgColor: "bg-orange-500",
    textColor: "text-orange-500",
    ringColor: "ring-orange-500/20",
  },
  "create-pr": {
    Icon: GitPullRequest,
    color: "pink",
    bgColor: "bg-pink-500",
    textColor: "text-pink-500",
    ringColor: "ring-pink-500/20",
  },
};

const DEFAULT_ACTION_CONFIG: ActionConfig = {
  Icon: Activity,
  color: "gray",
  bgColor: "bg-gray-500",
  textColor: "text-gray-500",
  ringColor: "ring-gray-500/20",
};

function formatTimeShort(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface ExecutionProgressTimelineProps {
  nextAction: Array<{ phase: number; action: string; startTime?: string; endTime?: string }>;
  currentPhase: number;
  status: string;
  t: (key: string, fallback: string, options?: Record<string, unknown>) => string;
}

export function ExecutionProgressTimeline({
  nextAction,
  currentPhase,
  status,
  t,
}: ExecutionProgressTimelineProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const toggleExpand = useCallback((index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const completedCount = Math.min(currentPhase, nextAction.length);
  const progressPercent = Math.round((completedCount / nextAction.length) * 100);

  return (
    <div className="mt-2 p-4 rounded-lg bg-background border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {t("workspace.executionProgress", "Execution Progress")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t("workspace.taskCard.step", "Step {{current}}/{{total}}", {
              current: Math.min(currentPhase + 1, nextAction.length),
              total: nextAction.length,
            })}
          </span>
          <Badge
            variant={status === "in_progress" ? "default" : "secondary"}
            className="text-xs tabular-nums"
          >
            {progressPercent}%
          </Badge>
        </div>
      </div>

      <div className="relative">
        <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-muted rounded-full" />
        <div
          className="absolute left-[15px] top-4 w-0.5 bg-gradient-to-b from-primary via-primary to-primary/50 rounded-full transition-all duration-700 ease-out"
          style={{
            height: `calc(${Math.min(100, (currentPhase / Math.max(1, nextAction.length - 1)) * 100)}% - 16px)`,
          }}
        />

        <div className="space-y-1">
          {nextAction.map((action, index) => {
            const isCompleted = index < currentPhase;
            const isCurrent = index === currentPhase;
            const isPending = index > currentPhase;
            const isExpanded = expandedSteps.has(index);
            const isHovered = hoveredStep === index;

            const config = ACTION_CONFIGS[action.action] || DEFAULT_ACTION_CONFIG;
            const ActionIcon = config.Icon;

            const hasTimeData = action.startTime || action.endTime;
            const startTime = action.startTime ? new Date(action.startTime) : null;
            const endTime = action.endTime ? new Date(action.endTime) : null;
            const duration = startTime && endTime
              ? endTime.getTime() - startTime.getTime()
              : null;

            return (
              <div
                key={index}
                className={cn(
                  "relative flex items-start gap-3 py-2 pl-12 pr-2 rounded-lg transition-all duration-200 cursor-pointer",
                  isHovered && !isPending && "bg-accent/50",
                  isExpanded && "bg-accent/30"
                )}
                onMouseEnter={() => setHoveredStep(index)}
                onMouseLeave={() => setHoveredStep(null)}
                onClick={() => toggleExpand(index)}
              >
                <div className={cn(
                  "absolute left-0 top-2 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all duration-300 shadow-sm",
                  isCompleted && cn(config.bgColor, "text-white"),
                  isCurrent && status === "in_progress" && cn(config.bgColor, "text-white ring-4", config.ringColor, "animate-pulse"),
                  isCurrent && status !== "in_progress" && cn(config.bgColor, "text-white ring-4", config.ringColor),
                  isPending && "bg-muted text-muted-foreground border-2 border-muted-foreground/20"
                )}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent && status === "in_progress" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ActionIcon className="h-4 w-4" />
                  )}
                </div>

                <div className={cn(
                  "flex-1 min-w-0 pt-1 transition-opacity duration-300",
                  isPending && "opacity-50"
                )}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <ActionIcon className={cn("h-4 w-4", isPending ? "text-muted-foreground" : config.textColor)} />
                      <span className={cn(
                        "text-sm font-medium leading-none",
                        isCurrent && config.textColor,
                        isCompleted && "text-foreground"
                      )}>
                        {t(`workspace.taskCard.action.${action.action}`, action.action)}
                      </span>
                    </div>

                    {isCurrent && status === "in_progress" && (
                      <Badge className={cn("text-[10px] h-5 border-0", `bg-${config.color}-500/10`, config.textColor)}>
                        {t("workspace.inProgress", "In Progress")}
                      </Badge>
                    )}
                    {isCompleted && (
                      <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                        {t("workspace.done", "Done")}
                      </Badge>
                    )}

                    <div className={cn(
                      "ml-auto transition-transform duration-200",
                      isExpanded && "rotate-180"
                    )}>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>

                  {(hasTimeData || isCompleted || isCurrent) && (
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      {startTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {t("workspace.started", "Started")}: {formatTimeShort(startTime)}
                        </span>
                      )}
                      {endTime && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {t("workspace.completed", "Completed")}: {formatTimeShort(endTime)}
                        </span>
                      )}
                      {duration && (
                        <span className="flex items-center gap-1 font-medium">
                          <Activity className="h-2.5 w-2.5" />
                          {formatDuration(duration)}
                        </span>
                      )}
                      {isCurrent && status === "in_progress" && !startTime && (
                        <span className="flex items-center gap-1 animate-pulse">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          {t("workspace.running", "Running")}...
                        </span>
                      )}
                    </div>
                  )}

                  <div className={cn(
                    "overflow-hidden transition-all duration-300 ease-out",
                    isExpanded ? "max-h-32 opacity-100 mt-2" : "max-h-0 opacity-0"
                  )}>
                    <div className="p-2 rounded bg-muted/50 text-xs">
                      <p className="text-muted-foreground">
                        {t(`workspace.taskCard.actionDesc.${action.action}`, t("workspace.taskCard.actionDesc.default", "Executing action"))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t">
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700 ease-out",
              status === "in_progress"
                ? "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
                : "bg-gradient-to-r from-primary to-primary/80"
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>{completedCount} {t("workspace.stepsCompleted", "completed")}</span>
          <span>{nextAction.length - completedCount} {t("workspace.stepsRemaining", "remaining")}</span>
        </div>
      </div>
    </div>
  );
}
