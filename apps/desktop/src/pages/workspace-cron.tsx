/**
 * Workspace Cron Jobs Management Page
 *
 * Provides UI for managing scheduled tasks (cron jobs) in a workspace.
 * Features:
 * - Real-time status updates via WebSocket
 * - Auto-calculated next execution time
 * - Display of notification channels
 */

import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Clock,
  Plus,
  Loader2,
  Play,
  Pause,
  Trash2,
  MoreHorizontal,
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Bell,
  Settings2,
  MessageSquare,
  Send,
  History,
  XCircle,
  Zap,
  Timer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PageWrapper } from "@/components/layout";
import { WorkspaceHeader } from "@/components/workspace";
import {
  useLocalWorkspaces,
  useCronJobs,
  useCreateCronJob,
  useUpdateCronJob,
  useDeleteCronJob,
  useEnableCronJob,
  useDisableCronJob,
  useRunCronJob,
  useCronNotifications,
  useChannelInstances,
  useCronExecutionLogs,
} from "@/hooks";
import { useUnifiedAgents } from "@/hooks/use-unified-agents";
import { useTranslation } from "react-i18next";
import type { CronJob, CreateCronJob, UpdateCronJob, CronNotificationSettings, CronJobType } from "@/types/cron";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getChannelTypeName, type ChannelType } from "@/types/channel";
import { Checkbox } from "@/components/ui/checkbox";

type ScheduleType = "cron" | "interval";

interface JobFormData {
  name: string;
  description: string;
  jobType: CronJobType;
  message: string;
  script: string;
  scheduleType: ScheduleType;
  cronExpression: string;
  intervalSeconds: number;
  agent: string;
  channel: string;
  enabled: boolean;
  // Notification settings
  notifyInApp: boolean;
  notifySystem: boolean;
  notifyChannelIds: string[];
}

const defaultFormData: JobFormData = {
  name: "",
  description: "",
  jobType: "agent",
  message: "",
  script: "",
  scheduleType: "interval",
  cronExpression: "0 9 * * *",
  intervalSeconds: 3600,
  agent: "main",
  channel: "",
  enabled: true,
  notifyInApp: true,
  notifySystem: false,
  notifyChannelIds: [],
};

// Common cron presets
const CRON_PRESETS = [
  { label: "cron.presets.everyMinute", value: "* * * * *" },
  { label: "cron.presets.every5Minutes", value: "*/5 * * * *" },
  { label: "cron.presets.every15Minutes", value: "*/15 * * * *" },
  { label: "cron.presets.everyHour", value: "0 * * * *" },
  { label: "cron.presets.everyDay9AM", value: "0 9 * * *" },
  { label: "cron.presets.everyMonday9AM", value: "0 9 * * 1" },
  { label: "cron.presets.firstOfMonth", value: "0 0 1 * *" },
];

// Interval presets in seconds
const INTERVAL_PRESETS = [
  { label: "cron.intervals.1minute", value: 60 },
  { label: "cron.intervals.5minutes", value: 300 },
  { label: "cron.intervals.15minutes", value: 900 },
  { label: "cron.intervals.30minutes", value: 1800 },
  { label: "cron.intervals.1hour", value: 3600 },
  { label: "cron.intervals.6hours", value: 21600 },
  { label: "cron.intervals.12hours", value: 43200 },
  { label: "cron.intervals.24hours", value: 86400 },
];

/**
 * Parse cron expression and return human-readable description
 */
function describeCronExpression(cron: string, t: (key: string, defaultValue: string) => string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return t("cron.desc.invalid", "Invalid cron expression");
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Helper to format time
  const formatTime = (h: string, m: string): string => {
    const hNum = parseInt(h);
    const mNum = parseInt(m);
    if (isNaN(hNum) || isNaN(mNum)) return "";
    const hStr = hNum.toString().padStart(2, "0");
    const mStr = mNum.toString().padStart(2, "0");
    return `${hStr}:${mStr}`;
  };

  // Day of week names
  const dayNames: Record<string, string> = {
    "0": t("cron.days.sunday", "Sunday"),
    "1": t("cron.days.monday", "Monday"),
    "2": t("cron.days.tuesday", "Tuesday"),
    "3": t("cron.days.wednesday", "Wednesday"),
    "4": t("cron.days.thursday", "Thursday"),
    "5": t("cron.days.friday", "Friday"),
    "6": t("cron.days.saturday", "Saturday"),
    "7": t("cron.days.sunday", "Sunday"),
  };

  // Month names
  const monthNames: Record<string, string> = {
    "1": t("cron.months.january", "January"),
    "2": t("cron.months.february", "February"),
    "3": t("cron.months.march", "March"),
    "4": t("cron.months.april", "April"),
    "5": t("cron.months.may", "May"),
    "6": t("cron.months.june", "June"),
    "7": t("cron.months.july", "July"),
    "8": t("cron.months.august", "August"),
    "9": t("cron.months.september", "September"),
    "10": t("cron.months.october", "October"),
    "11": t("cron.months.november", "November"),
    "12": t("cron.months.december", "December"),
  };

  // Every minute
  if (minute === "*" && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return t("cron.desc.everyMinute", "Every minute");
  }

  // Every N minutes
  if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const interval = minute.slice(2);
    return t("cron.desc.everyNMinutes", `Every ${interval} minutes`).replace("{n}", interval);
  }

  // Every hour at specific minute
  if (!minute.includes("*") && !minute.includes("/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const m = parseInt(minute);
    if (m === 0) {
      return t("cron.desc.everyHour", "Every hour on the hour");
    }
    return t("cron.desc.everyHourAtMinute", `Every hour at minute ${minute}`).replace("{m}", minute);
  }

  // Every N hours
  if (minute === "0" && hour.startsWith("*/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const interval = hour.slice(2);
    return t("cron.desc.everyNHours", `Every ${interval} hours`).replace("{n}", interval);
  }

  // Specific time every day
  if (!minute.includes("*") && !minute.includes("/") && !hour.includes("*") && !hour.includes("/") && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const time = formatTime(hour, minute);
    return t("cron.desc.everyDayAt", `Every day at ${time}`).replace("{time}", time);
  }

  // Specific time on specific day of week
  if (!minute.includes("*") && !hour.includes("*") && dayOfMonth === "*" && month === "*" && dayOfWeek !== "*") {
    const time = formatTime(hour, minute);
    const days = dayOfWeek.split(",").map(d => dayNames[d] || d).join(", ");
    // Handle range like 1-5
    if (dayOfWeek === "1-5") {
      return t("cron.desc.weekdaysAt", `Weekdays at ${time}`).replace("{time}", time);
    }
    if (dayOfWeek === "0,6" || dayOfWeek === "6,0") {
      return t("cron.desc.weekendsAt", `Weekends at ${time}`).replace("{time}", time);
    }
    return t("cron.desc.onDaysAt", `Every ${days} at ${time}`).replace("{days}", days).replace("{time}", time);
  }

  // First of month
  if (!minute.includes("*") && !hour.includes("*") && dayOfMonth === "1" && month === "*" && dayOfWeek === "*") {
    const time = formatTime(hour, minute);
    return t("cron.desc.firstOfMonthAt", `First of every month at ${time}`).replace("{time}", time);
  }

  // Specific day of month
  if (!minute.includes("*") && !hour.includes("*") && !dayOfMonth.includes("*") && month === "*" && dayOfWeek === "*") {
    const time = formatTime(hour, minute);
    return t("cron.desc.dayOfMonthAt", `Day ${dayOfMonth} of every month at ${time}`).replace("{day}", dayOfMonth).replace("{time}", time);
  }

  // Specific month and day
  if (!minute.includes("*") && !hour.includes("*") && !dayOfMonth.includes("*") && !month.includes("*") && dayOfWeek === "*") {
    const time = formatTime(hour, minute);
    const monthName = monthNames[month] || month;
    return t("cron.desc.specificDate", `${monthName} ${dayOfMonth} at ${time}`).replace("{month}", monthName).replace("{day}", dayOfMonth).replace("{time}", time);
  }

  // Fallback: describe each field
  const descriptions: string[] = [];

  if (minute === "*") {
    descriptions.push(t("cron.desc.partEveryMinute", "every minute"));
  } else if (minute.startsWith("*/")) {
    descriptions.push(t("cron.desc.partEveryNMinutes", `every ${minute.slice(2)} minutes`).replace("{n}", minute.slice(2)));
  } else {
    descriptions.push(t("cron.desc.partAtMinute", `at minute ${minute}`).replace("{m}", minute));
  }

  if (hour !== "*") {
    if (hour.startsWith("*/")) {
      descriptions.push(t("cron.desc.partEveryNHours", `every ${hour.slice(2)} hours`).replace("{n}", hour.slice(2)));
    } else {
      descriptions.push(t("cron.desc.partAtHour", `at hour ${hour}`).replace("{h}", hour));
    }
  }

  if (dayOfMonth !== "*") {
    descriptions.push(t("cron.desc.partOnDay", `on day ${dayOfMonth}`).replace("{d}", dayOfMonth));
  }

  if (month !== "*") {
    const monthName = monthNames[month] || month;
    descriptions.push(t("cron.desc.partInMonth", `in ${monthName}`).replace("{month}", monthName));
  }

  if (dayOfWeek !== "*") {
    const days = dayOfWeek.split(",").map(d => dayNames[d] || d).join(", ");
    descriptions.push(t("cron.desc.partOnWeekday", `on ${days}`).replace("{days}", days));
  }

  return descriptions.join(", ");
}

export function WorkspaceCronPage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { getWorkspace, isLoading: isLoadingWorkspaces, workspaces } = useLocalWorkspaces();

  // Workspace agents (unified: executors + global agents)
  const { all: workspaceAgents, loading: loadingAgents } = useUnifiedAgents({
    workspaceId: workspaceId || null,
    includeAgents: true,
    includeExecutors: true,
  });

  // Cron job hooks
  const { jobs, loading: loadingJobs, error: jobsError, refresh: refreshJobs } = useCronJobs();
  const { createJob, loading: creating } = useCreateCronJob();
  const { updateJob, loading: updating } = useUpdateCronJob();
  const { deleteJob } = useDeleteCronJob();
  const { enableJob } = useEnableCronJob();
  const { disableJob } = useDisableCronJob();
  const { runJob } = useRunCronJob();
  const { notifyCronStatus } = useCronNotifications();

  // Channel instances for notification
  const { instances: allChannels, getEnabledInstances } = useChannelInstances();
  const enabledChannels = getEnabledInstances();

  // Execution logs
  const { logs: executionLogs, loading: loadingLogs, fetchLogs, clearLogs } = useCronExecutionLogs();

  // Create a map of channel IDs to channel info for quick lookup
  const channelMap = useMemo(() => {
    const map = new Map<string, { name: string; type: ChannelType }>();
    allChannels.forEach((channel) => {
      map.set(channel.id, {
        name: channel.name,
        type: channel.channel_type as ChannelType,
      });
    });
    return map;
  }, [allChannels]);

  // UI state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [formData, setFormData] = useState<JobFormData>(defaultFormData);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const totalSteps = 3;

  // Logs dialog state
  const [logsDialogJob, setLogsDialogJob] = useState<CronJob | null>(null);

  // Multi-select state
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  // Real-time countdown state - update every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const workspace = workspaceId ? getWorkspace(workspaceId) : undefined;
  const loading = loadingJobs || isLoadingWorkspaces || loadingAgents;

  // Reset form when dialog closes
  useEffect(() => {
    if (!createDialogOpen && !editingJob) {
      setFormData(defaultFormData);
      setWizardStep(1);
    }
  }, [createDialogOpen, editingJob]);

  // Populate form when editing
  useEffect(() => {
    if (editingJob) {
      setFormData({
        name: editingJob.name,
        description: editingJob.description || "",
        jobType: editingJob.job_type || "agent",
        message: editingJob.message || "",
        script: editingJob.script || "",
        scheduleType: editingJob.cron ? "cron" : "interval",
        cronExpression: editingJob.cron || "0 9 * * *",
        intervalSeconds: editingJob.every || 3600,
        agent: editingJob.agent || "main",
        channel: editingJob.channel || "",
        enabled: editingJob.enabled,
        notifyInApp: editingJob.notifications?.in_app ?? true,
        notifySystem: editingJob.notifications?.system ?? false,
        notifyChannelIds: editingJob.notifications?.channel_ids ?? [],
      });
    }
  }, [editingJob]);

  const handleCreateOrUpdate = async () => {
    const notifications: CronNotificationSettings = {
      in_app: formData.notifyInApp,
      system: formData.notifySystem,
      channel_ids: formData.notifyChannelIds,
    };

    const data: CreateCronJob | UpdateCronJob = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      job_type: formData.jobType,
      message: formData.message.trim() || undefined,
      script: formData.script.trim() || undefined,
      agent: formData.agent || undefined,
      channel: formData.channel || undefined,
      enabled: formData.enabled,
      notifications,
      ...(formData.scheduleType === "cron"
        ? { cron: formData.cronExpression }
        : { every: formData.intervalSeconds }),
    };

    if (editingJob) {
      const result = await updateJob(editingJob.id, data as UpdateCronJob);
      if (result) {
        setEditingJob(null);
        refreshJobs();
      }
    } else {
      const result = await createJob(data as CreateCronJob);
      if (result) {
        setCreateDialogOpen(false);
        refreshJobs();
      }
    }
  };

  const handleDelete = async (job: CronJob) => {
    if (!confirm(t("cron.deleteConfirm", { name: job.name }))) return;
    const result = await deleteJob(job.id);
    if (result) {
      refreshJobs();
    }
  };

  const handleToggleEnabled = async (job: CronJob) => {
    if (job.enabled) {
      await disableJob(job.id);
    } else {
      await enableJob(job.id);
    }
    refreshJobs();
  };

  const handleRunNow = async (job: CronJob) => {
    setRunningJobId(job.id);

    // Notify that job is starting
    await notifyCronStatus(job.id, job.name, "started");

    try {
      const success = await runJob(job.id);

      if (success) {
        // Notify successful completion
        await notifyCronStatus(job.id, job.name, "completed");
      } else {
        // Notify failure (generic error)
        await notifyCronStatus(job.id, job.name, "failed");
      }
    } catch (err) {
      // Notify failure with error message
      const errorMessage = err instanceof Error ? err.message : String(err);
      await notifyCronStatus(job.id, job.name, "failed", errorMessage);
    }

    setRunningJobId(null);
    refreshJobs();
  };

  const handleViewLogs = async (job: CronJob) => {
    setLogsDialogJob(job);
    await fetchLogs(job.id);
  };

  const handleClearLogs = async () => {
    if (!logsDialogJob) return;
    if (!confirm(t("cron.clearLogsConfirm"))) return;
    await clearLogs(logsDialogJob.id);
  };

  // Multi-select handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobIds(new Set(jobs.map((job) => job.id)));
    } else {
      setSelectedJobIds(new Set());
    }
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(jobId);
      } else {
        next.delete(jobId);
      }
      return next;
    });
  };

  const handleBatchEnable = async () => {
    if (selectedJobIds.size === 0) return;
    setIsBatchProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedJobIds).map((id) => enableJob(id))
      );
      refreshJobs();
      setSelectedJobIds(new Set());
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDisable = async () => {
    if (selectedJobIds.size === 0) return;
    setIsBatchProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedJobIds).map((id) => disableJob(id))
      );
      refreshJobs();
      setSelectedJobIds(new Set());
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedJobIds.size === 0) return;
    const selectedJobs = jobs.filter((job) => selectedJobIds.has(job.id));
    const names = selectedJobs.map((job) => job.name).join(", ");
    if (!confirm(t("cron.batchDeleteConfirm", { count: selectedJobIds.size, names }))) return;

    setIsBatchProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedJobIds).map((id) => deleteJob(id))
      );
      refreshJobs();
      setSelectedJobIds(new Set());
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Clear selection when jobs change (e.g., after delete)
  useEffect(() => {
    setSelectedJobIds((prev) => {
      const jobIdSet = new Set(jobs.map((job) => job.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (jobIdSet.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [jobs]);

  const isAllSelected = jobs.length > 0 && selectedJobIds.size === jobs.length;
  const isIndeterminate = selectedJobIds.size > 0 && selectedJobIds.size < jobs.length;

  const formatLogDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const formatLogTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatSchedule = (job: CronJob): { display: string; tooltip: string } => {
    if (job.cron) {
      return {
        display: describeCronExpression(job.cron, t),
        tooltip: job.cron,
      };
    }
    if (job.every) {
      let display: string;
      if (job.every < 60) {
        display = t("cron.desc.everyNSeconds", `Every ${job.every} seconds`).replace("{n}", String(job.every));
      } else if (job.every < 3600) {
        const mins = Math.floor(job.every / 60);
        display = t("cron.desc.everyNMinutes", `Every ${mins} minutes`).replace("{n}", String(mins));
      } else if (job.every < 86400) {
        const hours = Math.floor(job.every / 3600);
        display = t("cron.desc.everyNHours", `Every ${hours} hours`).replace("{n}", String(hours));
      } else {
        const days = Math.floor(job.every / 86400);
        display = t("cron.desc.everyNDays", `Every ${days} days`).replace("{n}", String(days));
      }
      return { display, tooltip: `${job.every}s` };
    }
    return { display: "-", tooltip: "" };
  };

  const formatNextRun = (timestamp?: number): { text: string; isUrgent: boolean; isOverdue: boolean } => {
    if (!timestamp) return { text: "-", isUrgent: false, isOverdue: false };
    const now = Date.now();
    const diff = timestamp - now;

    if (diff < 0) {
      return { text: t("cron.overdue"), isUrgent: true, isOverdue: true };
    }
    if (diff < 60000) {
      const seconds = Math.floor(diff / 1000);
      return { text: `${seconds}s`, isUrgent: true, isOverdue: false };
    }
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      return { text: `${minutes}m ${secs}s`, isUrgent: diff < 300000, isOverdue: false };
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      return { text: `${hours}h ${mins}m`, isUrgent: false, isOverdue: false };
    }

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    return { text: `${days}d ${hours}h`, isUrgent: false, isOverdue: false };
  };

  const formatNextRunTooltip = (timestamp?: number): string => {
    if (!timestamp) return "-";
    return new Date(timestamp).toLocaleString();
  };

  const formatLastRun = (timestamp?: number): string => {
    if (!timestamp) return t("cron.never");
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getStatusBadge = (job: CronJob) => {
    // Show running state when actively executing
    if (job.last_status === "running") {
      return (
        <Badge variant="default" className="text-xs bg-blue-500">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          {t("common.running")}
        </Badge>
      );
    }
    // Show enabled/disabled status
    if (job.enabled) {
      return (
        <Badge variant="default" className="text-xs bg-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {t("common.enabled")}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs">
        <Pause className="h-3 w-3 mr-1" />
        {t("common.disabled")}
      </Badge>
    );
  };

  // Get notification channels display for a job
  const getNotificationChannels = (job: CronJob): { id: string; name: string; type: ChannelType }[] => {
    if (!job.notifications?.channel_ids?.length) return [];
    return job.notifications.channel_ids
      .map((id) => {
        const channel = channelMap.get(id);
        if (channel) {
          return { id, name: channel.name, type: channel.type };
        }
        return null;
      })
      .filter((c): c is { id: string; name: string; type: ChannelType } => c !== null);
  };

  // Loading state
  if (isLoadingWorkspaces && !workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  // Workspace not found
  if (!workspace && workspaces.length > 0) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            {t("workspace.notFound")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t("workspace.notFoundDesc")}
          </p>
          <Button asChild>
            <Link to="/mcp-services/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("workspace.backToDashboard")}
            </Link>
          </Button>
        </div>
      </PageWrapper>
    );
  }

  // Fallback loading
  if (!workspace) {
    return (
      <PageWrapper>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper className="flex flex-col h-full">
      {/* Header with breadcrumb */}
      <WorkspaceHeader
        workspace={workspace}
        segments={[
          { label: t("cron.title"), href: `/workspace/${workspaceId}/cron` },
        ]}
        onRefresh={refreshJobs}
        isRefreshing={loadingJobs}
        showRemove={false}
        rightContent={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t("cron.createJob")}
          </Button>
        }
      />

      {/* Content */}
      <div className="flex-1 overflow-auto p-6 max-w-6xl mx-auto w-full">
        {jobsError ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="font-semibold mb-2">{t("common.error")}</h3>
              <p className="text-sm text-muted-foreground mb-4">{jobsError}</p>
              <Button onClick={refreshJobs} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                {t("common.refresh")}
              </Button>
            </CardContent>
          </Card>
        ) : loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : jobs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">{t("cron.noJobs")}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("cron.noJobsDesc")}
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("cron.createJob")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <TooltipProvider>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label={t("common.selectAll")}
                        className={isIndeterminate ? "data-[state=checked]:bg-primary/50" : ""}
                        data-state={isIndeterminate ? "indeterminate" : isAllSelected ? "checked" : "unchecked"}
                      />
                    </TableHead>
                    <TableHead className="w-[200px]">{t("common.name")}</TableHead>
                    <TableHead className="w-[100px]">{t("common.status")}</TableHead>
                    <TableHead className="w-[100px]">{t("cron.schedule")}</TableHead>
                    <TableHead className="w-[120px]">{t("cron.nextRun")}</TableHead>
                    <TableHead className="w-[150px]">{t("cron.lastRun")}</TableHead>
                    <TableHead className="w-[120px]">{t("cron.channels")}</TableHead>
                    <TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const nextRunInfo = formatNextRun(job.next_run);
                    const notificationChannels = getNotificationChannels(job);
                    const hasNotifications = job.notifications?.in_app || job.notifications?.system || notificationChannels.length > 0;

                    return (
                      <TableRow key={job.id} className={selectedJobIds.has(job.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedJobIds.has(job.id)}
                            onCheckedChange={(checked) => handleSelectJob(job.id, !!checked)}
                            aria-label={t("common.selectItem", { name: job.name })}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium">{job.name}</p>
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                {job.job_type === "script" ? t("cron.scriptType") : t("cron.agentType")}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {job.message || job.script || job.name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(job)}</TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground cursor-default">
                                {formatSchedule(job).display}
                              </span>
                            </TooltipTrigger>
                            {formatSchedule(job).tooltip && (
                              <TooltipContent>
                                <code className="text-xs">{formatSchedule(job).tooltip}</code>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`text-sm font-mono tabular-nums ${
                                nextRunInfo.isOverdue
                                  ? "text-destructive font-medium"
                                  : nextRunInfo.isUrgent
                                  ? "text-orange-500 font-medium"
                                  : "text-muted-foreground"
                              }`}>
                                {nextRunInfo.text}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{formatNextRunTooltip(job.next_run)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatLastRun(job.last_run)}
                        </TableCell>
                        <TableCell>
                          {hasNotifications ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                  {/* Build human-readable summary */}
                                  {(() => {
                                    const parts: string[] = [];
                                    if (job.notifications?.in_app) parts.push(t("cron.notifyInAppShort"));
                                    if (job.notifications?.system) parts.push(t("cron.notifySystemShort"));
                                    if (notificationChannels.length > 0) {
                                      parts.push(notificationChannels.map(c => c.name).join(", "));
                                    }
                                    return (
                                      <span className="truncate max-w-[100px]">
                                        {parts.join(" · ")}
                                      </span>
                                    );
                                  })()}
                                  <Bell className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <div className="space-y-1.5 text-xs">
                                  <p className="font-medium">{t("cron.notifications")}</p>
                                  {job.notifications?.in_app && (
                                    <div className="flex items-center gap-1.5">
                                      <Bell className="h-3 w-3" />
                                      <span>{t("cron.notifyInApp")}</span>
                                    </div>
                                  )}
                                  {job.notifications?.system && (
                                    <div className="flex items-center gap-1.5">
                                      <MessageSquare className="h-3 w-3" />
                                      <span>{t("cron.notifySystem")}</span>
                                    </div>
                                  )}
                                  {notificationChannels.length > 0 && (
                                    <>
                                      <div className="border-t pt-1.5 mt-1.5">
                                        {notificationChannels.map((channel) => (
                                          <div key={channel.id} className="flex items-center gap-1.5">
                                            <Send className="h-3 w-3" />
                                            <span>{channel.name}</span>
                                            <span className="text-muted-foreground">
                                              ({getChannelTypeName(channel.type)})
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleRunNow(job)}
                              disabled={runningJobId === job.id}
                              title={t("cron.runNow")}
                            >
                              {runningJobId === job.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4" />
                              )}
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="z-50">
                                <DropdownMenuItem onClick={() => setEditingJob(job)}>
                                  <Pencil className="h-4 w-4 mr-2" />
                                  {t("common.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewLogs(job)}>
                                  <History className="h-4 w-4 mr-2" />
                                  {t("cron.viewLogs")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleEnabled(job)}>
                                  {job.enabled ? (
                                    <>
                                      <Pause className="h-4 w-4 mr-2" />
                                      {t("common.disable")}
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-4 w-4 mr-2" />
                                      {t("common.enable")}
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDelete(job)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {t("common.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        )}
      </div>

      {/* Floating Bulk Actions Bar - Fixed at bottom */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transform transition-all duration-200 ease-out ${
          selectedJobIds.size > 0
            ? "translate-y-0 opacity-100"
            : "translate-y-full opacity-0 pointer-events-none"
        }`}
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Selection Info */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedJobIds(new Set())}
                className="h-8 w-8 p-0"
                aria-label={t("common.clearSelection")}
              >
                <XCircle className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">
                {t("cron.selectedCount", { count: selectedJobIds.size })}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => isAllSelected ? setSelectedJobIds(new Set()) : handleSelectAll(true)}
                className="h-8 gap-1.5 text-xs"
              >
                {isAllSelected ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {t("common.deselectAll")}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 opacity-50" />
                    {t("common.selectAll")} ({jobs.length})
                  </>
                )}
              </Button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchEnable}
                disabled={isBatchProcessing}
                className="h-8 gap-1.5"
              >
                {isBatchProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {t("cron.batchEnable")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDisable}
                disabled={isBatchProcessing}
                className="h-8 gap-1.5"
              >
                {isBatchProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                {t("cron.batchDisable")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBatchDelete}
                disabled={isBatchProcessing}
                className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isBatchProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t("cron.batchDelete")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog - Wizard Style */}
      <Dialog
        open={createDialogOpen || !!editingJob}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingJob(null);
          }
        }}
      >
        <DialogContent className="max-w-[540px] p-0 gap-0 overflow-hidden [&>button:last-of-type]:hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b bg-muted/30">
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-lg">
                {editingJob ? t("cron.editJob") : t("cron.createJob")}
              </DialogTitle>
            </DialogHeader>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setCreateDialogOpen(false);
                setEditingJob(null);
              }}
              className="shrink-0 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Step Indicator */}
          <div className="px-6 py-4 border-b">
            <div className="flex items-center">
              {[
                { step: 1, icon: Clock, label: t("cron.wizard.step1Title") },
                { step: 2, icon: Settings2, label: t("cron.wizard.step2Title") },
                { step: 3, icon: Bell, label: t("cron.wizard.step3Title") },
              ].map(({ step, icon: Icon, label }, index) => {
                const isCompleted = step < wizardStep;
                const isCurrent = step === wizardStep;
                const isLocked = step > 1 && !formData.name.trim();
                const canNavigate = isCompleted || (step <= wizardStep && !isLocked);

                return (
                  <div key={step} className="flex items-center flex-1">
                    <button
                      type="button"
                      onClick={() => canNavigate && setWizardStep(step)}
                      disabled={!canNavigate}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all w-full ${
                        isCurrent
                          ? "bg-primary/10"
                          : canNavigate
                          ? "hover:bg-muted/50"
                          : "opacity-40 cursor-not-allowed"
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors shrink-0 ${
                          isCurrent
                            ? "bg-primary text-primary-foreground"
                            : isCompleted
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Icon className="h-4 w-4" />
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium truncate ${
                          isCurrent ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                    {index < 2 && (
                      <div
                        className={`w-6 h-px mx-1 shrink-0 ${
                          isCompleted ? "bg-primary/50" : "bg-border"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-5 max-h-[400px] overflow-y-auto">
            {/* Step 1: Name & Schedule */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="job-name" className="text-sm font-medium">
                    {t("common.name")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="job-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("cron.namePlaceholder")}
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="job-description" className="text-sm font-medium">
                    {t("common.description")}
                  </Label>
                  <Textarea
                    id="job-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t("cron.descriptionPlaceholder")}
                    className="min-h-[72px] resize-none"
                  />
                </div>

                {/* Schedule Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("cron.scheduleType")} <span className="text-destructive">*</span></Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scheduleType: "interval" })}
                      className={`flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all ${
                        formData.scheduleType === "interval"
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <RefreshCw className={`h-5 w-5 shrink-0 ${formData.scheduleType === "interval" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${formData.scheduleType === "interval" ? "text-primary" : ""}`}>
                        {t("cron.interval")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, scheduleType: "cron" })}
                      className={`flex items-center gap-2.5 p-3 rounded-lg border-2 transition-all ${
                        formData.scheduleType === "cron"
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <Clock className={`h-5 w-5 shrink-0 ${formData.scheduleType === "cron" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-sm font-medium ${formData.scheduleType === "cron" ? "text-primary" : ""}`}>
                        {t("cron.cronExpression")}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Interval or Cron Expression */}
                {formData.scheduleType === "interval" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="job-interval" className="text-sm font-medium">{t("cron.intervalLabel")}</Label>
                    <Select
                      value={formData.intervalSeconds.toString()}
                      onValueChange={(val) =>
                        setFormData({ ...formData, intervalSeconds: parseInt(val) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("cron.selectInterval")} />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVAL_PRESETS.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value.toString()}>
                            {t(preset.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="job-cron" className="text-sm font-medium">{t("cron.cronExpressionLabel")}</Label>
                    <Input
                      id="job-cron"
                      value={formData.cronExpression}
                      onChange={(e) =>
                        setFormData({ ...formData, cronExpression: e.target.value })
                      }
                      placeholder={t("placeholders.cronExpression")}
                      className="font-mono"
                    />
                    {/* Cron expression description */}
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3 shrink-0" />
                      {describeCronExpression(formData.cronExpression, t)}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {CRON_PRESETS.slice(0, 4).map((preset) => (
                        <Badge
                          key={preset.value}
                          variant={formData.cronExpression === preset.value ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => setFormData({ ...formData, cronExpression: preset.value })}
                        >
                          {t(preset.label)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Enabled */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="job-enabled" className="text-sm font-medium cursor-pointer">
                      {t("cron.enabled")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {t("cron.enabledHint")}
                    </p>
                  </div>
                  <Switch
                    id="job-enabled"
                    checked={formData.enabled}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, enabled: checked })
                    }
                  />
                </div>
              </div>
            )}

            {/* Step 2: Job Type & Content */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                {/* Job Type Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{t("cron.jobType")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, jobType: "agent" })}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border-2 transition-all text-left ${
                        formData.jobType === "agent"
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Settings2 className={`h-4 w-4 ${formData.jobType === "agent" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${formData.jobType === "agent" ? "text-primary" : ""}`}>
                          {t("cron.agentType")}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {t("cron.agentTypeDesc")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, jobType: "script" })}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border-2 transition-all text-left ${
                        formData.jobType === "script"
                          ? "border-primary bg-primary/5"
                          : "border-transparent bg-muted/50 hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Terminal className={`h-4 w-4 ${formData.jobType === "script" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${formData.jobType === "script" ? "text-primary" : ""}`}>
                          {t("cron.scriptType")}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {t("cron.scriptTypeDesc")}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Content based on job type */}
                {formData.jobType === "agent" ? (
                  <>
                    {/* Message for Agent type */}
                    <div className="space-y-1.5">
                      <Label htmlFor="job-message" className="text-sm font-medium inline-flex items-center gap-2">
                        {t("cron.message")}
                        <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">{t("common.optional")}</Badge>
                      </Label>
                      <Textarea
                        id="job-message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder={t("cron.messagePlaceholder")}
                        className="min-h-[88px] resize-none"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("cron.messageOptionalHint")}
                      </p>
                    </div>
                    {/* Agent Selection */}
                    <div className="space-y-1.5">
                      <Label htmlFor="job-agent" className="text-sm font-medium">{t("cron.agent")}</Label>
                      <Select
                        value={formData.agent}
                        onValueChange={(val) => setFormData({ ...formData, agent: val })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t("cron.selectAgent")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="main">
                            <span className="font-medium">main</span>
                            <span className="text-muted-foreground ml-2">({t("cron.defaultAgent")})</span>
                          </SelectItem>
                          {workspaceAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              <span className="font-medium">{agent.name}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  /* Script for Script type */
                  <div className="space-y-1.5">
                    <Label htmlFor="job-script" className="text-sm font-medium inline-flex items-center gap-2">
                      <Terminal className="h-3.5 w-3.5" />
                      {t("cron.script")}
                      <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">{t("common.optional")}</Badge>
                    </Label>
                    <Textarea
                      id="job-script"
                      value={formData.script}
                      onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                      placeholder={t("cron.scriptPlaceholder")}
                      className="min-h-[120px] font-mono text-sm resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t("cron.scriptOptionalHint")}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Notifications */}
            {wizardStep === 3 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">{t("cron.notifications")}</Label>

                {/* In-app notification */}
                <label
                  htmlFor="notify-inapp"
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.notifyInApp ? "border-primary/50 bg-primary/5" : "bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    id="notify-inapp"
                    checked={formData.notifyInApp}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, notifyInApp: checked === true })
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t("cron.notifyInApp")}</p>
                    <p className="text-xs text-muted-foreground truncate">{t("cron.notifyInAppDesc")}</p>
                  </div>
                </label>

                {/* System notification */}
                <label
                  htmlFor="notify-system"
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.notifySystem ? "border-primary/50 bg-primary/5" : "bg-muted/30 hover:bg-muted/50"
                  }`}
                >
                  <Checkbox
                    id="notify-system"
                    checked={formData.notifySystem}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, notifySystem: checked === true })
                    }
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t("cron.notifySystem")}</p>
                    <p className="text-xs text-muted-foreground truncate">{t("cron.notifySystemDesc")}</p>
                  </div>
                </label>

                {/* Channel notifications */}
                {enabledChannels.length > 0 && enabledChannels.map((channel) => (
                  <label
                    key={channel.id}
                    htmlFor={`notify-channel-${channel.id}`}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      formData.notifyChannelIds.includes(channel.id) ? "border-primary/50 bg-primary/5" : "bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      id={`notify-channel-${channel.id}`}
                      checked={formData.notifyChannelIds.includes(channel.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({
                            ...formData,
                            notifyChannelIds: [...formData.notifyChannelIds, channel.id],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            notifyChannelIds: formData.notifyChannelIds.filter(
                              (id) => id !== channel.id
                            ),
                          });
                        }
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{channel.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {getChannelTypeName(channel.channel_type as ChannelType)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => wizardStep > 1 && setWizardStep(wizardStep - 1)}
                disabled={wizardStep === 1}
                className={wizardStep === 1 ? "invisible" : ""}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("common.back")}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    setEditingJob(null);
                  }}
                >
                  {t("common.cancel")}
                </Button>
                {wizardStep < totalSteps ? (
                  <Button
                    size="sm"
                    onClick={() => setWizardStep(wizardStep + 1)}
                    disabled={wizardStep === 1 && !formData.name.trim()}
                  >
                    {t("common.next")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleCreateOrUpdate}
                    disabled={!formData.name.trim() || creating || updating}
                  >
                    {(creating || updating) && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    {editingJob ? t("common.update") : t("common.create")}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execution Logs Dialog */}
      <Dialog
        open={!!logsDialogJob}
        onOpenChange={(open) => {
          if (!open) {
            setLogsDialogJob(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              {t("cron.executionLogs")}
              {logsDialogJob && (
                <Badge variant="outline" className="ml-2 font-normal">
                  {logsDialogJob.name}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : executionLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">{t("cron.noLogs")}</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {t("cron.noLogsDesc")}
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {executionLogs.map((log) => (
                    <div
                      key={log.execution_id}
                      className={`p-3 rounded-lg border ${
                        log.status === "success"
                          ? "border-green-500/30 bg-green-500/5"
                          : log.status === "failure"
                          ? "border-red-500/30 bg-red-500/5"
                          : "border-muted"
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {log.status === "success" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : log.status === "failure" ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                          )}
                          <span className="font-medium text-sm">
                            {log.status === "success"
                              ? t("common.success")
                              : log.status === "failure"
                              ? t("common.failed")
                              : t("common.running")}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              log.trigger === "manual"
                                ? "border-orange-500/50 text-orange-600"
                                : "border-blue-500/50 text-blue-600"
                            }`}
                          >
                            {log.trigger === "manual" ? (
                              <Zap className="h-2.5 w-2.5 mr-0.5" />
                            ) : (
                              <Timer className="h-2.5 w-2.5 mr-0.5" />
                            )}
                            {log.trigger === "manual"
                              ? t("cron.triggerManual")
                              : t("cron.triggerScheduled")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatLogDuration(log.duration_ms)}</span>
                          <span>·</span>
                          <span>{formatLogTimestamp(log.started_at)}</span>
                        </div>
                      </div>

                      {/* Error */}
                      {log.error && (
                        <div className="mt-2 p-2 rounded bg-red-500/10 text-sm text-red-600 dark:text-red-400">
                          <span className="font-medium">{t("common.error")}:</span> {log.error}
                        </div>
                      )}

                      {/* Output */}
                      {log.output && (
                        <div className="mt-2">
                          <details className="group">
                            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                              <span>{t("cron.output")}</span>
                              <span className="text-muted-foreground/60">
                                ({log.output_length} {t("cron.chars")})
                              </span>
                            </summary>
                            <pre className="mt-2 p-2 rounded bg-muted/50 text-xs font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-auto">
                              {log.output}
                            </pre>
                          </details>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearLogs}
              disabled={loadingLogs || executionLogs.length === 0}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t("cron.clearLogs")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => logsDialogJob && fetchLogs(logsDialogJob.id)}
                disabled={loadingLogs}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingLogs ? "animate-spin" : ""}`} />
                {t("common.refresh")}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setLogsDialogJob(null)}
              >
                {t("common.close")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
